from enum import Enum
from pydantic import BaseModel, Field


class GamePhase(str, Enum):
    LOBBY = "lobby"
    HINT = "hint"
    VOTING = "voting"
    ACCUSATION = "accusation"
    MORP_GUESS = "morp_guess"
    ROUND_END = "round_end"
    ENDGAME_2P = "endgame_2p"
    ENDGAME_ROUND_END = "endgame_round_end"
    ENDGAME_GHOST_HINTS = "endgame_ghost_hints"
    ENDGAME_GUESSING = "endgame_guessing"
    GAME_OVER = "game_over"


class Board(BaseModel):
    board_hint: str
    words: list[str]

    def half(self, seed: int, must_include: str) -> list[str]:
        """Return a deterministic random half of the word list.

        One slot is reserved for must_include (the target word) so the morp
        always has a chance to identify it from other players' hints.
        """
        import random
        rng = random.Random(seed)
        half_size = len(self.words) // 2
        others = [w for w in self.words if w != must_include]
        rng.shuffle(others)
        return others[: half_size - 1] + [must_include]


class Hint(BaseModel):
    player_id: str
    text: str = ""
    is_drawing: bool = False
    drawing_data: list | None = None


class RoundState(BaseModel):
    round_number: int
    board: Board
    target_word: str
    turn_order: list[str]           # player IDs in order
    current_turn_index: int = 0
    hints: list[Hint] = Field(default_factory=list)
    votes: dict[str, list[str]] = Field(default_factory=dict)  # voter_id -> [accused_id, ...]
    accused_ids: list[str] = Field(default_factory=list)
    phase: GamePhase = GamePhase.HINT

    def current_player_id(self) -> str | None:
        if self.current_turn_index < len(self.turn_order):
            return self.turn_order[self.current_turn_index]
        return None

    def all_hints_submitted(self) -> bool:
        submitted = {h.player_id for h in self.hints}
        return submitted == set(self.turn_order)


class EndgameRoundState(BaseModel):
    board: Board
    target_word: str
    ghost_hints: list[Hint] = Field(default_factory=list)
    guesses: dict[str, str] = Field(default_factory=dict)   # player_id -> guess text
    safe_player_id: str | None = None                        # set when someone guesses correctly


class GameState(BaseModel):
    lobby_id: str
    round_state: RoundState | None = None
    endgame_state: EndgameRoundState | None = None
    phase: GamePhase = GamePhase.LOBBY
    morp_guess_deadline: float | None = None  # unix timestamp
