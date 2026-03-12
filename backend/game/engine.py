import random

from backend.game.board import BoardManager
from backend.game.voting import tally_votes, resolve_accusation as _resolve
from backend.models.game import GamePhase, GameState, Hint, RoundState
from backend.models.lobby import Lobby, LobbyConfig
from backend.models.player import Player, Role


class GameEngine:
    def __init__(self, lobby_id: str, num_morps: int = 1):
        self.lobby = Lobby(
            id=lobby_id,
            host_id="",
            config=LobbyConfig(num_morps=num_morps),
        )
        self.state = GameState(lobby_id=lobby_id)
        self.board_manager = BoardManager()
        self._round_seed: int = 0

    def add_player(self, player_id: str, name: str, is_host: bool = False) -> Player:
        player = Player(id=player_id, name=name)
        self.lobby.players[player_id] = player
        if is_host or not self.lobby.host_id:
            self.lobby.host_id = player_id
        return player

    def start_game(self, seed: int) -> None:
        active = self.lobby.active_players()
        if len(active) < 3:
            raise ValueError("Need at least 3 players to start.")
        self.lobby.started = True
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

        self.state.round_state = RoundState(
            round_number=getattr(self.state.round_state, "round_number", 0) + 1
            if self.state.round_state else 1,
            board=board,
            target_word=target,
            turn_order=turn_order,
        )
        self.state.phase = GamePhase.HINT

    def get_half_board_for_morp(self, seed: int) -> list[str] | None:
        """Return half the board words if the morp is first in turn order, else None."""
        rs = self.state.round_state
        if rs is None:
            return None
        first_player = self.lobby.players[rs.turn_order[0]]
        if first_player.role != Role.MORP:
            return None
        return rs.board.half(seed=seed, must_include=rs.target_word)

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
        # Only wait on connected active players; disconnected ones abstain
        connected_ids = {p.id for p in self.lobby.active_players() if p.is_connected}
        if connected_ids and connected_ids.issubset(rs.votes.keys()):
            rs.accused_ids = tally_votes(rs.votes, self.lobby.config.num_morps, seed=self._round_seed)
            self.state.phase = GamePhase.ACCUSATION

    def resolve_accusation(self) -> dict:
        rs = self.state.round_state
        if rs is None or self.state.phase != GamePhase.ACCUSATION:
            raise ValueError("Not in accusation phase.")
        player_roles = {p.id: p.role.value for p in self.lobby.players.values()}
        result = _resolve(rs.accused_ids, player_roles)
        if result["morp_must_guess"]:
            self.state.phase = GamePhase.MORP_GUESS
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
        self._check_eliminations()
        return correct

    def morp_deal_damage(self, morp_id: str, target_id: str) -> None:
        if morp_id == target_id:
            raise ValueError("Cannot deal damage to yourself.")
        self.lobby.players[target_id].take_damage()
        self._check_eliminations()

    def _check_eliminations(self) -> None:
        active = self.lobby.active_players()
        if len(active) <= 2:
            self.state.phase = GamePhase.ENDGAME_2P if len(active) == 2 else GamePhase.GAME_OVER

    def on_player_disconnect(self, player_id: str) -> None:
        """Mark player disconnected and unblock any phase waiting on them."""
        self.lobby.players[player_id].is_connected = False
        self._reassign_host_if_needed()

        phase = self.state.phase
        if phase == GamePhase.HINT:
            self._skip_disconnected_hints()
        elif phase == GamePhase.VOTING:
            self._check_voting_complete()

    def _reassign_host_if_needed(self) -> None:
        if self.lobby.players.get(self.lobby.host_id, None) and \
                self.lobby.players[self.lobby.host_id].is_connected:
            return
        # Pick the first connected non-ghost player as the new host
        for p in self.lobby.players.values():
            if p.is_connected and not p.is_ghost:
                self.lobby.host_id = p.id
                return

    def _skip_disconnected_hints(self) -> None:
        """Auto-submit blank hints for any consecutive disconnected players whose turn it is."""
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
