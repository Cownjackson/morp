# Morp — User Testing Procedures

Work through these scenarios in order. Each builds on confidence in the previous one.
Mark each as ✅ Pass / ❌ Fail / ⚠️ Partial, and note any unexpected behaviour.

---

## 1. Normal full-game flow (no disconnects)

**Setup:** 3+ players, all on `http://localhost:2718` or `http://<ip>:2718`

**Steps:**
1. Player A creates lobby; others join using the lobby code
2. Verify all avatars appear in the player row with correct names and 3 HP pips
3. Host starts game
4. Confirm each player sees the correct role banner (SAFE / THE MORP)
5. SAFE players see a highlighted target word on the board; morp does not
6. Work through the hint phase in turn order — each hint appears as a speech bubble above the correct avatar
7. Submit votes; confirm accusation result screen shows accused player's role
8. Play through to game-over, confirming HP loss, eliminations, ghost behaviour, and the endgame 2-player sudden-death rounds
9. Host resets; all players return to lobby with full HP
10. Start a second game to confirm reset worked cleanly

**Expected:** No stalls, all UI transitions smooth, winner announced correctly.

---

## 2. Hint character limit

**Setup:** Any active game, hint phase

**Steps:**
1. Type a hint longer than 30 characters (e.g. "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
2. Submit the hint

**Expected:** Speech bubble on all clients shows exactly 30 characters — not the full input.

---

## 3. Duplicate name rejected

**Setup:** Two browser tabs pointed at the same server

**Steps:**
1. Tab A creates a lobby and joins as "Alice"
2. Tab B attempts to join the same lobby as "Alice" (while Tab A is still connected)

**Expected:** Tab B sees an error in its event log: "Name 'Alice' is already taken." and is not added to the lobby.

---

## 4. Joining a started game blocked

**Setup:** 3 players in an active game

**Steps:**
1. Open a fourth browser tab
2. Attempt to join the lobby using its code

**Expected:** Join fails with a "Game already in progress" error. Player does not appear in others' lobbies.

---

## 5. Disconnect before game start — removed from lobby

**Setup:** 4 players in lobby, game not yet started

**Steps:**
1. Player D closes their tab / disconnects
2. Host starts the game (3 connected players remain — the minimum)
3. Confirm Player D no longer appears in the player row on any screen
4. Confirm Player D does NOT appear in the turn order
5. Confirm Player D cannot rejoin while the game is in progress

**Expected:** Disconnected players are permanently removed from the lobby at game start. Only connected players receive roles and appear in turn order. A disconnected player attempting to rejoin is blocked with "Game already in progress."

---

## 6. Disconnect mid-round (not their turn) — game stalls, round-start purge

**Setup:** 3-player game, hint phase, Player C is NOT the current hint player

**Steps:**
1. Player C closes their tab after the round starts
2. Play through until the turn reaches Player C
3. Confirm the game stalls waiting for Player C (no auto-skip — a timer for this is planned for a future stage)
4. The round ends (by other means, or Player C reconnects and submits); confirm Player C's avatar is greyed-out for the rest of the round
5. When the host starts the next round, confirm Player C is removed from the lobby entirely and does not appear in the new turn order

**Expected (current behaviour):** Mid-round disconnects are not auto-skipped — the game waits. A skip timer is planned. When a new round begins, any player still disconnected is purged from the lobby and cannot vote or act in the new round.

---

## 7. Disconnect mid-round (their turn) — reconnect and resume

**Setup:** 3-player game, hint phase, Player C IS the current hint player

**Steps:**
1. Player C closes their tab while it is their turn
2. Observe other players: turn indicator should remain on Player C (game waits — no timer yet)
3. Player C reopens the app, enters the same name and lobby code, rejoins
4. Player C should see the board, their role, and the hint input showing it is their turn
5. Player C submits a hint
6. Confirm the hint appears on all clients and the turn advances

**Variation — reconnect during voting:**
- Player C disconnects during the hint phase, their turn is skipped (if not their turn) or the game stalls (if their turn)
- Voting opens while Player C is still disconnected
- Player C reconnects during the voting phase
- Confirm Player C sees the board, their role, all submitted hints, and the vote buttons

**Variation — reconnect during morp guess (morp is Player C):**
- The morp disconnects mid-round and is accused by the group
- The morp reconnects while the guess prompt is active
- Confirm the morp sees the board, all hints, and the guess input with the remaining timer

**Expected:** A player who reconnects at any point during a round is fully restored to the current phase. They see the board, role, all hints submitted so far, and the appropriate UI for the current phase (hint input, vote buttons, or guess prompt).

---

## 8. Disconnect mid-round (their turn) — they do NOT reconnect

**Setup:** Same as scenario 7, but Player C stays disconnected

**Steps:**
1. Player C disconnects on their turn
2. Observe how the game behaves with no timer
3. When the round eventually ends, note that Player C is purged from the lobby at the start of the next round

**Expected (current behaviour, known limitation):** Game stalls waiting for Player C. This is acceptable for now — a skip timer is planned for a future stage. Note how long before the stall becomes unplayable and record observations. If the round does end, Player C will not appear in subsequent rounds.

---

## 9. Host disconnect — host reassignment

**Setup:** 3-player game in lobby (not started)

**Steps:**
1. The host (Player A) closes their tab
2. Observe remaining players' screens
3. Confirm a crown (♛) moves to one of the remaining connected players
4. New host starts a game successfully

**Expected:** Host crown transfers, new host can start the game normally.

---

## 10. Damage phase — morp targets a player

**Setup:** Play to accusation where a safe player is falsely accused (morp survives)

**Steps:**
1. After accusation resolves with morp surviving, confirm the damage UI appears only for the morp
2. Morp selects a target
3. Confirm target loses 1 HP on all screens

**Expected:** Only the morp sees targeting buttons. HP updates broadcast to everyone. If target reaches 0 HP they are eliminated (greyed out, ghost).

---

## Notes

- Record the device and browser used for each run (desktop Chrome, mobile Safari, etc.)
- Note any console errors (`F12` → Console tab on desktop)
  - **Long-term tracking:** After PR #47 (cache-busting cleanup + hail mary dedup), monitor for errors mentioning `setPhaseLabel` (removed) or `draw-hail-mary-*` IDs (deduplicated). If any appear, they indicate missed references during refactoring. Document in #47 if found.
- If the server crashes, paste the uvicorn terminal output
