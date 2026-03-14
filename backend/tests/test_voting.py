import pytest
from backend.game.voting import tally_votes, resolve_accusation
from backend.game.engine import GameEngine
from backend.models.game import GamePhase
from backend.models.player import Role


# --- tally_votes ---

def test_top_n_players_are_accused():
    votes = {
        "p0": ["p1", "p2"],
        "p1": ["p2", "p3"],
        "p2": ["p1", "p3"],
        "p3": ["p1", "p2"],
    }
    accused = tally_votes(votes, num_morps=2, seed=1)
    assert set(accused) == {"p1", "p2"}


def test_accused_count_equals_num_morps():
    votes = {
        "p0": ["p1"],
        "p1": ["p2"],
        "p2": ["p3"],
        "p3": ["p0"],
    }
    accused = tally_votes(votes, num_morps=1, seed=1)
    assert len(accused) == 1



def test_tie_broken_differently_with_different_seeds():
    votes = {
        "p0": ["p1"],
        "p1": ["p2"],
        "p2": ["p3"],
        "p3": ["p0"],
    }
    results = {tuple(tally_votes(votes, num_morps=1, seed=s)) for s in range(20)}
    assert len(results) > 1  # different seeds produce different tie-break outcomes


def test_no_self_votes_in_result():
    # Even if we construct a scenario, tally_votes only works on valid submitted votes
    votes = {"p0": ["p1"], "p1": ["p0"], "p2": ["p0"]}
    accused = tally_votes(votes, num_morps=1, seed=1)
    assert "p2" not in accused  # p2 had 0 votes


# --- Engine voting integration ---

def make_engine_at_voting(num_players=4, num_morps=1, seed=1):
    engine = GameEngine(lobby_id="test", num_morps=num_morps)
    for i in range(num_players):
        engine.add_player(f"p{i}", f"Player{i}")
    engine.start_game(seed=seed)
    rs = engine.state.round_state
    for pid in rs.turn_order:
        engine.submit_hint(pid, f"hint-{pid}")
    assert engine.state.phase == GamePhase.VOTING
    return engine


def vote_all_for(engine, target_id):
    """Have every active player vote for target_id (target votes for someone else)."""
    active = engine.lobby.active_players()
    fallback = next(p.id for p in active if p.id != target_id)
    for p in active:
        engine.submit_votes(p.id, [target_id if p.id != target_id else fallback])


def test_player_cannot_vote_for_themselves():
    engine = make_engine_at_voting()
    with pytest.raises(ValueError, match="yourself"):
        engine.submit_votes("p0", ["p0"])


def test_player_must_cast_exactly_n_votes():
    engine = make_engine_at_voting(num_morps=1)
    with pytest.raises(ValueError, match="1 vote"):
        engine.submit_votes("p0", ["p1", "p2"])


def test_player_cannot_vote_for_nonexistent_player():
    engine = make_engine_at_voting()
    with pytest.raises(ValueError, match="not in game"):
        engine.submit_votes("p0", ["ghost_id"])


def test_all_votes_submitted_transitions_to_accusation():
    engine = make_engine_at_voting(num_players=4, num_morps=1)
    active = engine.lobby.active_players()
    for player in active:
        others = [p.id for p in active if p.id != player.id]
        engine.submit_votes(player.id, [others[0]])
    assert engine.state.phase == GamePhase.ACCUSATION


def test_accused_ids_populated_after_voting():
    engine = make_engine_at_voting(num_players=4, num_morps=1)
    active = engine.lobby.active_players()
    # All vote for p0 except p0 (ensure p0 is accused)
    target = active[0].id
    for player in active:
        vote_for = target if player.id != target else [p for p in active if p.id != target][0].id
        engine.submit_votes(player.id, [vote_for])
    assert len(engine.state.round_state.accused_ids) == 1


# --- resolve_accusation ---

def test_no_morp_accused_returns_morp_damage_phase():
    engine = make_engine_at_voting(num_players=4, num_morps=1, seed=1)
    safe_ids = [p.id for p in engine.lobby.players.values() if p.role == Role.SAFE]

    vote_all_for(engine, safe_ids[0])
    result = engine.resolve_accusation()
    assert result["morp_gets_to_damage"] is True


