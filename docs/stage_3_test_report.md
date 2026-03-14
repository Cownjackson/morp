# Stage 3 Test Report

**Date:** 2026-03-13
**Suite:** `backend/tests/`
**Result:** 155 passed, 0 failed (3.53s)

---

## Summary

All 155 tests pass. The suite has solid coverage of the board, connection manager, lobby management, WebSocket API, and most engine validation paths. However, a recurring pattern across `test_voting.py`, `test_round_flow.py`, and `test_engine.py` short-circuits the game flow by directly manipulating internal state — bypassing the very mechanics those tests are supposed to verify. These tests pass, but they don't catch bugs in the transitions they skip.

| File | Tests | Status |
|---|---|---|
| test_board.py | 20 | Clean |
| test_connection_manager.py | 5 | Clean |
| test_engine.py | 55 | Mostly clean — 3 issues |
| test_round_flow.py | 24 | Issues in helpers and endgame section |
| test_voting.py | 19 | Issues in `resolve_accusation` block |
| test_websocket.py | 32 | Clean |

---

## Issues

### Issue 1 — `accused_ids` injected directly instead of going through voting

**Severity: High**
**Affected files:** `test_voting.py`, `test_round_flow.py`

Thirteen tests skip the vote-submission flow entirely and reach the accusation phase by directly writing into `rs.accused_ids` and forcing `engine.state.phase = GamePhase.ACCUSATION`:

```python
# test_voting.py – repeated pattern across lines 124, 135, 148, 160, 173, 189, 205, 222, 239
rs.accused_ids = [safe_ids[0]]
engine.state.phase = GamePhase.ACCUSATION
result = engine.resolve_accusation()
```

The same shortcut is codified in two shared helpers in `test_round_flow.py` (lines 35–52):

```python
def accuse_safe_player(engine):
    rs = engine.state.round_state
    safe_ids = [p.id for p in engine.lobby.players.values() if p.role == Role.SAFE]
    rs.accused_ids = [safe_ids[0]]           # ← direct write
    engine.state.phase = GamePhase.ACCUSATION # ← direct write
    return engine.resolve_accusation(), safe_ids

def accuse_morp(engine):
    ...
    rs.accused_ids = [morp_id]
    engine.state.phase = GamePhase.ACCUSATION
```

These helpers are used by `test_damage_phase_transitions_to_round_end_when_all_morps_done`, `test_morp_guess_correct_transitions_to_round_end`, `test_morp_guess_wrong_transitions_to_round_end`, `test_start_new_round_increments_round_number`, `test_new_round_assigns_new_roles`, and `test_multi_morp_damage_all_must_deal_before_round_end` — in addition to being duplicated inline in `test_elimination_during_damage_can_trigger_endgame` (lines 150–151).

**What this misses:** Any bug in `tally_votes → submit_votes → accused_ids population` would not surface in these tests. A regression where `accused_ids` is populated incorrectly (wrong player, wrong count, stale state from prior round) would be invisible.

**Fix:** Replace the direct writes with the existing `make_engine_at_voting()` + `submit_votes()` pattern that already works cleanly in the voting integration tests (lines 65–113 in `test_voting.py`). The helpers `run_through_hints()` and `run_through_votes()` in `test_round_flow.py` already show the right approach — they just aren't used consistently.

---

### Issue 2 — `make_endgame_engine()` fabricates 2P endgame state

**Severity: High**
**Affected file:** `test_round_flow.py`, lines 162–171
**Tests affected:** All 16 endgame tests (lines 174–349)

The helper constructs a 4-player engine, then manually sets two players as ghosts and forces the phase:

```python
def make_endgame_engine():
    engine = make_engine(num_players=4)
    players = list(engine.lobby.players.values())
    players[0].is_ghost = True      # ← bypasses HP/elimination logic
    players[1].is_ghost = True
    engine.state.phase = GamePhase.ENDGAME_2P  # ← bypasses transition trigger
    engine.start_endgame_round(seed=42)
    return engine, players
```

In the real game, `is_ghost` is set only when a player's HP reaches 0 through `morp_deal_damage()`, and `ENDGAME_2P` is only entered when exactly two active players remain after elimination. This helper skips all of that — including the round that causes the eliminations.

The endgame logic itself (ghost hints, guessing, damage on wrong guess) is tested thoroughly and correctly. What is not tested is the transition from normal play into endgame: specifically, whether the engine correctly detects the 2-player condition, sets the right players as ghosts, and calls `start_endgame_round()` through the normal code path.

