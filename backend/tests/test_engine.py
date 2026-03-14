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
    with pytest.raises(ValueError, match="3 connected players"):
        engine.start_game(seed=1)


def test_cannot_start_with_fewer_than_3_connected_players():
    """3 players in lobby but one disconnected — must not start."""
    engine = GameEngine(lobby_id="x", num_morps=1)
    engine.add_player("p0", "Alice")
    engine.add_player("p1", "Bob")
    engine.add_player("p2", "Carol")
    engine.lobby.players["p2"].is_connected = False
    with pytest.raises(ValueError, match="3 connected players"):
        engine.start_game(seed=1)


def test_can_start_with_3_connected_and_1_disconnected():
    """4 players in lobby, 1 disconnected — should still start with the 3 connected."""
    engine = GameEngine(lobby_id="x", num_morps=1)
    for i in range(4):
        engine.add_player(f"p{i}", f"Player{i}")
    engine.lobby.players["p3"].is_connected = False
    engine.start_game(seed=1)
    assert engine.state.phase == GamePhase.HINT
    assert "p3" not in engine.state.round_state.turn_order


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


# --- Game reset ---

def test_reset_clears_started():
    engine = make_engine(num_players=3)
    engine.start_game(seed=1)
    engine.reset_game()
    assert engine.lobby.started is False


def test_reset_restores_player_hp():
    engine = make_engine(num_players=3)
    engine.start_game(seed=1)
    for p in engine.lobby.players.values():
        p.take_damage()
    engine.reset_game()
    for p in engine.lobby.players.values():
        assert p.hp == 3


def test_reset_clears_roles_and_ghosts():
    engine = make_engine(num_players=3)
    engine.start_game(seed=1)
    for p in engine.lobby.players.values():
        p.is_ghost = True
    engine.reset_game()
    for p in engine.lobby.players.values():
        assert p.role is None
        assert p.is_ghost is False


def test_reset_phase_returns_to_lobby():
    engine = make_engine(num_players=3)
    engine.start_game(seed=1)
    engine.reset_game()
    assert engine.state.phase == GamePhase.LOBBY


def test_reset_preserves_player_list():
    engine = make_engine(num_players=3)
    ids_before = set(engine.lobby.players.keys())
    engine.start_game(seed=1)
    engine.reset_game()
    assert set(engine.lobby.players.keys()) == ids_before


def test_can_start_new_game_after_reset():
    engine = make_engine(num_players=3)
    engine.start_game(seed=1)
    engine.reset_game()
    engine.start_game(seed=2)
    assert engine.lobby.started is True
    assert engine.state.phase == GamePhase.HINT
    assert engine.state.round_state.round_number == 1


# --- Disconnect / turn-order filtering ---

def test_disconnected_player_removed_from_lobby_at_start():
    """Player who disconnects before game start is purged from the lobby entirely."""
    engine = make_engine(num_players=4)
    engine.lobby.players["p1"].is_connected = False
    engine.start_game(seed=7)
    assert "p1" not in engine.lobby.players
    assert "p1" not in engine.state.round_state.turn_order


def test_connected_players_all_in_turn_order():
    """All connected players must appear in turn_order."""
    engine = make_engine(num_players=4)
    engine.lobby.players["p1"].is_connected = False
    engine.start_game(seed=7)
    turn_order = engine.state.round_state.turn_order
    for pid in ("p0", "p2", "p3"):
        assert pid in turn_order


def test_mid_game_disconnect_skips_disconnected_hint_turn():
    """If the current hint player disconnects, their turn is auto-skipped."""
    engine = make_engine(num_players=4)
    engine.start_game(seed=1)
    rs = engine.state.round_state
    # Disconnect whoever is up first
    first = rs.turn_order[0]
    engine.on_player_disconnect(first)
    # The skipped player should have a blank hint appended
    assert any(h.player_id == first and h.text == "" for h in rs.hints)
    # Turn should have advanced past the disconnected player
    assert rs.current_player_id() != first or engine.state.phase == GamePhase.VOTING


