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

## 5. Disconnect before game start — excluded from turn order and morp pool

**Setup:** 3 players in lobby, game not yet started

**Steps:**
1. Player C closes their tab / disconnects
2. Host starts the game with Players A and B (the minimum 3 connected players is not met with 2 — so add a Player D to verify with 3 connected and 1 disconnected)
3. Confirm Player C's avatar shows as greyed-out / disconnected
4. Confirm Player C does NOT appear in the turn order
5. Confirm Player C is not assigned as morp across several runs (restart to re-test)

**Expected:** Only connected players at game-start time are assigned roles and added to turn order. Disconnected players are bystanders until next round.

---

## 6. Disconnect mid-round (not their turn) — turn skipped, game continues

**Setup:** 3-player game, hint phase, Player C is NOT first in turn order

**Steps:**
1. Player C closes their tab after the round starts
2. Play through until the turn reaches Player C
3. Confirm Player C's turn is automatically skipped (blank hint broadcast) and the next player's turn begins without any action needed

**Expected:** Other players see the turn indicator move past Player C automatically. Game continues without stalling.

---

## 7. Disconnect mid-round (their turn) — reconnect and supply hint

**Setup:** 3-player game, hint phase, Player C IS the current hint player

**Steps:**
1. Player C closes their tab while it is their turn
2. Observe other players: turn indicator should remain on Player C (game waits — no timer yet)
3. Player C reopens the app, enters the same name and lobby code, rejoins
4. Player C should see the board, their role, and the hint input showing it is their turn
5. Player C submits a hint
6. Confirm the hint appears on all clients and the turn advances

**Expected:** Reconnecting player is fully restored to their hint turn. Other players see the hint arrive and the turn advance normally.

---

## 8. Disconnect mid-round (their turn) — they do NOT reconnect

**Setup:** Same as scenario 7, but Player C stays disconnected

**Steps:**
1. Player C disconnects on their turn
2. Observe how the game behaves with no timer

**Expected (current behaviour, known limitation):** Game stalls waiting for Player C. This is acceptable for now — a skip timer is planned for a future stage. Note how long before the stall becomes unplayable and record observations.

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
- If the server crashes, paste the uvicorn terminal output
