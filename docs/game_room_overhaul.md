# Game Room Flow Overhaul — Design Document

**Status:** Planning
**Branch:** `gameplay-enhancements`
**Last updated:** 2026-03-20

---

## Overview

This document covers the complete overhaul of the in-game (game room) experience, from the moment the lobby host clicks "Start Game" through to the game end screen. It does NOT cover the pregame lobby.

Each phase maps to a step in the game flow. Phases are ordered by game sequence, not implementation priority.

---

## Phase 1: Lobby → Game Room Transition (Magnetic Snap)

**Current:** Players appear instantly at seat positions when the screen switches to ingame.

**Target:** Players visually snap from their lobby positions to their game room seats as if pulled by a magnetic force.

### Frontend
- On `round_start`, capture each player's current DOM position from the pregame layout
- Place avatar clones at those positions in the game layout
- Animate to seat coordinates using a custom easing curve (slow start → fast snap → slight overshoot/settle) over ~600-800ms
- Stagger player animations slightly (50-80ms offset each) for organic feel

### Backend Changes
None.

### Open Questions
None.

---

## Phase 2: Role Assignment & Board Reveal

**Current:** Role banner appears immediately. Board renders instantly.

**Target:** Envelope-based role reveal with art assets and SFX. Board fades in after.

### Decision: Option A — Envelope Reveal (confirmed)

### Art Deliverables
- `envelope_closed.png` — sealed envelope
- `envelope_opened_back.png` — back layer of opened envelope (behind letter)
- `envelope_opened_front.png` — front layer of opened envelope (in front of letter)
- `morp_letter.png` — morp role letter
- `safe_letter.png` — safe role letter

### SFX Deliverables
- `letter_open.mp3` — plays on envelope open

### Animation Sequence
1. `round_start` + `role_assigned` received from server
2. **Envelope appears** — `envelope_closed.png` presented to player (centered on screen, overlay)
3. **Player clicks envelope** — plays `letter_open.mp3`, swaps to opened envelope
4. **Letter slides out** — the `safe_letter.png` or `morp_letter.png` slides upward out of the envelope, sandwiched between `envelope_opened_back.png` (behind) and `envelope_opened_front.png` (in front) so it appears to emerge from inside
5. **Letter enlarges** — letter scales up for the player to clearly see their role
6. **Player dismisses** — player clicks/taps to dismiss the letter, or it auto-dismisses after ~3s of being visible
7. Board fades in (opacity 0→1 over ~800ms), hint phase UI appears — if the player is first in turn order, they can start drawing immediately

### Layering Detail
The opened envelope is two layers sandwiching the letter:
```
z-index stack (front to back):
  envelope_opened_front.png  (front flap, overlaps letter)
  letter (morp or safe)      (slides up between layers)
  envelope_opened_back.png   (envelope body, behind letter)
```
This creates the illusion of the letter being pulled out of the envelope.

### Synchronization
- No synchronization gate — each player's envelope is independent
- Players proceed at their own pace; if the first player in turn order dismisses quickly, they can start drawing while others are still opening their envelope
- No backend changes needed — server waits passively for `submit_hint` messages

### Backend Changes
None.

### Open Questions
- [x] ~~Which role reveal style?~~ → Option A — Envelope (confirmed)
- [x] ~~Fixed window?~~ → No. Players proceed at own pace, no sync gate.

---

## Phase 3: Hint Phase — Drawing Display Overhaul

**Current:** Speech bubbles appear near players (110px text, 364px drawings). Stay in place. No hint timer implemented.

**Target:** Hints animate to centerpiece for display, then shrink back to the player as hoverable thumbnails. Server-orchestrated turn pacing. Configurable hint timer.

### Hint Lifecycle

