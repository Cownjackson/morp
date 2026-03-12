import pytest
from backend.game.engine import GameEngine
from backend.models.game import GamePhase
from backend.models.player import Role


def make_engine(num_players: int = 4, num_morps: int = 1) -> GameEngine:
    engine = GameEngine(lobby_id="test-lobby", num_morps=num_morps)
    for i in range(num_players):
        engine.add_player(f"p{i}", f"Player{i}")
    return engine


# --- Lobby / start ---

def test_cannot_start_with_fewer_than_3_players():
    engine = GameEngine(lobby_id="x", num_morps=1)
    engine.add_player("p0", "Alice")
    engine.add_player("p1", "Bob")
    with pytest.raises(ValueError, match="3 players"):
        engine.start_game(seed=1)


def test_can_start_with_3_players():
    engine = make_engine(num_players=3)
    engine.start_game(seed=1)
    assert engine.state.phase == GamePhase.HINT


def test_correct_number_of_morps_assigned():
    engine = make_engine(num_players=5, num_morps=2)
    engine.start_game(seed=42)
    morps = [p for p in engine.lobby.players.values() if p.role == Role.MORP]
    assert len(morps) == 2


def test_correct_number_of_safe_players_assigned():
    engine = make_engine(num_players=5, num_morps=2)
    engine.start_game(seed=42)
    safe = [p for p in engine.lobby.players.values() if p.role == Role.SAFE]
    assert len(safe) == 3


def test_morp_roles_differ_per_seed():
    engine1 = make_engine(num_players=5, num_morps=1)
    engine1.start_game(seed=1)
    engine2 = make_engine(num_players=5, num_morps=1)
    engine2.start_game(seed=99)
    morp1 = next(p.id for p in engine1.lobby.players.values() if p.role == Role.MORP)
    morp2 = next(p.id for p in engine2.lobby.players.values() if p.role == Role.MORP)
    # With 5 players and different seeds, morps won't always be the same
    # (this is probabilistic but reliable over a range)
    results = set()
    for s in range(20):
        e = make_engine(num_players=5, num_morps=1)
        e.start_game(seed=s)
        results.add(next(p.id for p in e.lobby.players.values() if p.role == Role.MORP))
    assert len(results) > 1


# --- Turn order ---

def test_turn_order_contains_all_active_players():
    engine = make_engine(num_players=4)
    engine.start_game(seed=1)
    rs = engine.state.round_state
    active_ids = {p.id for p in engine.lobby.active_players()}
    assert set(rs.turn_order) == active_ids


def test_turn_order_is_randomized_per_seed():
    orders = set()
    for s in range(20):
        engine = make_engine(num_players=4)
        engine.start_game(seed=s)
        orders.add(tuple(engine.state.round_state.turn_order))
    assert len(orders) > 1


# --- Half-board accommodation ---

def test_morp_first_in_order_gets_half_board():
    for seed in range(50):
        engine = make_engine(num_players=4, num_morps=1)
        engine.start_game(seed=seed)
        rs = engine.state.round_state
        first_player = engine.lobby.players[rs.turn_order[0]]
        if first_player.role == Role.MORP:
            half = engine.get_half_board_for_morp(seed=seed)
            assert len(half) > 0
            assert all(w in rs.board.words for w in half)
            return  # found and validated the case
    pytest.skip("No seed in range produced morp-first — increase range")


def test_morp_first_half_board_contains_target_word():
    for seed in range(50):
        engine = make_engine(num_players=4, num_morps=1)
        engine.start_game(seed=seed)
        rs = engine.state.round_state
        first_player = engine.lobby.players[rs.turn_order[0]]
        if first_player.role == Role.MORP:
            half = engine.get_half_board_for_morp(seed=seed)
            assert rs.target_word in half
            return
    pytest.skip("No seed in range produced morp-first — increase range")


def test_morp_not_first_gets_no_half_board():
    for seed in range(50):
        engine = make_engine(num_players=4, num_morps=1)
        engine.start_game(seed=seed)
        rs = engine.state.round_state
        first_player = engine.lobby.players[rs.turn_order[0]]
        if first_player.role == Role.SAFE:
            assert engine.get_half_board_for_morp(seed=seed) is None
            return
    pytest.skip("No seed in range produced safe-first — increase range")


# --- Hint submission ---

def test_submit_hint_advances_turn():
    engine = make_engine(num_players=3)
    engine.start_game(seed=1)
    rs = engine.state.round_state
    first_pid = rs.turn_order[0]
    engine.submit_hint(first_pid, "my clue")
    assert rs.current_turn_index == 1


def test_submit_hint_out_of_turn_raises():
    engine = make_engine(num_players=3)
    engine.start_game(seed=1)
    rs = engine.state.round_state
    wrong_pid = rs.turn_order[1]
    with pytest.raises(ValueError, match="not your turn"):
        engine.submit_hint(wrong_pid, "sneaky clue")


def test_all_hints_submitted_transitions_to_voting():
    engine = make_engine(num_players=3)
    engine.start_game(seed=1)
    rs = engine.state.round_state
    for pid in rs.turn_order:
        engine.submit_hint(pid, f"hint from {pid}")
    assert engine.state.phase == GamePhase.VOTING


# --- Phase state ---

def test_initial_phase_is_lobby():
    engine = GameEngine(lobby_id="x", num_morps=1)
    assert engine.state.phase == GamePhase.LOBBY


def test_phase_is_hint_after_start():
    engine = make_engine(num_players=3)
    engine.start_game(seed=1)
    assert engine.state.phase == GamePhase.HINT
