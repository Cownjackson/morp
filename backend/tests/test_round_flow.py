"""Tests for new-round transitions and 2-player endgame."""
import pytest
from backend.game.engine import GameEngine
from backend.models.game import GamePhase
from backend.models.player import Role


# ── Helpers ──────────────────────────────────────────────────────────────────

def make_engine(num_players=4, num_morps=1, timers_enabled=False):
    engine = GameEngine(lobby_id="test", num_morps=num_morps, timers_enabled=timers_enabled)
    for i in range(num_players):
        engine.add_player(f"p{i}", f"Player{i}")
    return engine


def run_through_hints(engine, seed=1):
    engine.start_game(seed=seed)
    rs = engine.state.round_state
    for pid in rs.turn_order:
        engine.submit_hint(pid, f"hint-{pid}")


def run_through_votes(engine, seed=1, accuse=None):
    """Run hints then have everyone vote for `accuse` (or the first player if None)."""
    run_through_hints(engine, seed=seed)
    rs = engine.state.round_state
    active = engine.lobby.active_players()
    target = accuse or active[0].id
    for p in active:
        vote_for = target if p.id != target else [x for x in active if x.id != target][0].id
        engine.submit_votes(p.id, [vote_for])


def accuse_safe_player(engine):
    """Vote to accuse a safe player so the morp gets to deal damage."""
    safe_ids = [p.id for p in engine.lobby.players.values() if p.role == Role.SAFE]
    active = engine.lobby.active_players()
    target = safe_ids[0]
    fallback = next(p.id for p in active if p.id != target)
    for p in active:
        engine.submit_votes(p.id, [target if p.id != target else fallback])
    result = engine.resolve_accusation()
    return result, safe_ids


def accuse_morp(engine):
    """Vote to accuse the morp."""
    morp_id = next(p.id for p in engine.lobby.players.values() if p.role == Role.MORP)
    active = engine.lobby.active_players()
    fallback = next(p.id for p in active if p.id != morp_id)
    for p in active:
        engine.submit_votes(p.id, [morp_id if p.id != morp_id else fallback])
    result = engine.resolve_accusation()
    return result, morp_id


# ── New round after damage ────────────────────────────────────────────────────

def test_damage_phase_transitions_to_round_end_when_all_morps_done():
    engine = make_engine(num_players=4)
    run_through_hints(engine)
    result, safe_ids = accuse_safe_player(engine)
    morp_id = next(p.id for p in engine.lobby.players.values() if p.role == Role.MORP)
    all_done = engine.morp_deal_damage(morp_id, safe_ids[1])
    assert all_done is True
    assert engine.state.phase == GamePhase.ROUND_END


def test_morp_guess_correct_transitions_to_round_end():
    engine = make_engine(num_players=4)
    run_through_hints(engine)
    result, morp_id = accuse_morp(engine)
    rs = engine.state.round_state
    engine.submit_morp_guess(morp_id, rs.target_word)
    assert engine.state.phase == GamePhase.ROUND_END


def test_morp_guess_wrong_transitions_to_round_end():
    engine = make_engine(num_players=4)
    run_through_hints(engine)
    result, morp_id = accuse_morp(engine)
    rs = engine.state.round_state
    wrong = next(w for w in rs.board.words if w != rs.target_word)
    engine.submit_morp_guess(morp_id, wrong)
    assert engine.state.phase == GamePhase.ROUND_END


def test_start_new_round_increments_round_number():
    engine = make_engine(num_players=4)
    run_through_hints(engine)
    accuse_safe_player(engine)
    morp_id = next(p.id for p in engine.lobby.players.values() if p.role == Role.MORP)
    safe_ids = [p.id for p in engine.lobby.players.values() if p.role == Role.SAFE]
    engine.morp_deal_damage(morp_id, safe_ids[1])
    assert engine.state.phase == GamePhase.ROUND_END
    engine.start_new_round(seed=99)
    assert engine.state.round_state.round_number == 2
    assert engine.state.phase == GamePhase.HINT


def test_new_round_assigns_new_roles():
    engine = make_engine(num_players=4)
    run_through_hints(engine, seed=1)
    morp_before = next(p.id for p in engine.lobby.players.values() if p.role == Role.MORP)
    accuse_safe_player(engine)
    safe_ids = [p.id for p in engine.lobby.players.values() if p.role == Role.SAFE]
    engine.morp_deal_damage(morp_before, safe_ids[1])
    engine.start_new_round(seed=99)
    morp_after = next(p.id for p in engine.lobby.players.values() if p.role == Role.MORP)
    # With different seeds the morp may change — run enough seeds to confirm it can vary
    morps = set()
    for s in range(20):
        e = make_engine(num_players=4)
        run_through_hints(e, seed=1)
        accuse_safe_player(e)
        sid = [p.id for p in e.lobby.players.values() if p.role == Role.SAFE]
        mid = next(p.id for p in e.lobby.players.values() if p.role == Role.MORP)
        e.morp_deal_damage(mid, sid[1])
        e.start_new_round(seed=s)
        morps.add(next(p.id for p in e.lobby.players.values() if p.role == Role.MORP))
    assert len(morps) > 1