def test_morp_accused_returns_morp_guess_phase():
    engine = make_engine_at_voting(num_players=4, num_morps=1, seed=1)
    morp_id = next(p.id for p in engine.lobby.players.values() if p.role == Role.MORP)

    vote_all_for(engine, morp_id)
    result = engine.resolve_accusation()
    assert result["morp_must_guess"] is True
    assert engine.state.phase == GamePhase.MORP_GUESS


def test_non_accused_player_cannot_submit_guess():
    engine = make_engine_at_voting(num_players=4, num_morps=1, seed=1)
    rs = engine.state.round_state
    morp_id = next(p.id for p in engine.lobby.players.values() if p.role == Role.MORP)
    safe_ids = [p.id for p in engine.lobby.players.values() if p.role == Role.SAFE]

    vote_all_for(engine, morp_id)
    engine.resolve_accusation()

    with pytest.raises(ValueError, match="accused morp"):
        engine.submit_morp_guess(safe_ids[0], rs.target_word)


def test_morp_correct_guess_takes_no_damage():
    engine = make_engine_at_voting(num_players=4, num_morps=1, seed=1)
    rs = engine.state.round_state
    morp_id = next(p.id for p in engine.lobby.players.values() if p.role == Role.MORP)

    vote_all_for(engine, morp_id)
    engine.resolve_accusation()

    hp_before = engine.lobby.players[morp_id].hp
    engine.submit_morp_guess(morp_id, rs.target_word)
    assert engine.lobby.players[morp_id].hp == hp_before


def test_morp_wrong_guess_takes_damage():
    engine = make_engine_at_voting(num_players=4, num_morps=1, seed=1)
    rs = engine.state.round_state
    morp_id = next(p.id for p in engine.lobby.players.values() if p.role == Role.MORP)

    vote_all_for(engine, morp_id)
    engine.resolve_accusation()

    hp_before = engine.lobby.players[morp_id].hp
    wrong_word = next(w for w in rs.board.words if w != rs.target_word)
    engine.submit_morp_guess(morp_id, wrong_word)
    assert engine.lobby.players[morp_id].hp == hp_before - 1


def test_no_morp_accused_morp_deals_damage():
    engine = make_engine_at_voting(num_players=4, num_morps=1, seed=1)
    morp_id = next(p.id for p in engine.lobby.players.values() if p.role == Role.MORP)
    safe_ids = [p.id for p in engine.lobby.players.values() if p.role == Role.SAFE]

    vote_all_for(engine, safe_ids[0])
    engine.resolve_accusation()

    target_id = safe_ids[1]
    hp_before = engine.lobby.players[target_id].hp
    engine.morp_deal_damage(morp_id, target_id)
    assert engine.lobby.players[target_id].hp == hp_before - 1


def test_morp_cannot_damage_self():
    engine = make_engine_at_voting(num_players=4, num_morps=1, seed=1)
    morp_id = next(p.id for p in engine.lobby.players.values() if p.role == Role.MORP)
    safe_ids = [p.id for p in engine.lobby.players.values() if p.role == Role.SAFE]

    vote_all_for(engine, safe_ids[0])
    engine.resolve_accusation()

    with pytest.raises(ValueError, match="yourself"):
        engine.morp_deal_damage(morp_id, morp_id)


def test_player_eliminated_becomes_ghost():
    engine = make_engine_at_voting(num_players=4, num_morps=1, seed=1)
    morp_id = next(p.id for p in engine.lobby.players.values() if p.role == Role.MORP)
    safe_ids = [p.id for p in engine.lobby.players.values() if p.role == Role.SAFE]

    engine.lobby.players[safe_ids[0]].hp = 1  # one hit from elimination

    vote_all_for(engine, safe_ids[1])
    engine.resolve_accusation()
    engine.morp_deal_damage(morp_id, safe_ids[0])

    assert engine.lobby.players[safe_ids[0]].is_ghost is True


def test_two_active_players_triggers_endgame():
    engine = make_engine_at_voting(num_players=3, num_morps=1, seed=1)
    morp_id = next(p.id for p in engine.lobby.players.values() if p.role == Role.MORP)
    safe_ids = [p.id for p in engine.lobby.players.values() if p.role == Role.SAFE]

    # Set safe_ids[0] to 1 HP so damage kills them, leaving only 2 active
    engine.lobby.players[safe_ids[0]].hp = 1

    vote_all_for(engine, safe_ids[1])  # accuse a safe player (wrong accusation)
    engine.resolve_accusation()
    engine.morp_deal_damage(morp_id, safe_ids[0])

    assert engine.state.phase == GamePhase.ENDGAME_2P
