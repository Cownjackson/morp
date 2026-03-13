# Morp — Initial Design Document

## 1. Project Overview

Morp is a real-time multiplayer web game for 3 or more players, blending mechanics from Codenames, Among Us, and Vorp. Players are shown a shared grid of themed words. One word is secretly designated as the **target**. Most players are **safe** and can see the target word highlighted in green. One player per round is the **morp** — an imposter who cannot see the target word and must blend in by giving plausible-sounding hints while trying to deduce the word from other players' clues.

**Primary audience:** Friends and family, hosted privately on AWS.
**Philosophy:** Test-Driven Development throughout all stages.

---

## 2. Core Concepts

### Roles
- **Safe player:** Sees the target word highlighted on the board. Must give a hint that signals they know the word without giving it away to the morp.
- **Morp:** Cannot see the target word. Must give a convincing hint despite not knowing the answer. If going first in a round, compensated by seeing half the board (randomly selected words revealed).

### Health
- All players start with **3 health**.
- A player is **eliminated** when their health reaches 0.
- Eliminated players become ghosts and participate in the 2-player endgame phase.

### Board
- A shared grid of themed words (default: 5×5 = 25 words).
- Each round, a new board is drawn from the board pool and a new target word is randomly selected from it.
- The target word is highlighted green for safe players; invisible (no highlight) for the morp.
- Board dimensions are configurable (not hardcoded to 5×5) to allow future flexibility.

### Board Pool
- Default pool: 3 pre-built 5×5 boards, each with a theme.
- Custom boards accepted via JSON: `{"board_hint": "something spooky...", "words": ["word1", "word2", ...]}`
- The board hint (theme label) is displayed to all players including the morp.

---

## 3. Game Flow

### Lobby
1. A host creates a lobby with a lobby code.
2. Players join via the code. Minimum 3 **connected** players required to start.
3. Host configures: number of morps (default 1), lobby size.
4. Host starts the game. Any player who is not connected at the moment the game starts is permanently removed from the lobby.

### Round Start
1. A new board and target word are randomly selected.
2. One player per n-morp configuration is randomly assigned as the morp (unknown to other players and to other morps).
3. A turn order is randomly set for the round (all active players shuffled).
4. If the morp is first in the turn order, they are shown a randomly selected half of the board words as compensation.

### Hint Phase
- Players give hints one at a time in turn order.
- Each player submits a short text response (their clue/hint).
- Safe players: hint should signal knowledge of the target without naming it.
- Morp: must provide a convincing hint; if going first with no prior hints, uses the half-board accommodation.
- Once submitted, hints are visible to all players (displayed as speech bubbles on player avatars).
- All players must submit before voting begins.

### Voting Phase
- After all hints are submitted, voting opens.
- Each player casts **n votes** (where n = number of morps in the game).
- Players cannot vote for themselves.
- The **n players** with the most total votes are accused.
- Ties are broken randomly.

### Accusation Resolution
- Player roles are revealed for the accused.
- **If none of the accused are the morp:** The morp(s) each deal 1 damage to a player of their choosing.
- **If a morp is accused:**
  - The accused morp must guess the target word from the board.
  - Correct guess: morp takes no damage this round.
  - Wrong guess or no guess: morp takes 1 damage.
- After resolution, eliminated players (0 HP) are converted to ghosts.
- Round ends; if 3+ active players remain, a new round begins.

### Elimination & Endgame Trigger
- When exactly 2 active players remain, the **2-player endgame** begins.
- The winner is the last player with HP remaining.

---

## 4. Two-Player Endgame

Both remaining players are assigned as morps — neither can see the target word.

**Flow:**
1. A new board and target word are selected.
2. All eliminated (ghost) players are shown the target word and simultaneously submit hints.
3. **Timer 1:** Hints are held up all at once when the timer expires (or all ghosts submit early).
4. Both remaining players can now type their guess in parallel.
5. **Timer 2:** A dramatic countdown plays if neither player has answered yet.
6. **First correct guess:** That player is safe; the other takes 1 damage.
7. **Wrong guess:** Counts as a forfeit for that guess; the other player still has time to answer.
8. **Neither correct / timeout:** Both take 1 damage.
9. Repeat until one player remains (or both reach 0 HP simultaneously — handle as a draw).