# --- Name uniqueness / reconnect ---

def test_duplicate_connected_name_raises():
    engine = make_engine(num_players=0)
    engine.add_player("p0", "Alice")
    with pytest.raises(ValueError, match="already taken"):
        engine.add_player("p1", "Alice")


def test_duplicate_name_check_is_case_insensitive():
    engine = make_engine(num_players=0)
    engine.add_player("p0", "Alice")
    with pytest.raises(ValueError, match="already taken"):
        engine.add_player("p1", "alice")


def test_duplicate_name_allowed_if_original_disconnected():
    """Once a player disconnects, their name slot frees up for reconnect lookup."""
    engine = make_engine(num_players=0)
    engine.add_player("p0", "Alice")
    engine.lobby.players["p0"].is_connected = False
    # Should not raise — disconnected player's name is available for reconnect
    result = engine.find_disconnected_by_name("Alice")
    assert result is not None
    assert result.id == "p0"


def test_find_disconnected_by_name_ignores_connected_players():
    engine = make_engine(num_players=0)
    engine.add_player("p0", "Alice")
    assert engine.find_disconnected_by_name("Alice") is None


def test_find_disconnected_by_name_case_insensitive():
    engine = make_engine(num_players=0)
    engine.add_player("p0", "Alice")
    engine.lobby.players["p0"].is_connected = False
    assert engine.find_disconnected_by_name("ALICE") is not None


def test_find_disconnected_by_name_returns_none_when_no_match():
    engine = make_engine(num_players=0)
    assert engine.find_disconnected_by_name("Ghost") is None


def test_reconnect_player_sets_is_connected():
    engine = make_engine(num_players=0)
    engine.add_player("p0", "Alice")
    engine.lobby.players["p0"].is_connected = False
    engine.reconnect_player("p0")
    assert engine.lobby.players["p0"].is_connected is True


# --- max_players enforcement ---

def test_lobby_full_raises_on_add():
    engine = GameEngine(lobby_id="x", num_morps=1)
    engine.lobby.config.max_players = 3
    for i in range(3):
        engine.add_player(f"p{i}", f"Player{i}")
    with pytest.raises(ValueError, match="full"):
        engine.add_player("p3", "Extra")


# --- morp_deal_damage phase guard ---

def test_morp_deal_damage_outside_accusation_raises():
    engine = make_engine(num_players=3)
    engine.start_game(seed=1)
    # Phase is HINT, not ACCUSATION
    with pytest.raises(ValueError, match="damage phase"):
        engine.morp_deal_damage("p0", "p1")


def test_morp_deal_damage_not_in_pending_raises():
    engine = make_engine(num_players=3)
    engine.start_game(seed=1)
    from backend.models.game import GamePhase
    engine.state.phase = GamePhase.ACCUSATION
    engine._pending_damage_morps = ["p1"]
    with pytest.raises(ValueError, match="not authorized"):
        engine.morp_deal_damage("p0", "p2")  # p0 not in pending


# --- kick player ---

def test_kick_in_lobby_removes_player():
    engine = make_engine(num_players=3)
    host = engine.lobby.host_id
    target = next(pid for pid in engine.lobby.players if pid != host)
    engine.kick_player(host, target)
    assert target not in engine.lobby.players


def test_kick_in_lobby_returns_true():
    engine = make_engine(num_players=3)
    host = engine.lobby.host_id
    target = next(pid for pid in engine.lobby.players if pid != host)
    assert engine.kick_player(host, target) is True


def test_kick_mid_game_returns_false():
    engine = make_engine(num_players=3)
    engine.start_game(seed=1)
    host = engine.lobby.host_id
    target = next(pid for pid in engine.lobby.players if pid != host)
    assert engine.kick_player(host, target) is False


def test_kick_mid_game_marks_disconnected():
    engine = make_engine(num_players=3)
    engine.start_game(seed=1)
    host = engine.lobby.host_id
    target = next(pid for pid in engine.lobby.players if pid != host)
    engine.kick_player(host, target)
    assert engine.lobby.players[target].is_connected is False


