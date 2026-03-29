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


def test_start_endgame_round_sets_phase_to_ghost_hints():
    engine, _ = make_endgame_engine()
    assert engine.state.phase == GamePhase.ENDGAME_GHOST_HINTS


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
    assert engine.state.phase == GamePhase.ENDGAME_GHOST_HINTS  # timer drives transition


def test_non_ghost_cannot_submit_ghost_hint():
    engine, _ = make_endgame_engine()
    active = engine.lobby.active_players()
    with pytest.raises(ValueError, match="ghost"):
        engine.endgame_submit_ghost_hint(active[0].id, "sneak hint")


def _submit_both_guesses(engine, guess0, guess1, auto0=False, auto1=False):
    """Helper: submit guesses for both finalists and resolve."""
    active = engine.lobby.active_players()
    r0 = engine.endgame_submit_guess(active[0].id, guess0, auto_submitted=auto0)
    assert r0["all_in"] is False
    r1 = engine.endgame_submit_guess(active[1].id, guess1, auto_submitted=auto1)
    assert r1["all_in"] is True
    return engine.endgame_resolve_guesses()


def test_endgame_first_correct_guess_is_safe():
    engine, _ = make_endgame_engine()
    ghosts = [p for p in engine.lobby.players.values() if p.is_ghost]
    for i, g in enumerate(ghosts):
        engine.endgame_submit_ghost_hint(g.id, f"hint {i}")

    active = engine.lobby.active_players()
    target = engine.state.endgame_state.target_word
    es = engine.state.endgame_state
    wrong = next(w for w in es.board.words if w != es.target_word)
    resolution = _submit_both_guesses(engine, target, wrong)
    assert resolution["safe_player_id"] == active[0].id
    assert resolution["target_word"] == target
    # First result should be the first submitter (correct)
    assert resolution["results"][0]["correct"] is True
    assert resolution["results"][1]["correct"] is False


def test_endgame_correct_guess_does_not_damage_winner():
    engine, _ = make_endgame_engine()
    ghosts = [p for p in engine.lobby.players.values() if p.is_ghost]
    for i, g in enumerate(ghosts):
        engine.endgame_submit_ghost_hint(g.id, f"hint {i}")

    active = engine.lobby.active_players()
    hp_before = active[0].hp
    target = engine.state.endgame_state.target_word
    es = engine.state.endgame_state
    wrong = next(w for w in es.board.words if w != es.target_word)
    _submit_both_guesses(engine, target, wrong)
    assert active[0].hp == hp_before


def test_endgame_loser_takes_damage_after_correct_guess():
    engine, _ = make_endgame_engine()
    ghosts = [p for p in engine.lobby.players.values() if p.is_ghost]
    for i, g in enumerate(ghosts):
        engine.endgame_submit_ghost_hint(g.id, f"hint {i}")

    active = engine.lobby.active_players()
    hp_before = active[1].hp
    target = engine.state.endgame_state.target_word
    es = engine.state.endgame_state
    wrong = next(w for w in es.board.words if w != es.target_word)
    _submit_both_guesses(engine, target, wrong)
    assert active[1].hp == hp_before - 1


def test_endgame_submit_does_not_resolve_until_both_in():
    """Submitting one guess should NOT resolve or deal damage."""
    engine, _ = make_endgame_engine()
    ghosts = [p for p in engine.lobby.players.values() if p.is_ghost]
    for i, g in enumerate(ghosts):
        engine.endgame_submit_ghost_hint(g.id, f"hint {i}")

    active = engine.lobby.active_players()
    es = engine.state.endgame_state
    wrong = next(w for w in es.board.words if w != es.target_word)
    hp_before = [p.hp for p in active]

    result = engine.endgame_submit_guess(active[0].id, wrong)
    assert result["all_in"] is False
    # No damage yet, phase unchanged
    assert active[0].hp == hp_before[0]
    assert active[1].hp == hp_before[1]
    assert engine.state.phase in (GamePhase.ENDGAME_GHOST_HINTS, GamePhase.ENDGAME_GUESSING)


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


def test_endgame_guess_must_be_board_word():
    engine, _ = make_endgame_engine()
    ghosts = [p for p in engine.lobby.players.values() if p.is_ghost]
    for i, g in enumerate(ghosts):
        engine.endgame_submit_ghost_hint(g.id, f"hint {i}")

    active = engine.lobby.active_players()
    with pytest.raises(ValueError, match="word on the board"):
        engine.endgame_submit_guess(active[0].id, "notaboardword")