---

## 5. Turn Order & Disconnects

- Turn order is **randomized at the start of each round** (not fixed for the entire game).

### Pre-game disconnect
- Any player not connected at the moment the host starts the game is **permanently removed from the lobby**. They are not assigned a role and do not appear in the turn order.
- A new game cannot start unless at least 3 players are connected at that moment.

### New-round disconnect
- When the host starts a new round, any player still disconnected is **permanently purged** from the lobby before the round begins. They do not receive a role or appear in the new turn order.

### Mid-round disconnect
- If a player disconnects during the hint phase, the game stalls at their turn until they reconnect and submit. A **hint timer** is planned for a future stage — when it fires, a blank hint is submitted on behalf of whoever has not answered in time, whether they are disconnected or simply idle. This is the same behaviour for all players and is not disconnect-specific.
- Disconnected players remain in the lobby for the duration of the current round and can still be voted for.
- If a disconnected player reconnects during the same round, they are fully restored to the current phase:
  - **Hint phase:** they see their role, the board, and all hints submitted so far.
  - **Voting phase:** they see all hints and the vote UI.
  - **Morp guess phase:** the accused morp sees the board, all hints, and the guess input.

---

## 6. Multiple Morps

- Configurable at lobby creation (default: 1).
- Morps do **not** know each other's identities.
- Voting: each player casts **n votes** for **n morps**; top n vote-getters are accused.
- Accusation resolution runs once per accused player independently.
- Damage dealt by surviving morps: each morp independently picks a target.
- **Note:** Multi-morp balance should be evaluated during playtesting; voting mechanism may change.

---

## 7. Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, WebSockets (`websockets` via Starlette) |
| Testing | pytest, pytest-asyncio |
| Frontend (prototype) | Plain HTML + vanilla JS (WebSocket client) |
| Frontend (future) | TBD after prototyping |
| Hosting (future) | AWS (out of scope until Stage 4) |

### Backend Responsibilities
- Game state management (lobby, rounds, players, HP, roles, votes)
- WebSocket connection management per lobby
- Board pool management (load defaults, accept custom JSON)
- Turn/timer orchestration
- Accusation and damage resolution logic

### Frontend Responsibilities (Prototype)
- Connect to lobby via WebSocket
- Render the word grid (highlight target for safe players only)
- Accept and submit hint text
- Display all submitted hints
- Accept and submit votes
- Display accusation results
- Display HP status for all players

---

## 8. User Stories

### Player
- As a player, I can create a lobby and share a code so friends can join.
- As a player, I can join a lobby with a code and set a display name.
- As a safe player, I can see the target word highlighted on the board.
- As a morp, I cannot see which word is highlighted but I can see the board theme.
- As a morp going first, I can see a random half of the board words to partially compensate.
- As any player, I can submit a hint during my turn.
- As any player, I can see all submitted hints displayed before voting.
- As any player, I can cast my votes during the voting phase.
- As any player, I can see the accusation result and role reveal.
- As the morp (if accused), I can attempt to guess the target word.
- As a ghost, I can submit a hint during the 2-player endgame phase.
- As a player, I can see the current HP of all players.

### Host
- As a host, I can configure the number of morps before starting.
- As a host, I can start the game once 3+ players have joined.
- As a host, I can toggle the guess timer on or off before starting.
- As a host, I can reset the game after it ends to start a new one with the same players.
- As a host, I can kick a disconnected player.

---

## 9. Key Test Cases

### Game Setup
- [x] Lobby rejects start with fewer than 3 players
- [x] Correct number of morps assigned per configuration
- [x] Morp does not receive target word highlight
- [x] Morp going first receives exactly half the board words (random selection, target always included)
- [x] Morp not going first receives no accommodation

### Hint Phase
- [x] Turn order enforced (players cannot submit out of turn)
- [x] Hint submitted by each player is visible to all after submission
- [x] Voting phase does not start until all players have submitted

### Voting
- [x] Player cannot vote for themselves
- [x] Player casts exactly n votes for n morps
- [x] Tie in votes broken randomly and deterministically (seeded)
- [x] Correct n players are accused

