import json
import random
from pathlib import Path

from backend.models.game import Board

_BOARDS_PATH = Path(__file__).parent.parent / "boards" / "default_boards.json"


def validate_custom_board(data: dict) -> Board:
    if not data.get("board_hint", "").strip():
        raise ValueError("Board must have a non-empty 'board_hint'.")
    words = data.get("words", [])
    if len(words) == 0:
        raise ValueError("Board must have at least 1 word.")
    if len(words) > 100:
        raise ValueError(f"Board exceeds maximum of 100 words (got {len(words)}).")
    if not all(isinstance(w, str) and w.strip() for w in words):
        raise ValueError("All board words must be non-empty strings.")
    return Board(board_hint=data["board_hint"], words=words)


class BoardManager:
    def __init__(self, extra_boards: list[Board] | None = None):
        self.boards: list[Board] = self._load_defaults()
        if extra_boards:
            self.boards.extend(extra_boards)

    def _load_defaults(self) -> list[Board]:
        with open(_BOARDS_PATH) as f:
            raw = json.load(f)
        return [Board(**b) for b in raw]

    def add_board(self, board: Board) -> None:
        self.boards.append(board)

    def set_custom_boards(self, boards: list[Board]) -> None:
        """Replace the entire board pool with the provided boards."""
        self.boards = boards[:]

    def select_round(self, seed: int) -> tuple[Board, str]:
        """Deterministically select a board and target word for a round."""
        rng = random.Random(seed)
        board = rng.choice(self.boards)
        target = rng.choice(board.words)
        return board, target