def test_kick_mid_game_player_stays_in_lobby():
    engine = make_engine(num_players=3)
    engine.start_game(seed=1)
    host = engine.lobby.host_id
    target = next(pid for pid in engine.lobby.players if pid != host)
    engine.kick_player(host, target)
    assert target in engine.lobby.players


def test_non_host_cannot_kick():
    engine = make_engine(num_players=3)
    host = engine.lobby.host_id
    non_host = next(pid for pid in engine.lobby.players if pid != host)
    third = next(pid for pid in engine.lobby.players if pid not in (host, non_host))
    with pytest.raises(ValueError, match="Only the host"):
        engine.kick_player(non_host, third)


def test_host_cannot_kick_themselves():
    engine = make_engine(num_players=3)
    host = engine.lobby.host_id
    with pytest.raises(ValueError, match="Cannot kick yourself"):
        engine.kick_player(host, host)


def test_kick_unknown_player_raises():
    engine = make_engine(num_players=3)
    host = engine.lobby.host_id
    with pytest.raises(ValueError, match="Player not found"):
        engine.kick_player(host, "nonexistent")


# --- host reassignment ---

def test_host_reassigned_when_host_disconnects():
    engine = make_engine(num_players=3)
    original_host = engine.lobby.host_id
    engine.on_player_disconnect(original_host)
    assert engine.lobby.host_id != original_host
    assert engine.lobby.players[engine.lobby.host_id].is_connected


def test_ghost_player_cannot_become_host():
    engine = make_engine(num_players=3)
    # Make p0 the host, make p1 a ghost, disconnect p0
    engine.lobby.host_id = "p0"
    engine.lobby.players["p1"].is_ghost = True
    engine.on_player_disconnect("p0")
    # Host must be p2 (not ghost p1)
    assert engine.lobby.host_id == "p2"


# --- voting: pre-start disconnect player is gone, voting completes normally ---

def test_voting_completes_after_pre_start_disconnect():
    """With a disconnected player purged at start, remaining players can complete voting."""
    engine = make_engine(num_players=4)
    engine.lobby.players["p3"].is_connected = False
    engine.start_game(seed=1)

    # p3 is gone — only p0, p1, p2 remain
    assert "p3" not in engine.lobby.players

    rs = engine.state.round_state
    for pid in rs.turn_order:
        engine.submit_hint(pid, "hint")
    assert engine.state.phase == GamePhase.VOTING

    remaining = list(engine.lobby.players.keys())
    for voter in remaining:
        target = next(pid for pid in remaining if pid != voter)
        engine.submit_votes(voter, [target])

    assert engine.state.phase == GamePhase.ACCUSATION


# --- New round purge ---

def test_disconnected_player_removed_from_lobby_at_new_round_start():
    """A player who disconnects mid-round is purged when the next round begins."""
    engine = make_engine(num_players=4)
    engine.start_game(seed=1)
    # Simulate mid-round disconnect
    engine.lobby.players["p1"].is_connected = False
    # Force engine to ROUND_END as if a round just finished
    engine.state.phase = GamePhase.ROUND_END
    engine.start_new_round(seed=2)
    assert "p1" not in engine.lobby.players
    assert "p1" not in engine.state.round_state.turn_order


def test_new_round_retains_connected_players():
    """Connected players survive into the next round."""
    engine = make_engine(num_players=4)
    engine.start_game(seed=1)
    engine.lobby.players["p1"].is_connected = False
    engine.state.phase = GamePhase.ROUND_END
    engine.start_new_round(seed=2)
    for pid in ("p0", "p2", "p3"):
        assert pid in engine.lobby.players
        assert pid in engine.state.round_state.turn_order


# --- get_half_board_for_morp edge case ---

def test_half_board_returns_none_when_turn_order_empty():
    engine = make_engine(num_players=3)
    engine.start_game(seed=1)
    # Force empty turn_order
    engine.state.round_state.turn_order = []
    assert engine.get_half_board_for_morp(seed=1) is None
