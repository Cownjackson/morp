import pytest
from backend.game.board import BoardManager
from backend.models.game import Board


def make_board(words: list[str], hint: str = "test") -> Board:
    return Board(board_hint=hint, words=words)


def test_default_boards_load():
    bm = BoardManager()
    assert len(bm.boards) == 3


def test_default_boards_have_25_words():
    bm = BoardManager()
    for board in bm.boards:
        assert len(board.words) == 25


def test_select_board_returns_board_and_target():
    bm = BoardManager()
    board, target = bm.select_round(seed=42)
    assert target in board.words


def test_select_round_is_deterministic():
    bm = BoardManager()
    board1, target1 = bm.select_round(seed=99)
    board2, target2 = bm.select_round(seed=99)
    assert board1 == board2
    assert target1 == target2


def test_select_round_differs_with_different_seeds():
    bm = BoardManager()
    results = {bm.select_round(seed=i)[1] for i in range(20)}
    assert len(results) > 1  # not all the same target


def test_half_board_returns_roughly_half():
    board = make_board([f"word{i}" for i in range(25)])
    half = board.half(seed=7, must_include="word0")
    assert len(half) == 12  # floor(25/2)


def test_half_board_is_subset_of_full_board():
    board = make_board([f"word{i}" for i in range(25)])
    half = board.half(seed=7, must_include="word0")
    assert all(w in board.words for w in half)


def test_half_board_always_contains_target_word():
    board = make_board([f"word{i}" for i in range(25)])
    for seed in range(20):
        half = board.half(seed=seed, must_include="word13")
        assert "word13" in half


def test_half_board_is_deterministic():
    board = make_board([f"word{i}" for i in range(25)])
    assert board.half(seed=3, must_include="word0") == board.half(seed=3, must_include="word0")


def test_half_board_differs_with_different_seeds():
    board = make_board([f"word{i}" for i in range(25)])
    assert board.half(seed=1, must_include="word0") != board.half(seed=2, must_include="word0")


def test_add_custom_board():
    bm = BoardManager()
    custom = make_board(["a", "b", "c", "d", "e"], hint="custom")
    bm.add_board(custom)
    assert custom in bm.boards


def test_custom_board_json_validation_max():
    """Boards exceeding 100 words should be rejected."""
    from pydantic import ValidationError
    from backend.game.board import validate_custom_board
    words = [f"w{i}" for i in range(101)]
    with pytest.raises(ValueError, match="100"):
        validate_custom_board({"board_hint": "too big", "words": words})


def test_custom_board_json_validation_min():
    """Boards with 0 words should be rejected."""
    from backend.game.board import validate_custom_board
    with pytest.raises(ValueError, match="empty"):
        validate_custom_board({"board_hint": "empty", "words": []})