def test_endgame_empty_guess_allowed_for_timeout():
    engine, _ = make_endgame_engine()
    ghosts = [p for p in engine.lobby.players.values() if p.is_ghost]
    for i, g in enumerate(ghosts):
        engine.endgame_submit_ghost_hint(g.id, f"hint {i}")

    active = engine.lobby.active_players()
    result = engine.endgame_submit_guess(active[0].id, "")
    assert result["all_in"] is False  # opponent still hasn't guessed


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

    resolution = _submit_both_guesses(engine, wrong, wrong2)
    assert resolution["safe_player_id"] is None
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

    _submit_both_guesses(engine, wrong, wrong2)
    assert engine.state.phase == GamePhase.ENDGAME_ROUND_END


def test_endgame_both_correct_first_submitter_wins():
    """When both finalists guess correctly, the first to submit is safe."""
    engine, _ = make_endgame_engine()
    ghosts = [p for p in engine.lobby.players.values() if p.is_ghost]
    for i, g in enumerate(ghosts):
        engine.endgame_submit_ghost_hint(g.id, f"hint {i}")

    active = engine.lobby.active_players()
    target = engine.state.endgame_state.target_word
    hp_before = [p.hp for p in active]

    resolution = _submit_both_guesses(engine, target, target)
    assert resolution["safe_player_id"] == active[0].id
    assert active[0].hp == hp_before[0]       # winner untouched
    assert active[1].hp == hp_before[1] - 1   # slower player damaged


def test_endgame_both_auto_correct_is_draw():
    """Both auto-submitted correct answers → draw, no damage."""
    engine, _ = make_endgame_engine()
    active = engine.lobby.active_players()
    target = engine.state.endgame_state.target_word
    hp_before = [p.hp for p in active]

    resolution = _submit_both_guesses(engine, target, target, auto0=True, auto1=True)
    assert resolution["draw"] is True
    assert resolution["safe_player_id"] is None
    assert active[0].hp == hp_before[0]
    assert active[1].hp == hp_before[1]


def test_endgame_one_manual_one_auto_correct_not_draw():
    """One manual + one auto correct → first submitter wins, not a draw."""
    engine, _ = make_endgame_engine()
    active = engine.lobby.active_players()
    target = engine.state.endgame_state.target_word
    hp_before = [p.hp for p in active]

    resolution = _submit_both_guesses(engine, target, target, auto0=False, auto1=True)
    assert resolution["draw"] is False
    assert resolution["safe_player_id"] == active[0].id
    assert active[0].hp == hp_before[0]
    assert active[1].hp == hp_before[1] - 1


def test_endgame_both_auto_wrong_not_draw():
    """Both auto-submitted wrong answers → not a draw, both take damage."""
    engine, _ = make_endgame_engine()
    active = engine.lobby.active_players()
    es = engine.state.endgame_state
    wrong = next(w for w in es.board.words if w != es.target_word)
    wrong2 = next(w for w in es.board.words if w != es.target_word and w != wrong)
    hp_before = [p.hp for p in active]

    resolution = _submit_both_guesses(engine, wrong, wrong2, auto0=True, auto1=True)
    assert resolution["draw"] is False
    assert active[0].hp == hp_before[0] - 1
    assert active[1].hp == hp_before[1] - 1


def test_endgame_resolve_tracks_submission_order():
    """guess_order should reflect the order guesses were submitted."""
    engine, _ = make_endgame_engine()
    active = engine.lobby.active_players()
    target = engine.state.endgame_state.target_word
    es = engine.state.endgame_state
    wrong = next(w for w in es.board.words if w != es.target_word)

    # Submit in reverse order: active[1] first
    engine.endgame_submit_guess(active[1].id, wrong)
    engine.endgame_submit_guess(active[0].id, target)
    resolution = engine.endgame_resolve_guesses()

    assert resolution["results"][0]["player_id"] == active[1].id
    assert resolution["results"][1]["player_id"] == active[0].id
    assert resolution["safe_player_id"] == active[0].id