### Accusation Resolution
- [x] If no morp accused: each morp deals 1 damage to chosen target
- [x] If morp accused and guesses correctly: morp takes no damage
- [x] If morp accused and guesses wrong: morp takes 1 damage
- [x] Non-accused players cannot submit a morp guess
- [x] Player HP reaches 0 → player becomes a ghost

### Two-Player Endgame
- [x] Neither final player can see the target word
- [x] Both finalists are assigned the morp role and notified via role_assigned message
- [x] Ghost players can see the target word to give useful hints
- [x] All ghost hints revealed simultaneously after timer
- [x] First correct guess wins the round; other takes damage
- [x] Wrong guess does not block the opponent from still answering
- [x] Both timeout → both take 1 damage
- [x] Draw condition (both reach 0 HP) triggers Sudden Death Replay
- [x] Morp given 30-second countdown to guess target word after accusation (hints remain visible)
- [x] Morp guess timer expiry counts as a wrong guess (takes 1 damage)

### Game Reset
- [x] Host can reset the game after it ends; all players' HP/roles/ghost status restored
- [x] All clients receive game_reset broadcast and return to lobby
- [x] A new game can be started immediately after reset
- [x] Non-host cannot trigger a reset

### Disconnect
- [x] Player not connected at game start is permanently removed from the lobby
- [x] Player still disconnected when a new round begins is permanently purged from the lobby
- [x] Game requires at least 3 connected players to start
- [x] Disconnected player's hint turn stalls the game until they reconnect (hint timer planned)
- [x] Disconnected player's vote is skipped (voting resolves without them)
- [x] Host reassigned if host disconnects
- [x] Lobby cleaned up when all players disconnect
- [x] Reconnecting during the hint phase restores board, role, and all submitted hints
- [x] Reconnecting during the voting phase restores full hint history and vote UI
- [x] Reconnecting during the morp guess phase restores board, hints, and guess input

### Board
- [x] Default 3 boards load correctly
- [x] Custom board JSON accepted and validated (1–100 words)
- [x] New board + target selected each round
- [ ] Board grid renders correctly for any valid n×k dimensions (frontend renders square grids; non-square not tested)

---

## 10. Out of Scope (Prototype)

The following are noted to avoid architectural decisions that would block them, but are **not** implemented in the prototype:

- Lobby chat
- Drawing-based hints
- Customizable player orbs (colors, accessories, facial features)
- Orb interactions (point, spit, slap, etc.)
- Ghost interactions/heckling
- Mobile optimization
- Configurable starting HP
- Configurable max hint length
- AWS deployment (Stage 4+)
- Access key / spend limiting (Stage 4+)
- Ads (Stage 6+)

---

## 11. Open Questions

- **Multi-morp voting:** n-votes-each is the starting rule, but exact balance is unvalidated. Flag for playtesting review.

---

## 12. Resolved Decisions (Post-Discussion)

- **Draw condition:** Both final players hitting 0 HP in the same endgame round triggers **Sudden Death Replay** — a new board/target is selected and the endgame round repeats until one player wins.
- **Morp guess timer:** After being accused, the morp has **30 seconds** to guess the target word. All player hints from the round remain visible during this window.
- **Custom board validation:** Boards must have between **1 and 100 words** (capped at 10×10 grid). Minimum 1 word; layout is derived from word count (up to the configured grid size).
- **Host timer toggle:** The host can disable timers (morp guess + endgame guess) before starting, useful for testing and casual play. Toggle defaults to enabled.
- **Game reset:** After a game ends, the host can reset the lobby. Player list is preserved but all HP, roles, and ghost status are restored. A new game can be started immediately.
- **Disconnect at start/round boundary:** Players who are not connected when the game starts, or when a new round begins, are permanently removed from the lobby. They cannot rejoin while the game is in progress.
- **Mid-round reconnect:** A player who disconnects during a round and reconnects before the round ends is fully restored to the current phase with all game context (board, role, hints, phase-appropriate UI). They may still vote, or submit a morp guess if they were accused while disconnected.
- **Hint timer (planned):** A per-turn timer will be added in a future stage. When it expires, a blank hint is submitted for whoever has not answered — regardless of whether they are disconnected or idle. This is not a disconnect-specific mechanic.
- **Post-game joins:** New players may join a lobby after a game ends (GAME_OVER phase) even though `started` remains true internally. The host reset restores the lobby to a clean pre-game state for everyone.