def test_multi_morp_damage_all_must_deal_before_round_end():
    engine = make_engine(num_players=5, num_morps=2)
    run_through_hints(engine)
    morp_ids = [p.id for p in engine.lobby.players.values() if p.role == Role.MORP]
    safe_ids = [p.id for p in engine.lobby.players.values() if p.role == Role.SAFE]
    active = engine.lobby.active_players()
    # Each player votes for 2 safe players (no self-votes), keeping morps un-accused
    for p in active:
        picks = [sid for sid in safe_ids if sid != p.id][:2]
        engine.submit_votes(p.id, picks)
    engine.resolve_accusation()

    # First morp deals damage — not done yet
    done = engine.morp_deal_damage(morp_ids[0], safe_ids[1])
    assert done is False
    assert engine.state.phase != GamePhase.ROUND_END

    # Second morp deals damage — now done
    done = engine.morp_deal_damage(morp_ids[1], safe_ids[2])
    assert done is True
    assert engine.state.phase == GamePhase.ROUND_END


def test_elimination_during_damage_can_trigger_endgame():
    engine = make_engine(num_players=3)
    run_through_hints(engine)
    morp_id = next(p.id for p in engine.lobby.players.values() if p.role == Role.MORP)
    safe_ids = [p.id for p in engine.lobby.players.values() if p.role == Role.SAFE]
    active = engine.lobby.active_players()
    fallback = next(p.id for p in active if p.id != safe_ids[0])
    for p in active:
        engine.submit_votes(p.id, [safe_ids[0] if p.id != safe_ids[0] else fallback])
    engine.resolve_accusation()

    # Set last safe player to 1 HP so damage kills them
    engine.lobby.players[safe_ids[1]].hp = 1
    engine.morp_deal_damage(morp_id, safe_ids[1])
    assert engine.state.phase == GamePhase.ENDGAME_2P


# ── 2-Player Endgame ─────────────────────────────────────────────────────────

def make_endgame_engine():
    """Create an engine already in 2-player endgame."""
    engine = make_engine(num_players=4)
    # Eliminate 2 players manually
    players = list(engine.lobby.players.values())
    players[0].is_ghost = True
    players[1].is_ghost = True
    engine.state.phase = GamePhase.ENDGAME_2P
    engine.start_endgame_round(seed=42)
    return engine, players


def test_start_endgame_round_sets_phase_to_guessing():
    engine, _ = make_endgame_engine()
    assert engine.state.phase == GamePhase.ENDGAME_GUESSING


def test_start_endgame_round_both_finalists_are_morp():
    engine, players = make_endgame_engine()
    active = engine.lobby.active_players()
    assert all(p.role == Role.MORP for p in active)


def test_start_endgame_round_finalists_cannot_see_target():
    engine, players = make_endgame_engine()
    # target is stored in endgame_state, not sent to morps — engine holds it
    assert engine.state.endgame_state.target_word is not None


def test_ghost_can_submit_hint():
    engine, players = make_endgame_engine()
    ghost = next(p for p in engine.lobby.players.values() if p.is_ghost)
    all_in = engine.endgame_submit_ghost_hint(ghost.id, "spooky hint")
    assert not all_in  # only 1 of 2 ghosts submitted


def test_all_ghosts_submitted_returns_all_in():
    engine, players = make_endgame_engine()
    ghosts = [p for p in engine.lobby.players.values() if p.is_ghost]
    for i, g in enumerate(ghosts):
        all_in = engine.endgame_submit_ghost_hint(g.id, f"hint {i}")
    assert all_in
    assert engine.state.phase == GamePhase.ENDGAME_GUESSING


def test_non_ghost_cannot_submit_ghost_hint():
    engine, _ = make_endgame_engine()
    active = engine.lobby.active_players()
    with pytest.raises(ValueError, match="ghost"):
        engine.endgame_submit_ghost_hint(active[0].id, "sneak hint")


def test_endgame_first_correct_guess_is_safe():
    engine, _ = make_endgame_engine()
    ghosts = [p for p in engine.lobby.players.values() if p.is_ghost]
    for i, g in enumerate(ghosts):
        engine.endgame_submit_ghost_hint(g.id, f"hint {i}")

    active = engine.lobby.active_players()
    target = engine.state.endgame_state.target_word
    result = engine.endgame_submit_guess(active[0].id, target)
    assert result["correct"] is True
    assert result["round_over"] is True
    assert engine.state.endgame_state.safe_player_id == active[0].id


def test_endgame_correct_guess_does_not_damage_winner():
    engine, _ = make_endgame_engine()
    ghosts = [p for p in engine.lobby.players.values() if p.is_ghost]
    for i, g in enumerate(ghosts):
        engine.endgame_submit_ghost_hint(g.id, f"hint {i}")

    active = engine.lobby.active_players()
    hp_before = active[0].hp
    target = engine.state.endgame_state.target_word
    engine.endgame_submit_guess(active[0].id, target)
    assert active[0].hp == hp_before