1. Player submits hint (text or drawing)
2. Server broadcasts `hint_received` with `display_duration` (ms, e.g. 5000)
3. Frontend: hint appears near submitting player briefly (~300ms, establishes origin)
4. Frontend: hint animates to the **centerpiece** and scales up to readable size (~300-400px drawings, large text)
5. Frontend: hint stays at centerpiece, timed to `display_duration`
6. Server holds for `display_duration`, then sends `next_turn` with the next player's ID
7. Frontend: on `next_turn`, hint animates back to submitting player and **shrinks** to thumbnail (~60-80px for drawings, larger for text) over the avatar
8. Next player's drawing UI appears
9. **Fallback:** if `next_turn` doesn't arrive within `display_duration + 2000ms`, frontend transitions anyway
10. Thumbnail persists for rest of hint phase
11. **Hover:** thumbnail scales up (~250px) smoothly. Mouse-off shrinks it back.
12. **Click:** deferred — gather user testing feedback on what click behavior would be useful

### Shared Treatment for Text & Drawing Hints
- Both hint types use the same animation pipeline (fly to center → hold → fly back → shrink)
- Text hints rendered as styled text at the centerpiece (same positioning/animation, just different content)
- Thumbnail size may differ: drawings shrink to ~60-80px, text thumbnails can stay slightly larger since they need to remain legible

### Layout
- Centerpiece display zone: horizontally centered over play area, vertically between top seats and board
- Z-index: displayed hint above everything during showcase

