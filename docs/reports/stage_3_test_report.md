# Stage 3 Test Report

**Date:** 2026-03-13
**Suite:** `backend/tests/`
**Result:** 159 passed, 0 failed (4.02s)

---

## Summary

All 159 tests pass. A full audit was performed across the suite covering both intermittent hang issues and state-manipulation shortcuts. The hang issues and most state-injection problems have been resolved. Two lower-priority issues remain open.

| File | Tests | Status |
|---|---|---|
| test_board.py | 21 | Clean |
| test_connection_manager.py | 5 | Clean |
| test_engine.py | 48 | Clean |
| test_round_flow.py | 22 | Clean |
| test_voting.py | 18 | Clean |
| test_websocket.py | 45 | Clean |

---

## Resolved Issues

### ✅ Issue 1 — `accused_ids` injected directly instead of going through voting

**Was: High severity**
**Affected files:** `test_voting.py`, `test_round_flow.py`

Thirteen tests were skipping the vote-submission flow by directly writing `rs.accused_ids` and forcing `engine.state.phase = GamePhase.ACCUSATION`. The `accuse_safe_player()` and `accuse_morp()` helpers in `test_round_flow.py` codified this shortcut.

**Fix applied:** All direct writes replaced with real `submit_votes()` calls. A `vote_all_for(engine, target_id)` helper added to `test_voting.py`. The `accuse_safe_player()` and `accuse_morp()` helpers in `test_round_flow.py` rewritten to drive the full voting flow. The multi-morp (2 votes per player) case handled separately inline.

---

### ✅ Issue 2 — `_pending_damage_morps` poked directly

**Was: Medium severity**
**Affected line:** `test_engine.py:354`

`engine._pending_damage_morps` was written directly, bypassing `resolve_accusation()`. The test verified the error guard in `morp_deal_damage()` but not the population logic.

**Fix applied:** `test_morp_deal_damage_not_in_pending_raises` now reaches the state via full hint submission → voting → `resolve_accusation()` before attempting the unauthorized damage call.

---

### ✅ Issue 3 — Hardcoded HP value in endgame assertion

**Was: Low severity**
**Affected line:** `test_round_flow.py:250`

```python
assert active[1].hp == 2  # took 1 damage
```

**Fix applied:** Changed to `assert active[1].hp == hp_before - 1`, capturing HP before the action.

---

### ✅ Issue 4 — Tautological tie-break test

**Was: Low severity**
**Affected lines:** `test_voting.py:40–42`

A test called `tally_votes()` twice with the same seed and asserted the results matched — always true by definition.

**Fix applied:** Test removed. The meaningful companion test `test_tie_broken_differently_with_different_seeds` remains.

---

### ✅ Issue 5 — Intermittent test hangs

**Was: High severity**
**Affected file:** `test_websocket.py`

Three root causes:

1. **`_timer_tasks.clear()` without cancelling tasks** — dict clear removes references but leaves tasks running. Fixed by iterating and calling `task.cancel()` before clearing in the `reset_global_state` fixture.
2. **Multiple `websocket_connect()` calls creating separate event loops** — `asyncio.gather()` in `broadcast()` crossed event loop boundaries unsafely. Fixed by using `with TestClient(app) as c:` (shared portal via `TestClient.__enter__()`).
3. **Disconnect race condition** — `WebSocketTestSession.__exit__()` cancels the ASGI task's scope before the disconnect handler finishes broadcasting. Fixed by calling `ws.close()` while the context is still open, draining expected messages, then letting `__exit__` clean up.

**Supporting fixes:** `pytest-timeout = 10` added to `pyproject.toml` to surface hangs as failures rather than indefinite blocks. All `start_game` calls now pass `timers_enabled: False` to prevent timer tasks from running during tests.

---

## Remaining Issues

### Issue A — `make_endgame_engine()` fabricates 2P endgame state

**Severity: Medium**
**Affected file:** `test_round_flow.py`

The helper constructs a 4-player engine then manually sets two players as ghosts and forces the phase:

```python
def make_endgame_engine():
    engine = make_engine(num_players=4)
    players = list(engine.lobby.players.values())
    players[0].is_ghost = True      # bypasses HP/elimination logic
    players[1].is_ghost = True
    engine.state.phase = GamePhase.ENDGAME_2P  # bypasses transition trigger
    engine.start_endgame_round(seed=42)
    return engine, players
```

In the real game, `is_ghost` is set only when a player's HP reaches 0 through `morp_deal_damage()`, and `ENDGAME_2P` is only entered when exactly two active players remain after elimination. The endgame mechanics themselves (ghost hints, guessing, damage on wrong guess) are tested thoroughly. What is not tested is the transition from normal play into endgame — whether the engine correctly detects the 2-player condition, sets the right players as ghosts, and calls `start_endgame_round()` through the real code path.

**Recommended fix:** Add an integration test that plays through enough normal rounds to trigger a real endgame transition. The `make_endgame_engine()` helper can stay for unit-testing endgame mechanics in isolation.

---

### Issue B — HP set directly to engineer elimination

**Severity: Low**
**Affected lines:** `test_voting.py` (2 occurrences), `test_round_flow.py` (1 occurrence)

```python
engine.lobby.players[safe_ids[0]].hp = 1  # one hit from elimination
```

All three tests want to verify that dealing damage to a player at 1 HP triggers elimination. Directly setting HP works for this purpose, but bypasses `morp_deal_damage()` as the source of truth and doesn't verify that real accumulated damage across rounds behaves correctly at the boundary.

**Recommended fix:** Call `morp_deal_damage()` the appropriate number of times across proper rounds to legitimately reduce HP, rather than reaching into the model directly.

---

## What's Well-Covered

- **Board logic:** Tests covering load, selection, determinism, half-board subset/containment, custom board validation — all through public APIs.
- **Connection manager:** Error handling and partial-failure broadcast tested with real mock sockets.
- **WebSocket API:** 45 integration tests drive real HTTP and WebSocket calls end-to-end through the Starlette test client. This is the most realistic coverage in the suite.
- **Lobby/start path:** Player limits, disconnected player pruning, duplicate names, reconnection, host reassignment — all tested cleanly through engine methods.
- **Voting flow:** Wrong vote count, self-vote, nonexistent target, transition to ACCUSATION, tie-breaking — all now tested via the proper `submit_votes()` path.
- **Accusation resolution:** Both morp-accused and safe-accused paths now exercised through real voting.
- **Damage authorization:** `_pending_damage_morps` guard now exercised via real `resolve_accusation()`.
- **Hint turn enforcement:** Out-of-turn hints, mid-game disconnect skip — tested cleanly.
- **Reset/new game:** Full reset and new-game lifecycle tested end-to-end.