def test_start_next_endgame_round_resets_state():
    engine, _ = make_endgame_engine()
    ghosts = [p for p in engine.lobby.players.values() if p.is_ghost]
    for i, g in enumerate(ghosts):
        engine.endgame_submit_ghost_hint(g.id, f"hint {i}")

    active = engine.lobby.active_players()
    es = engine.state.endgame_state
    wrong = next(w for w in es.board.words if w != es.target_word)
    wrong2 = next(w for w in es.board.words if w != es.target_word and w != wrong)
    _submit_both_guesses(engine, wrong, wrong2)

    engine.start_next_endgame_round(seed=77)
    assert engine.state.phase == GamePhase.ENDGAME_GHOST_HINTS
    assert engine.state.endgame_state.ghost_hints == []
    assert engine.state.endgame_state.guesses == {}
    assert engine.state.endgame_state.guess_order == []


def test_endgame_end_hint_phase_transitions_to_guessing():
    engine, _ = make_endgame_engine()
    assert engine.state.phase == GamePhase.ENDGAME_GHOST_HINTS
    engine.endgame_end_hint_phase()
    assert engine.state.phase == GamePhase.ENDGAME_GUESSING


def test_endgame_guess_works_during_hint_phase():
    engine, _ = make_endgame_engine()
    active = engine.lobby.active_players()
    target = engine.state.endgame_state.target_word
    es = engine.state.endgame_state
    wrong = next(w for w in es.board.words if w != es.target_word)
    resolution = _submit_both_guesses(engine, target, wrong)
    assert resolution["safe_player_id"] == active[0].id


def test_endgame_timeout_both_take_damage():
    """Timeout with no guesses submitted — both take damage."""
    engine, _ = make_endgame_engine()
    active = engine.lobby.active_players()
    hp_before = [p.hp for p in active]
    resolution = engine.endgame_timeout()
    assert resolution["safe_player_id"] is None
    assert active[0].hp == hp_before[0] - 1
    assert active[1].hp == hp_before[1] - 1


def test_endgame_timeout_damages_player_who_already_guessed_wrong():
    """Player who guessed wrong should also take damage when the timer expires."""
    engine, _ = make_endgame_engine()
    active = engine.lobby.active_players()
    es = engine.state.endgame_state
    wrong = next(w for w in es.board.words if w != es.target_word)
    engine.endgame_submit_guess(active[0].id, wrong)  # active[0] guesses wrong
    hp_before = [p.hp for p in active]
    resolution = engine.endgame_timeout()  # active[1] never guesses
    assert resolution["safe_player_id"] is None
    assert active[0].hp == hp_before[0] - 1  # wrong-guesser also takes damage
    assert active[1].hp == hp_before[1] - 1


def test_endgame_timeout_with_one_correct_guess():
    """If one player guessed correctly but timer expires for the other, correct guesser wins."""
    engine, _ = make_endgame_engine()
    active = engine.lobby.active_players()
    target = engine.state.endgame_state.target_word
    hp_before = [p.hp for p in active]
    engine.endgame_submit_guess(active[0].id, target)  # correct guess
    resolution = engine.endgame_timeout()  # active[1] never guesses
    assert resolution["safe_player_id"] == active[0].id
    assert active[0].hp == hp_before[0]       # winner untouched
    assert active[1].hp == hp_before[1] - 1   # non-guesser damaged


# ── Hail Mary ────────────────────────────────────────────────────────────────

def _start_hint_phase(engine, seed=1):
    """Start game and return (morp_id, safe_ids, round_state)."""
    engine.start_game(seed=seed)
    morp_id = next(p.id for p in engine.lobby.players.values() if p.role == Role.MORP)
    safe_ids = [p.id for p in engine.lobby.players.values() if p.role == Role.SAFE]
    return morp_id, safe_ids, engine.state.round_state


def test_hail_mary_correct_guess_waits_for_damage():
    engine = make_engine(num_players=4)
    morp_id, safe_ids, rs = _start_hint_phase(engine)
    result = engine.submit_hail_mary(morp_id, rs.target_word)
    assert result["correct"] is True
    assert engine.state.phase == GamePhase.HINT  # still hint, awaiting damage target
    assert morp_id in engine._pending_damage_morps


def test_hail_mary_correct_then_damage_resolves_round():
    engine = make_engine(num_players=4)
    morp_id, safe_ids, rs = _start_hint_phase(engine)
    engine.submit_hail_mary(morp_id, rs.target_word)
    engine.hail_mary_deal_damage(morp_id, safe_ids[0])
    assert engine.state.phase == GamePhase.ROUND_END
    assert engine.lobby.players[safe_ids[0]].hp == 2
    assert engine.lobby.players[morp_id].hp == 3  # morp takes no damage