### Hint Timer
- Controlled by existing `timers_enabled` boolean in lobby config
- New config: `hint_timer_duration` (seconds) — how long a player has to submit their hint
- Default: 30s (matches existing `_TIMER_SECONDS` pattern)
- Lobby UI: duration slider — **wait to add until lobby overhaul branch is merged** (BisnisPinguin's parallel workstream)
- Backend: follows existing timer pattern (`_timer_tasks`, `_cancel_timer`, `asyncio.create_task` with `asyncio.sleep`)
- On timeout: auto-submit a skip (empty hint) for the current player

### Frontend
- New animation system for hint lifecycle (appear → fly to center → hold → fly back → shrink)
- Thumbnail state management (which hints submitted, their positions)
- Hover interaction handlers for thumbnails
- Z-index management
- Listen for new `next_turn` message to gate turn transitions
- Hint timer countdown display (when timers enabled)

### Backend Changes

| Change | Detail |
|--------|--------|
| Add `display_duration` to `hint_received` | Duration in ms for centerpiece display. Server holds this long before advancing turn. |
| New message: `next_turn` | Sent after display hold. Contains `player_id` of next player in turn order. |
| Server-side display hold | After broadcasting `hint_received`, `asyncio.sleep(display_duration)` before advancing to next turn. Uses existing `_timer_tasks` / `_cancel_timer` pattern. |
| Hint timer implementation | New timer following morp guess / endgame timer pattern. Configurable duration via `hint_timer_duration` config. Auto-skips on timeout. |
| New config: `hint_timer_duration` | Added to lobby config. Default 30s. Lobby slider UI deferred until lobby overhaul branch merges. |

### Open Questions
- [x] ~~Centerpiece display blocks next turn?~~ → Yes, server-orchestrated via `display_duration` hold + `next_turn` message.
- [x] ~~Click behavior?~~ → Deferred. Gather user testing feedback first.
- [x] ~~Same treatment for text and drawing?~~ → Yes, shared pipeline. Text thumbnails slightly larger than drawing thumbnails.
- [x] ~~Display duration~~ → Fixed 5s, hardcoded on backend. Tune after playtesting.
- [x] ~~Hint timer default~~ → 60s default for drawing hints. Range: 5s–5min in config.

---

## Phase 4: Voting Phase — Click Avatars

**Current:** `renderVoteButtons()` creates labeled buttons. Players click buttons to select.

**Target:** Players click on player avatars directly to cast accusation votes.

### Frontend
- Add `voteable` class to avatar wraps during voting phase (exclude self and ghosts)
- Pointer cursor, hover glow/outline effect
- Click toggles vote selection — visual indicator on selected players (see art deliverables)
- Submit button remains in action area (or floated centrally)
- Subtle prompt in action area: "click players to accuse"
- Multi-vote counter: show "2/3 selected" in action area only when `num_votes > 1` (currently disabled, future-proofing)
- Remove old vote button generation

### Art Deliverables
- **Vote selection indicator** — glow, ring, or outline effect for selected players (placeholder: mint green CSS ring). Could be a sprite overlay on the avatar.
- **Voteable hover effect** — subtle glow or highlight when hovering a valid target (placeholder: CSS outline/shadow)
- **Accused highlight** — distinct effect for the player(s) who received the most votes once results come in. Different from the selection indicator — this is the "you've been accused" moment. (Placeholder: animated pulse ring)

### Vote Timer
- Controlled by existing `timers_enabled` boolean in lobby config
- New config: `vote_timer_duration` (seconds) — how long players have to vote
- Default: 45s
- Range: 5s–5min (same as hint timer)
- Lobby UI: duration slider — **wait until lobby overhaul branch merges**
- On timeout: no vote submitted for that player (they abstain)
- **Early close:** if all eligible players have submitted votes, timer drops to 5s (unless already at or below 5s). Gives a brief buffer before results without dragging.
- Backend: follows existing timer pattern (`_timer_tasks`, `_cancel_timer`, `asyncio.create_task`)
- Frontend: countdown display in action area during voting phase

### Backend Changes

| Change | Detail |
|--------|--------|
| Vote timer implementation | Configurable duration, auto-expires (no vote for that player). Follows existing timer pattern. |
| New config: `vote_timer_duration` | Added to lobby config. Default 45s. Range 5s–5min. |
| Early close on all votes in | When all eligible players have voted, reduce remaining timer to `min(remaining, 5s)`. Broadcast updated deadline to clients. |

### Open Questions
- [x] ~~Multi-vote counter~~ → Yes, shown only when `num_votes > 1`.
- [x] ~~Vote timer default~~ → 45s.

### Post-Vote Visualization
- After voting resolves, display **red arrows** from each player to the player they accused
- Arrows visible to all players during the accusation/reveal sequence
- Adds transparency and social drama ("you voted for ME?!")
- Implementation deferred — needs design thought on arrow rendering (SVG overlay? canvas layer?)

---

## Phase 5: Role Reveal After Voting — One-by-One Dramatic Reveal

**Current:** `accusation_result` immediately shows accused player with role tag, then skips to next phase.

**Target:** Reveal ALL non-ghost player roles one by one with dramatic pacing. Morp always last.

### Reveal Order Logic (server-dictated)
The server builds the `reveal_order` array for all non-ghost players:
1. Safe players who were **not** accused — revealed first (order randomized)
2. If the accused player is **safe** (wrong accusation): accused player is revealed **second to last**, creating suspense between them and the real morp
3. The **morp** is always revealed **last**

This means in a wrong-accusation scenario, the final two reveals are: the wrongly accused safe player, then the morp — maximum drama.

### Reveal Sequence

1. Voting completes → server sends `accusation_result` with `reveal_order`
2. Frontend enters reveal sequence
3. Subtle vignette/zoom on play area
4. `reveal.mp3` begins playing
5. Players revealed one at a time in `reveal_order`:
   - Colored overlay/box appears on avatar (green = safe, red = morp)
   - Fading popup text near player: "SAFE" or "MORP"
   - Base timing: ~1.5s per reveal
   - **Scaling constant:** `reveal_interval = base_interval / (1 + (player_count - 4) * scale_factor)` — larger lobbies reveal slightly faster to keep total sequence length reasonable. Tune after playtesting.
6. Before final reveal (morp): brief tension beat (~1s extra pause)
7. `reveal_morp.mp3` plays on the morp reveal
8. Brief pause after final reveal (~2s)
9. Transition to next phase (morp guess or damage)

### Art Deliverables
- **Role overlay** — green box/glow for safe, red box/glow for morp, applied to avatar during reveal (placeholder: CSS colored box)
- **Custom avatar overlay art** — noted as future deliverable for replacing the colored boxes

### SFX Deliverables
- `reveal.mp3` — plays during the reveal sequence (looping or one-shot that covers the duration)
- `reveal_morp.mp3` — plays on the final morp reveal for dramatic cap

### Backend Changes

| Change | Detail |
|--------|--------|
| Add `reveal_order` to `accusation_result` | Ordered array of `{ player_id, role }` for ALL non-ghost players. Order: safe non-accused → accused (if safe) → morp last. Server randomizes the safe non-accused order. |

### Open Questions
- [x] ~~Reveal scope~~ → All non-ghost players. Accused safe player revealed second-to-last for suspense.
- [x] ~~Timing~~ → 1.5s base per reveal with a scaling constant for larger lobbies. Tunable.
- [x] ~~Drumroll~~ → Yes. Extra ~1s pause before morp reveal + `reveal_morp.mp3` SFX.

---

## Phase 6A: Morp Guess Phase — Click Word Board

**Current:** Morp types guess into a text input. Free-text.

**Target:** Morp clicks a word on the board, then clicks submit. Guess animates to center before result reveal.

### Frontend
- During morp guess phase, board words become clickable (`selectable` class)
- Clicked word gets highlight (border/glow). Click again to deselect. Click different word to switch.
- Submit button confirms selection
- On submit: word animates from board to centerpiece (card toss)
- ~1s suspense pause at center
- Reveal: word flashes green (correct) or red (wrong)
- Damage animation placeholder: `playDamageAnimation(targetId, amount)` hook for later

### Backend Changes

| Change | Detail |
|--------|--------|
| Validate morp guess is a board word | In `submit_morp_guess` handler, reject guess if not in `board_words` |

### Open Questions
- [x] ~~Damage animation~~ → Placeholder hook `playDamageAnimation(targetId, amount)` for now. Mechanic TBD by team.

---

## Phase 6B: Morp Damage Dealing — Click Players

**Current:** Morp clicks buttons with player names to deal damage.

**Target:** Morp clicks player avatars to select damage target.

### Frontend
- Add `damageable` class to valid targets (non-ghost, non-morp) during damage phase
- **Punch red** hover glow (distinct from mint voting glow)
- Click to select, confirm button to execute (prevent misclicks)
- Targeting indicator: placeholder hook `playMorpTargetingAnimation(morpId, targetId)` — will iterate on style like spitball/stickyhand interactions
- Damage received: placeholder hook `playMorpDamageAnimation(targetId, amount)` — separate from 6A's `playDamageAnimation`, may want a distinct effect for morp-dealt damage vs. wrong-guess self-damage

### Backend Changes
None. `morp_deal_damage` already accepts `target_id`.

### Open Questions
- [x] ~~Targeting indicator style~~ → TBD. Placeholder hook for now, iterate later.
- [x] ~~Damage animation~~ → Separate hook from 6A (`playMorpDamageAnimation`). Different effect possible.

---

## Phase 7: Auto-Transition Between Rounds

**Current:** Host clicks "Start Next Round". Non-hosts wait.

**Target:** Automatic transition with countdown.

### Frontend
- On `round_end`, show countdown: "Next round in 5… 4… 3…"
- Animated number with scale-down per tick
- Transition visual flair: placeholder hook `playRoundTransition()` — TBD, needs more design thought
- **Host hold button:** if host, show a "Hold" button during countdown that sends `hold_next_round` to server. Pauses the countdown for all players. Host can release to resume. Keep implementation simple — if it gets complex, cut it.

### Backend Changes

| Change | Detail |
|--------|--------|
| Auto-start timer after `round_end` | Server-side 5s timer, hardcoded. Tweak after playtesting. |
| New message: `round_starting` | Sent to all clients with countdown value so frontend can display timer |
| `hold_next_round` / `resume_next_round` | Host-only messages. Hold cancels the timer, resume restarts it. Simple cancel/reschedule on the existing timer task. Only implement if low-risk — cut if it adds significant complexity. |

### Open Questions
- [x] ~~Countdown duration~~ → 5s hardcoded. Tune after playtesting.
- [x] ~~Host hold button~~ → Yes, but only if simple/low-risk. Cut if complex.
- [x] ~~Visual flair~~ → TBD. Placeholder hook `playRoundTransition()` for now.

---

## Phase 8: Player Death & Ghost State

**Current:** Dead players get `opacity: 0.3` and grayscale filter. Can't vote or hint in normal rounds.

**Target:** Death animation placeholder. Possible ghost-tail moop sprite.

### Frontend (placeholder)
- `playDeathAnimation(playerId)` — quick and snappy: short shake → flash → opacity drop to ghost state
- No ghost sprite changes for now — just the existing opacity + grayscale treatment with the death animation preceding it
- Will iterate on the exact animation feel (timing, intensity) to get it right
- Increase visual complexity later when art direction is clear (ghost tail moop sprite, etc.)

### Backend Changes
None. Ghost state already tracked.

### Open Questions
- [x] ~~Ghost variant~~ → No extra visuals for now. Just animation + existing opacity/grayscale. Wait for art direction.
- [x] ~~Death animation style~~ → Quick and snappy. Will iterate on exact feel.

---

## Phase 9: Endgame Transition — Sudden Death Announcement

**Current:** `endgame_round_start` fires. No fanfare.

**Target:** Dramatic full-screen announcement.

### Frontend
- Full-screen overlay, large text announcement
- Text animates in with impact (scale 2x→1x with shake, or slam from top)
- Background dims/darkens
- ~2s hold, then overlay fades and endgame UI appears
- Subtle color shift (more intense/red-tinted atmosphere)
- Optional screen shake

### Backend Changes
None. `endgame_round_start` already fires.

### Open Questions
- [x] ~~Text~~ → "FINAL SHOWDOWN" for now. **TODO:** think of something more inspired.
- [x] ~~Finalists in announcement~~ → Not now. Easy to add later.

---

## Phase 10: Endgame Shootout — Quick Draw Energy

**Current:** Ghosts hint, finalists type guesses in an input field. First correct guess wins.

**Target:** Snappy "quick draw" energy. Finalists race to click correct word on the board.

### Sequence — "Standoff"

> **NOTE:** This is a concept direction, not a locked-in design. The "quick draw" energy is the goal but the exact presentation can go in any direction. The "Ready… DRAW!" bit is a fun double meaning (eliminated players *draw* hints) but don't treat it as final.

1. Ghost hints displayed (using Phase 3 system)
2. Board revealed to finalists (same layout for both — no shuffling)
3. Brief **"Ready…"** text (1s)
4. **"DRAW!"** slams onto screen — board becomes clickable
5. Finalists get **one shot** — click a word to guess, or don't guess and play it safe
6. Clicked word animates to center (reuse Phase 6A mechanic)
7. Correct: celebration effect, round ends
8. Wrong: locked out for the rest of the round. Board grays out. No second chance.
9. Timer counting down adds urgency
10. If neither finalist guesses (or both guess wrong), round ends — new endgame round begins with fresh hints

**Design note:** One-shot guessing creates a high-stakes risk/reward dynamic — go for it or play it safe and wait for better hints next round. **Playtest this.** If it feels too punishing or stale (players never guess), consider alternatives:
- Allow 2-3 guesses with increasing lockout
- Wrong guess eliminates 1 word from the board instead of full lockout
- Wrong guess deals damage but allows continued guessing

### Frontend
- Reuse word-board click mechanic from Phase 6A
- "Ready… DRAW!" timed animation sequence
- Wrong guess: board grays out immediately, locked for rest of round
- No opponent feedback — wrong guesses hidden from the other finalist (allows mindgames)

### Backend Changes

| Change | Detail |
|--------|--------|
| Validate endgame guess is a board word | In `endgame_submit_guess`, reject if not in `board_words` |
| One-shot lockout | If finalist guesses wrong, server rejects any further guesses from them for the rest of the round |

### Open Questions
- [x] ~~Same board or shuffled~~ → Same board layout for both finalists.
- [x] ~~Wrong guesses visible to opponent~~ → No. Hidden for mindgame freedom.
- [x] ~~Lockout duration~~ → Rest of round. One-shot guess.
- [x] ~~Multiple guesses~~ → One-shot. Playtest, keep alternatives noted above.
- [x] ~~Ready/DRAW vibe~~ → Yes as concept. Not locked in — can take any direction.

---

## Phase 11: Game End Announcement

**Current:** `game_over` shows winner name. Players can return to lobby.

**Target:** Dramatic game end announcement with celebration.

### Frontend
- Full-screen overlay (celebratory version of Sudden Death overlay)
- **Win scenario:** Winner's avatar displayed prominently, scaled up. Large text: **"[Name] WINS!"** with celebratory animation. CSS-only confetti/particle effect.
- **Draw scenario:** Both finalists shown. Large text: **"DRAW!"**
- After ~4s, "Return to Lobby" button appears

### Draw Scenarios (current backend behavior)
1. **Both finalists die same round:** In endgame, if both players have 1 HP and both guess wrong (or time out), both take damage → 0 active players → `game_over` with `winner_id: null`. **Already handled.**
2. **Disconnects reducing to <2 connected players mid-game:** Currently the backend marks disconnected players as `is_connected: false` and skips their turns, but does NOT trigger a game over. **Not yet handled** — if only 1 connected player remains, the game limps on waiting for disconnected players.

### Backend Changes

| Change | Detail |
|--------|--------|
| (Future) Game stats in `game_over` | Rounds played, morps caught, etc. for a stats/results screen. Deferred — ties into BisnisPinguin's lobby UI work. |
| Disconnect draw detection | If only ≤1 connected non-ghost players remain mid-game, trigger `game_over` as a draw (or win if 1 remains). **Needs investigation** — current disconnect handling doesn't check this. |

### Open Questions
- [x] ~~Stats screen~~ → Deferred. Future task, likely ties into lobby UI work (BisnisPinguin).
- [x] ~~Play Again vs Return to Lobby~~ → "Return to Lobby" button only for now.
- [x] ~~Draw scenario~~ → Both-die draw already works (`winner_id: null`). Disconnect-triggered draw needs backend work (noted above).

---

## Backend Change Request Summary

| # | Change | Phase | Priority | Complexity |
|---|--------|-------|----------|------------|
| 1 | Add `display_duration` to `hint_received` + server-side display hold | 3 | High | Medium |
| 2 | New message: `next_turn` (sent after display hold) | 3 | High | Low |
| 3 | Hint timer implementation (configurable duration, auto-skip on timeout) | 3 | High | Medium |
| 4 | New config: `hint_timer_duration` in lobby config (default 60s, range 5s–5min) | 3 | High | Low |
| 5 | Vote timer implementation (configurable duration, abstain on timeout) | 4 | High | Medium |
| 6 | New config: `vote_timer_duration` in lobby config (default 45s, range 5s–5min) | 4 | High | Low |
| 7 | Early close: reduce timer to min(remaining, 5s) when all votes are in | 4 | High | Low |
| 8 | Add `reveal_order` to `accusation_result` | 5 | High | Low |
| 9 | Auto-start next round timer after `round_end` | 7 | High | Medium |
| 10 | New message: `round_starting` with countdown | 7 | High | Low |
| 11 | Validate morp guess is a board word | 6A | Medium | Low |
| 12 | Validate endgame guess is a board word | 10 | Medium | Low |
| 13 | One-shot endgame lockout (reject further guesses after wrong answer) | 10 | Medium | Low |
| 14 | Disconnect draw detection (game over if ≤1 connected non-ghost players remain) | 11 | Medium | Medium |
| 15 | (Future) Game stats in `game_over` message | 11 | Low | Medium |

---

## Branching Strategy

Each branch groups related phases by dependency and scope. Small PRs, easy to review, easy to revert. Branch from main, PR back to main.

| Branch | Phases | Why grouped |
|--------|--------|-------------|
| `vote-and-damage-avatars` | 4, 6B | Same UI pattern (click avatars), no backend changes |
| `word-board-click` | 6A | Small scope, small backend validation |
| `hint-display-overhaul` | 3 | Large, self-contained, needs backend work |
| `role-reveal` | 2, 5 | Both role-related; Phase 2 pure frontend, Phase 5 needs backend |
| `round-transitions` | 7, 8 | Round lifecycle (auto-transition + death animation) |
| `endgame-overhaul` | 9, 10, 11 | Endgame is one connected flow |
| `magnetic-snap` | 1 | Isolated cross-layout animation |

---

## Implementation Order (suggested)

| Order | Phase | Branch | Reason |
|-------|-------|--------|--------|
| 1 | Phase 4 — Vote via avatars | `vote-and-damage-avatars` | Isolated, no backend changes, quick win |
| 2 | Phase 6B — Damage via avatars | `vote-and-damage-avatars` | Same pattern as voting |
| 3 | Phase 6A — Word board click for guess | `word-board-click` | Small backend validation needed |
| 4 | Phase 2 — Board fade + role reveal | `role-reveal` | Pure frontend animation |
| 5 | Phase 5 — Dramatic role reveal | `role-reveal` | Needs backend `reveal_order` |
| 6 | Phase 3 — Hint display overhaul | `hint-display-overhaul` | Most complex frontend work |
| 7 | Phase 7 — Auto-transition | `round-transitions` | Needs backend timer |
| 8 | Phase 8 — Death animation | `round-transitions` | Placeholder, waiting on art |
| 9 | Phase 1 — Magnetic snap | `magnetic-snap` | Pure frontend, cross-layout animation |
| 10 | Phase 9 — Sudden death announcement | `endgame-overhaul` | Pure frontend overlay |
| 11 | Phase 10 — Endgame shootout | `endgame-overhaul` | Needs backend changes + creative iteration |
| 12 | Phase 11 — Game end announcement | `endgame-overhaul` | Pure frontend overlay |

---

## TLDR — Phase Summaries (for BisnisPinguin)

| Phase | Name | What's Changing |
|-------|------|-----------------|
| 1 | Lobby → Game Room Transition | Players snap from lobby positions to game seats with a magnetic pull animation. Pure frontend. |
| 2 | Role Assignment & Board Reveal | Players receive a clickable envelope that reveals their role (safe/morp letter). Board fades in after. Art needed: envelope + letter PNGs, SFX. No backend changes. |
| 3 | Hint Display Overhaul | Submitted hints fly to the centerpiece for 5s display, then shrink back to the player as hoverable thumbnails. Server orchestrates turn pacing via new `next_turn` message. New hint timer (default 60s, configurable 5s–5min, slider in lobby — **wait for lobby branch merge**). |
| 4 | Voting via Avatars | Players click avatars to accuse instead of buttons. New vote timer (default 45s, configurable 5s–5min, slider in lobby — **wait for lobby branch merge**). Early close: timer drops to 5s when all votes are in. |
| 5 | Dramatic Role Reveal | After voting, all non-ghost players' roles revealed one by one. Morp always last. Wrong accusation: accused safe player revealed second-to-last for suspense. Server provides `reveal_order`. SFX: reveal.mp3, reveal_morp.mp3. |
| 6A | Morp Guess via Word Board | Morp clicks a word on the board instead of typing. Guess animates to center, result revealed. Server validates guess is a board word. Damage animation is a placeholder hook. |
| 6B | Morp Damage via Avatars | Morp clicks player avatars to deal damage instead of buttons. Punch red hover glow. Confirm step to prevent misclicks. Targeting + damage animations are placeholder hooks. |
| 7 | Auto Round Transition | 5s auto-countdown between rounds (no more host button). Host gets an optional "Hold" button to pause (if simple to implement). Transition visual flair TBD. |
| 8 | Death & Ghost State | Quick snappy death animation before opacity/grayscale ghost treatment. No ghost sprite changes yet — waiting on art direction. |
| 9 | Sudden Death Announcement | Full-screen "FINAL SHOWDOWN" overlay with impact animation when endgame triggers. Pure frontend. |
| 10 | Endgame Shootout | Finalists click words on the board to guess (one-shot per round). "Ready… DRAW!" sequence. Wrong guess locks you out for the round. Opponent doesn't see your wrong guess. Server validates + enforces lockout. |
| 11 | Game End Announcement | Full-screen win/draw overlay with winner avatar + confetti. "Return to Lobby" button. Draw handled when both finalists die same round or disconnects leave ≤1 player. Stats screen deferred. |

**Lobby UI dependencies (BisnisPinguin):**
- Hint timer duration slider (Phase 3) — add after lobby overhaul branch merges
- Vote timer duration slider (Phase 4) — add after lobby overhaul branch merges
- Stats/results screen (Phase 11) — future task, may tie into lobby UI

---

## Deferred Items

| Item | Phase | Reason |
|------|-------|--------|
| Exact envelope auto-dismiss timing | 2 | Tunable during playtesting |
| Centerpiece display duration tuning (currently 5s) | 3 | Hardcoded, tune on backend after playtesting |
| Hint timer lobby slider | 3 | Wait for lobby overhaul branch to merge (BisnisPinguin) |
| Vote timer lobby slider | 4 | Wait for lobby overhaul branch to merge (BisnisPinguin) |
| Thumbnail click behavior (pin, cycle, etc.) | 3 | Gather user testing feedback first |
| Damage animation mechanic (6A: wrong guess self-damage) | 6A | Team still designing the mechanic |
| Damage animation mechanic (6B: morp targeting + player hit) | 6B | Team still designing the mechanic |
| Morp targeting indicator style | 6B | Will iterate like spitball/stickyhand interactions |
| Round transition visual flair | 7 | Needs more design thought, placeholder hook in place |
| Ghost sprite / death animation art | 8 | Waiting on art direction |
| "FINAL SHOWDOWN" text — find something more inspired | 9 | Placeholder text, revisit |
| One-shot endgame guessing — playtest viability | 10 | May need alternatives if too punishing (see Phase 10 design notes) |
| Game stats / results screen | 11 | Future task, ties into BisnisPinguin's lobby UI work |
| Disconnect draw detection | 11 | Backend needs to trigger game over when ≤1 connected non-ghost players remain |

---

## Development Guidelines

**User testing before merge.** Every branch must go through a user testing pass before merging to main. Add test cases to `user_testing.md` as part of the PR. Feedback from testing may result in iteration before merge — do not skip this step.

**Atomic commits.** For larger tasks spanning multiple files or concerns, break work into atomic commits that each represent a coherent, self-contained change. This makes review easier and reverts safer.

**Backlog and changelog discipline.** When starting a new task, check `backlog.md` for related queued items that may be superseded or affected. When a branch merges, move completed items out of the backlog and add a dated entry to `changelog.md`. The backlog is the single source of truth for what's planned; the changelog is the record of what shipped.

---

## Testing Checklists

Each branch should list expected visual observations so testers know exactly what to look for.

### `vote-and-damage-avatars` (Phases 4 + 6B)

**Voting Phase — expected observations:**
- When voting opens, non-self non-ghost avatars become interactive
- **Hover glow:** moving the mouse over a voteable avatar shows a faint mint green outline (3px, semi-transparent) and subtle green box-shadow around the moop
- **Selection ring:** clicking an avatar shows a solid mint green outline with stronger glow — clearly distinct from the hover state
- **Swap behavior:** with 1 morp, clicking a different avatar swaps the selection (no need to deselect first)
- **Deselect:** clicking the already-selected avatar removes the selection
- **Submit button:** disabled until a vote is selected; reads "Submit Vote" (singular) for 1 morp
- **After submit:** "Votes submitted — waiting…" text appears; submit button stays disabled
- **After accusation resolves:** all voteable styling (outlines, glows) clears from avatars

**Damage Phase — expected observations:**
- If you are the morp, non-ghost non-morp avatars become interactive
- **Hover glow:** moving the mouse over a damageable avatar shows a faint punch red outline and subtle red box-shadow
- **Selection ring:** clicking an avatar shows a solid punch red outline with stronger glow
- **Confirm button:** "Deal damage to [name]" button enables and shows the selected player's name
- **Swap behavior:** clicking a different avatar switches the selection
- **After confirm:** damage is dealt, all damageable styling clears
- **Non-morp view:** non-morp players see "Waiting for morp to deal damage…" with no interactive avatars