def test_endgame_loser_takes_damage_after_correct_guess():
    engine, _ = make_endgame_engine()
    ghosts = [p for p in engine.lobby.players.values() if p.is_ghost]
    for i, g in enumerate(ghosts):
        engine.endgame_submit_ghost_hint(g.id, f"hint {i}")

    active = engine.lobby.active_players()
    hp_before = active[1].hp
    target = engine.state.endgame_state.target_word
    engine.endgame_submit_guess(active[0].id, target)
    assert active[1].hp == hp_before - 1


def test_endgame_wrong_guess_does_not_block_opponent():
    engine, _ = make_endgame_engine()
    ghosts = [p for p in engine.lobby.players.values() if p.is_ghost]
    for i, g in enumerate(ghosts):
        engine.endgame_submit_ghost_hint(g.id, f"hint {i}")

    active = engine.lobby.active_players()
    es = engine.state.endgame_state
    wrong = next(w for w in engine.state.endgame_state.board.words if w != es.target_word)

    result = engine.endgame_submit_guess(active[0].id, wrong)
    assert result["correct"] is False
    assert result["round_over"] is False
    assert engine.state.phase == GamePhase.ENDGAME_GUESSING  # still going


def test_endgame_wrong_guess_cannot_guess_again():
    engine, _ = make_endgame_engine()
    ghosts = [p for p in engine.lobby.players.values() if p.is_ghost]
    for i, g in enumerate(ghosts):
        engine.endgame_submit_ghost_hint(g.id, f"hint {i}")

    active = engine.lobby.active_players()
    es = engine.state.endgame_state
    wrong = next(w for w in es.board.words if w != es.target_word)
    engine.endgame_submit_guess(active[0].id, wrong)

    with pytest.raises(ValueError, match="already guessed"):
        engine.endgame_submit_guess(active[0].id, es.target_word)


def test_endgame_both_wrong_both_take_damage():
    engine, _ = make_endgame_engine()
    ghosts = [p for p in engine.lobby.players.values() if p.is_ghost]
    for i, g in enumerate(ghosts):
        engine.endgame_submit_ghost_hint(g.id, f"hint {i}")

    active = engine.lobby.active_players()
    es = engine.state.endgame_state
    wrong = next(w for w in es.board.words if w != es.target_word)
    wrong2 = next(w for w in es.board.words if w != es.target_word and w != wrong)
    hp_before = [p.hp for p in active]

    engine.endgame_submit_guess(active[0].id, wrong)
    engine.endgame_submit_guess(active[1].id, wrong2)

    assert active[0].hp == hp_before[0] - 1
    assert active[1].hp == hp_before[1] - 1


def test_endgame_both_wrong_triggers_endgame_round_end():
    engine, _ = make_endgame_engine()
    ghosts = [p for p in engine.lobby.players.values() if p.is_ghost]
    for i, g in enumerate(ghosts):
        engine.endgame_submit_ghost_hint(g.id, f"hint {i}")

    active = engine.lobby.active_players()
    es = engine.state.endgame_state
    wrong = next(w for w in es.board.words if w != es.target_word)
    wrong2 = next(w for w in es.board.words if w != es.target_word and w != wrong)

    engine.endgame_submit_guess(active[0].id, wrong)
    engine.endgame_submit_guess(active[1].id, wrong2)
    assert engine.state.phase == GamePhase.ENDGAME_ROUND_END  # main.py triggers next round


def test_start_next_endgame_round_resets_state():
    engine, _ = make_endgame_engine()
    ghosts = [p for p in engine.lobby.players.values() if p.is_ghost]
    for i, g in enumerate(ghosts):
        engine.endgame_submit_ghost_hint(g.id, f"hint {i}")

    active = engine.lobby.active_players()
    es = engine.state.endgame_state
    wrong = next(w for w in es.board.words if w != es.target_word)
    wrong2 = next(w for w in es.board.words if w != es.target_word and w != wrong)
    engine.endgame_submit_guess(active[0].id, wrong)
    engine.endgame_submit_guess(active[1].id, wrong2)

    engine.start_next_endgame_round(seed=77)
    assert engine.state.phase == GamePhase.ENDGAME_GUESSING
    assert engine.state.endgame_state.ghost_hints == []
    assert engine.state.endgame_state.guesses == {}


def test_endgame_timeout_both_take_damage():
    engine, _ = make_endgame_engine()
    ghosts = [p for p in engine.lobby.players.values() if p.is_ghost]
    for i, g in enumerate(ghosts):
        engine.endgame_submit_ghost_hint(g.id, f"hint {i}")

    active = engine.lobby.active_players()
    hp_before = [p.hp for p in active]
    engine.endgame_timeout()
    assert active[0].hp == hp_before[0] - 1
    assert active[1].hp == hp_before[1] - 1
