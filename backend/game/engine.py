import random

from backend.game.board import BoardManager
from backend.game.voting import tally_votes, resolve_accusation as _resolve
from backend.models.game import (
    EndgameRoundState, GamePhase, GameState, Hint, RoundState,
)
from backend.models.lobby import Lobby, LobbyConfig
from backend.models.player import Player, Role


class GameEngine:
    def __init__(self, lobby_id: str, num_morps: int = 1, timers_enabled: bool = True):
        self.lobby = Lobby(
            id=lobby_id,
            host_id="",
            config=LobbyConfig(num_morps=num_morps, timers_enabled=timers_enabled),
        )
        self.state = GameState(lobby_id=lobby_id)
        self.board_manager = BoardManager()
        self._round_seed: int = 0
        self._pending_damage_morps: list[str] = []

    # ── Lobby ─────────────────────────────────────────────────────────────────

    def add_player(self, player_id: str, name: str, is_host: bool = False) -> Player:
        player = Player(id=player_id, name=name)
        self.lobby.players[player_id] = player
        if is_host or not self.lobby.host_id:
            self.lobby.host_id = player_id
        return player

    # ── Game start / round management ─────────────────────────────────────────

    def start_game(self, seed: int) -> None:
        active = self.lobby.active_players()
        if len(active) < 3:
            raise ValueError("Need at least 3 players to start.")
        self.lobby.started = True
        self._start_round(seed=seed)

    def start_new_round(self, seed: int) -> None:
        if self.state.phase != GamePhase.ROUND_END:
            raise ValueError("Can only start a new round from ROUND_END phase.")
        self._start_round(seed=seed)

    def _start_round(self, seed: int) -> None:
        self._round_seed = seed
        rng = random.Random(seed)
        active = self.lobby.active_players()

        # Assign roles
        num_morps = self.lobby.config.num_morps
        ids = [p.id for p in active]
        morp_ids = set(rng.sample(ids, num_morps))
        for player in active:
            player.role = Role.MORP if player.id in morp_ids else Role.SAFE

        # Turn order
        turn_order = ids[:]
        rng.shuffle(turn_order)

        # Board + target
        board, target = self.board_manager.select_round(seed=seed)

        prev_round = self.state.round_state.round_number if self.state.round_state else 0
        self.state.round_state = RoundState(
            round_number=prev_round + 1,
            board=board,
            target_word=target,
            turn_order=turn_order,
        )
        self.state.phase = GamePhase.HINT

    # ── Half-board ────────────────────────────────────────────────────────────

    def get_half_board_for_morp(self, seed: int) -> list[str] | None:
        rs = self.state.round_state
        if rs is None:
            return None
        first_player = self.lobby.players[rs.turn_order[0]]
        if first_player.role != Role.MORP:
            return None
        return rs.board.half(seed=seed, must_include=rs.target_word)

    # ── Hint phase ────────────────────────────────────────────────────────────

    def submit_hint(self, player_id: str, text: str) -> None:
        rs = self.state.round_state
        if rs is None or self.state.phase != GamePhase.HINT:
            raise ValueError("Not in hint phase.")
        if rs.current_player_id() != player_id:
            raise ValueError(f"It is not your turn — not your turn, {player_id}.")
        rs.hints.append(Hint(player_id=player_id, text=text))
        rs.current_turn_index += 1
        if rs.all_hints_submitted():
            self.state.phase = GamePhase.VOTING

    # ── Voting ────────────────────────────────────────────────────────────────

    def submit_votes(self, voter_id: str, accused_ids: list[str]) -> None:
        rs = self.state.round_state
        if rs is None or self.state.phase != GamePhase.VOTING:
            raise ValueError("Not in voting phase.")
        num_morps = self.lobby.config.num_morps
        if len(accused_ids) != num_morps:
            raise ValueError(f"Must cast exactly {num_morps} vote(s).")
        if voter_id in accused_ids:
            raise ValueError("Cannot vote for yourself.")
        active_ids = {p.id for p in self.lobby.active_players()}
        for aid in accused_ids:
            if aid not in active_ids:
                raise ValueError(f"Player '{aid}' is not in game.")
        rs.votes[voter_id] = accused_ids
        self._check_voting_complete()

    def _check_voting_complete(self) -> None:
        rs = self.state.round_state
        if rs is None:
            return
        connected_ids = {p.id for p in self.lobby.active_players() if p.is_connected}
        if connected_ids and connected_ids.issubset(rs.votes.keys()):
            rs.accused_ids = tally_votes(rs.votes, self.lobby.config.num_morps, seed=self._round_seed)
            self.state.phase = GamePhase.ACCUSATION

    # ── Accusation ────────────────────────────────────────────────────────────

    def resolve_accusation(self) -> dict:
        rs = self.state.round_state
        if rs is None or self.state.phase != GamePhase.ACCUSATION:
            raise ValueError("Not in accusation phase.")
        player_roles = {p.id: p.role.value for p in self.lobby.players.values()}
        result = _resolve(rs.accused_ids, player_roles)
        if result["morp_must_guess"]:
            self.state.phase = GamePhase.MORP_GUESS
        elif result["morp_gets_to_damage"]:
            surviving_morps = [p.id for p in self.lobby.active_players() if p.role == Role.MORP]
            self._pending_damage_morps = surviving_morps[:]
        return result

    def submit_morp_guess(self, morp_id: str, guess: str) -> bool:
        rs = self.state.round_state
        if rs is None or self.state.phase != GamePhase.MORP_GUESS:
            raise ValueError("Not in morp guess phase.")
        if morp_id not in rs.accused_ids:
            raise ValueError("Only an accused morp can submit a guess.")
        correct = guess.strip().lower() == rs.target_word.strip().lower()
        if not correct:
            self.lobby.players[morp_id].take_damage()
        self._resolve_round()
        return correct

    def morp_deal_damage(self, morp_id: str, target_id: str) -> bool:
        """Deal 1 damage. Returns True when all pending morps have dealt damage."""
        if morp_id == target_id:
            raise ValueError("Cannot deal damage to yourself.")
        if morp_id in self._pending_damage_morps:
            self._pending_damage_morps.remove(morp_id)
        self.lobby.players[target_id].take_damage()
        if not self._pending_damage_morps:
            self._resolve_round()
            return True
        return False

    def _resolve_round(self) -> None:
        """Set the next phase after a round's damage/guess is fully resolved."""
        active = self.lobby.active_players()
        if len(active) == 0:
            self.state.phase = GamePhase.GAME_OVER
        elif len(active) <= 2:
            self.state.phase = GamePhase.ENDGAME_2P
        else:
            self.state.phase = GamePhase.ROUND_END

    # ── 2-Player Endgame ─────────────────────────────────────────────────────

    def start_endgame_round(self, seed: int) -> None:
        board, target = self.board_manager.select_round(seed=seed)
        self.state.endgame_state = EndgameRoundState(board=board, target_word=target)
        # Both finalists become morps
        for p in self.lobby.active_players():
            p.role = Role.MORP
        self.state.phase = GamePhase.ENDGAME_GHOST_HINTS

    def endgame_submit_ghost_hint(self, player_id: str, text: str) -> bool:
        """Ghost submits a hint. Returns True when all ghosts have submitted."""
        player = self.lobby.players.get(player_id)
        if not player or not player.is_ghost:
            raise ValueError("Only ghost players can submit endgame hints.")
        es = self.state.endgame_state
        if es is None:
            raise ValueError("No endgame round in progress.")
        # Avoid duplicate submissions
        if any(h.player_id == player_id for h in es.ghost_hints):
            return False
        es.ghost_hints.append(Hint(player_id=player_id, text=text))
        ghost_ids = {p.id for p in self.lobby.ghost_players()}
        all_in = {h.player_id for h in es.ghost_hints} >= ghost_ids
        if all_in:
            self.state.phase = GamePhase.ENDGAME_GUESSING
        return all_in

    def endgame_submit_guess(self, player_id: str, guess: str) -> dict:
        """A finalist submits a guess. Returns result dict."""
        if self.state.phase != GamePhase.ENDGAME_GUESSING:
            raise ValueError("Not in endgame guessing phase.")
        es = self.state.endgame_state
        if player_id in es.guesses:
            raise ValueError(f"{player_id} has already guessed.")
        es.guesses[player_id] = guess
        correct = guess.strip().lower() == es.target_word.strip().lower()

        if correct:
            es.safe_player_id = player_id
            # Other finalist takes damage
            other = next(p for p in self.lobby.active_players() if p.id != player_id)
            other.take_damage()
            self._resolve_endgame_round()
            return {"correct": True, "round_over": True}

        # Wrong guess — check if opponent has also guessed
        active_ids = {p.id for p in self.lobby.active_players()}
        all_guessed = active_ids.issubset(es.guesses.keys())
        if all_guessed:
            # Both wrong — both take damage
            for p in self.lobby.active_players():
                p.take_damage()
            self._resolve_endgame_round()
            return {"correct": False, "round_over": True}

        return {"correct": False, "round_over": False}

    def endgame_timeout(self) -> None:
        """Called when the guess timer expires. Unguessed players take damage."""
        es = self.state.endgame_state
        for p in self.lobby.active_players():
            if p.id not in es.guesses:
                p.take_damage()
        self._resolve_endgame_round()

    def start_next_endgame_round(self, seed: int) -> None:
        """Start the next sudden-death endgame round. Called by main.py after ENDGAME_ROUND_END."""
        if self.state.phase != GamePhase.ENDGAME_ROUND_END:
            raise ValueError("Can only start next endgame round from ENDGAME_ROUND_END phase.")
        board, target = self.board_manager.select_round(seed=seed)
        self.state.endgame_state = EndgameRoundState(board=board, target_word=target)
        self.state.phase = GamePhase.ENDGAME_GHOST_HINTS

    def _resolve_endgame_round(self) -> None:
        active = self.lobby.active_players()
        if len(active) <= 1:
            self.state.phase = GamePhase.GAME_OVER
        else:
            # Both still alive — wait for main.py to trigger next round
            self.state.phase = GamePhase.ENDGAME_ROUND_END

    # ── Disconnect handling ───────────────────────────────────────────────────

    def on_player_disconnect(self, player_id: str) -> None:
        self.lobby.players[player_id].is_connected = False
        self._reassign_host_if_needed()
        phase = self.state.phase
        if phase == GamePhase.HINT:
            self._skip_disconnected_hints()
        elif phase == GamePhase.VOTING:
            self._check_voting_complete()

    def _reassign_host_if_needed(self) -> None:
        current_host = self.lobby.players.get(self.lobby.host_id)
        if current_host and current_host.is_connected:
            return
        for p in self.lobby.players.values():
            if p.is_connected and not p.is_ghost:
                self.lobby.host_id = p.id
                return

    def _skip_disconnected_hints(self) -> None:
        rs = self.state.round_state
        if rs is None:
            return
        while True:
            current = rs.current_player_id()
            if current is None:
                break
            player = self.lobby.players.get(current)
            if player and not player.is_connected:
                rs.hints.append(Hint(player_id=current, text=""))
                rs.current_turn_index += 1
                if rs.all_hints_submitted():
                    self.state.phase = GamePhase.VOTING
                    break
            else:
                break

    def all_disconnected(self) -> bool:
        return all(not p.is_connected for p in self.lobby.players.values())