def test_hail_mary_wrong_guess_damages_morp_and_ends_round():
    engine = make_engine(num_players=4)
    morp_id, safe_ids, rs = _start_hint_phase(engine)
    wrong = next(w for w in rs.board.words if w != rs.target_word)
    result = engine.submit_hail_mary(morp_id, wrong)
    assert result["correct"] is False
    assert engine.state.phase == GamePhase.ROUND_END
    assert engine.lobby.players[morp_id].hp == 2


def test_hail_mary_stores_result_on_round_state():
    engine = make_engine(num_players=4)
    morp_id, safe_ids, rs = _start_hint_phase(engine)
    engine.submit_hail_mary(morp_id, rs.target_word)
    hm = rs.hail_mary_result
    assert hm is not None
    assert hm["morp_id"] == morp_id
    assert hm["correct"] is True
    assert hm["target_word"] == rs.target_word


def test_hail_mary_only_morp_can_attempt():
    engine = make_engine(num_players=4)
    morp_id, safe_ids, rs = _start_hint_phase(engine)
    with pytest.raises(ValueError, match="[Mm]orp"):
        engine.submit_hail_mary(safe_ids[0], rs.target_word)


def test_hail_mary_requires_hint_phase():
    engine = make_engine(num_players=4)
    run_through_hints(engine)
    assert engine.state.phase == GamePhase.VOTING
    morp_id = next(p.id for p in engine.lobby.players.values() if p.role == Role.MORP)
    with pytest.raises(ValueError, match="hint"):
        engine.submit_hail_mary(morp_id, "anything")


def test_hail_mary_guess_must_be_board_word():
    engine = make_engine(num_players=4)
    morp_id, safe_ids, rs = _start_hint_phase(engine)
    with pytest.raises(ValueError, match="board"):
        engine.submit_hail_mary(morp_id, "notaboardword")


def test_hail_mary_morp_cannot_damage_self():
    engine = make_engine(num_players=4)
    morp_id, safe_ids, rs = _start_hint_phase(engine)
    engine.submit_hail_mary(morp_id, rs.target_word)
    with pytest.raises(ValueError, match="yourself"):
        engine.hail_mary_deal_damage(morp_id, morp_id)


def test_hail_mary_damage_requires_correct_guess():
    engine = make_engine(num_players=4)
    morp_id, safe_ids, rs = _start_hint_phase(engine)
    wrong = next(w for w in rs.board.words if w != rs.target_word)
    engine.submit_hail_mary(morp_id, wrong)
    with pytest.raises(ValueError):
        engine.hail_mary_deal_damage(morp_id, safe_ids[0])


def test_hail_mary_disconnect_after_correct_resolves_round():
    engine = make_engine(num_players=4)
    morp_id, safe_ids, rs = _start_hint_phase(engine)
    engine.submit_hail_mary(morp_id, rs.target_word)
    assert engine.state.phase == GamePhase.HINT
    engine.on_player_disconnect(morp_id)
    assert engine.state.phase == GamePhase.ROUND_END


def test_hail_mary_can_trigger_endgame():
    """A hail mary kill that brings active players to 2 triggers endgame."""
    engine = make_engine(num_players=3)
    morp_id, safe_ids, rs = _start_hint_phase(engine)
    # Weaken a safe player to 1 HP
    engine.lobby.players[safe_ids[0]].hp = 1
    engine.submit_hail_mary(morp_id, rs.target_word)
    engine.hail_mary_deal_damage(morp_id, safe_ids[0])
    assert engine.lobby.players[safe_ids[0]].is_ghost
    assert engine.state.phase == GamePhase.ENDGAME_2P


def test_hail_mary_works_mid_hint_phase():
    """Morp can hail mary after some hints but before all are submitted."""
    engine = make_engine(num_players=4)
    engine.start_game(seed=1)
    rs = engine.state.round_state
    morp_id = next(p.id for p in engine.lobby.players.values() if p.role == Role.MORP)
    # Submit one hint first
    first_pid = rs.turn_order[0]
    engine.submit_hint(first_pid, "test")
    assert engine.state.phase == GamePhase.HINT
    # Morp hail marys
    result = engine.submit_hail_mary(morp_id, rs.target_word)
    assert result["correct"] is True