**Fix:** Add a small integration test that plays through enough normal rounds to trigger a real endgame transition. The `make_endgame_engine()` helper can stay for unit-testing endgame mechanics in isolation, but the entry condition needs a separate test.

---

### Issue 3 — HP set directly to engineer elimination

**Severity: Medium**
**Affected lines:** `test_voting.py:220`, `test_voting.py:237`, `test_round_flow.py:155`

```python
# test_voting.py:220
target.hp = 1  # one hit from elimination

# test_voting.py:237
engine.lobby.players[safe_ids[0]].hp = 1

# test_round_flow.py:155
engine.lobby.players[safe_ids[1]].hp = 1
```

All three tests want to verify that dealing damage to a player at 1 HP triggers elimination and/or the endgame transition. Directly setting HP works, but it bypasses `morp_deal_damage()` as the source of truth for HP changes and doesn't verify that a player who has taken real damage across rounds will behave correctly when HP reaches 0.

**Fix:** Call `morp_deal_damage()` the appropriate number of times in a prior round (or use a multi-round helper) to legitimately reduce HP, rather than reaching into the model directly. Alternatively, if starting HP is the intended invariant, document it as a constant and reference that in the setup rather than the hardcoded value `1`.

---

### Issue 4 — Hardcoded HP value in endgame assertion

**Severity: Low**
**Affected line:** `test_round_flow.py:250`

```python
assert active[1].hp == 2  # took 1 damage
```

This assumes starting HP is 3. If starting HP ever changes, this assertion fails with a confusing number rather than a clear message. The line above already stores `hp_before` for the winner — the same pattern should be used here:

```python
assert active[1].hp == hp_before - 1
```

---

### Issue 5 — `_pending_damage_morps` poked directly

**Severity: Medium**
**Affected line:** `test_engine.py:354`

```python
engine.state.phase = GamePhase.ACCUSATION
engine._pending_damage_morps = ["p1"]
with pytest.raises(ValueError, match="not authorized"):
    engine.morp_deal_damage("p0", "p2")
```

`_pending_damage_morps` is a private field populated by `resolve_accusation()`. Writing it directly tests the error guard in `morp_deal_damage()` but skips verifying that `resolve_accusation()` populates it correctly. If the population logic had a bug (e.g. wrong player IDs entered the pending list), this test would not catch it.

**Fix:** Drive to this state by calling `resolve_accusation()` after a real accusation, then attempt the unauthorized damage call.

---

### Issue 6 — Tautological tie-break test

**Severity: Low**
**Affected lines:** `test_voting.py:40–42`

```python
result_a = tally_votes(votes, num_morps=1, seed=42)
result_b = tally_votes(votes, num_morps=1, seed=42)
assert result_a == result_b
```

Calling a deterministic function twice with the same inputs and asserting the outputs match is always true — it doesn't test that the seed actually breaks ties, only that the function is deterministic (which all pure functions are). The companion test `test_tie_broken_differently_with_different_seeds` (line 45) is the meaningful one: it confirms different seeds produce different outcomes. The tautology test can be removed or replaced with an assertion that the tie was actually broken (i.e. more than one player had equal vote counts).

---

## What's Well-Covered

- **Board logic:** 20 tests covering load, selection, determinism, half-board subset/containment, custom board validation — all go through public APIs correctly.
- **Connection manager:** Error handling and partial-failure broadcast tested with real mock sockets.
- **WebSocket API:** 32 integration tests drive real HTTP and WebSocket calls end-to-end through the Starlette test client. This is the most realistic coverage in the suite.
- **Lobby/start path:** Player limits, disconnected player pruning, duplicate names, reconnection, host reassignment — all tested cleanly through engine methods.
- **Voting validation:** Wrong vote count, self-vote, nonexistent target, transition to ACCUSATION — all tested via the proper `submit_votes()` path using `make_engine_at_voting()`.
- **Hint turn enforcement:** Out-of-turn hints, mid-game disconnect skip — tested cleanly.
- **Reset/new game:** Full reset and new-game lifecycle tested end-to-end.

---

## Recommended Fix Priority

| Priority | Issue | Effort |
|---|---|---|
| 1 | Replace `accuse_safe_player()` / `accuse_morp()` with real vote flow | Medium |
| 2 | Add integration test for the normal-play → endgame transition | Medium |
| 3 | Replace direct HP assignment with real damage calls | Low |
| 4 | Replace `_pending_damage_morps` direct write with `resolve_accusation()` call | Low |
| 5 | Fix hardcoded `hp == 2` assertion | Trivial |
| 6 | Remove tautological tie-break test | Trivial |
