# Morp — Changelog

Completed work, newest first. Add an entry when a PR merges or a standalone change ships.

---

## 2026-03-21

- **[feature]** Word board click for morp guess — morp clicks board words instead of typing; word toss animation with server-echo timing; board word validation on backend (Phase 6A)
- **[feature]** Endgame board click + simultaneous reveal — finalists click board words to guess; guesses accumulate until both submit, then resolve together with side-by-side word toss animations; first-correct-wins tiebreaking with submission order tracking (Phase 10 partial)
- **[feature]** Animation lock system — defers lobby_update, round_end, damage, and other state-changing messages while word toss animations play; prevents early HP/damage reveals and host-skips-animation bugs; 5s safety timeout
- **[feature]** Endgame draw mechanic — when both finalists' correct guesses are auto-submitted by the timer, the round is a draw with no damage; frontend sends `auto_submitted` flag
- **[feature]** No-guess indicator — "failed to guess!" message with 2s pause when morp times out with no word selected
- **[feature]** Slower correct guesser yellow card — in endgame, when both guess correctly, the slower submitter's word toss card flashes yellow/amber instead of green
- **[fix]** Endgame no longer auto-starts after final voting phase — transition pauses at "Sudden Death" announcement screen; host clicks to start
- **[fix]** Finalists can submit endgame guess during ghost hint phase — board selection enabled at endgame round start
- **[fix]** Board selection preserved across hint phase end — finalist's pre-selected word no longer cleared when ghost hint phase transitions to guess phase
- **[feature]** Avatar-based voting and damage targeting — players click avatars to vote/deal damage instead of buttons; mint/red glow selection indicators (Phases 4 + 6B)
- **[dev]** Game room flow overhaul design doc — 12-phase spec with backend change requests, branching strategy, testing checklists

## 2026-03-20

- **[feature]** Bouncing moop — scaling, hitbox fixes, and lobby bugfix (PR #14)
- **[feature]** Floating lobby player moops — moops appear and float for each connected player in the lobby; new `moop-sprite.js`; background block improvements (PR #13)
- **[dev]** Front page UI cleanup

## 2026-03-19

- **[feature]** Spitball interaction — onscreen spit effect with tuned overlay (PR #12)
- **[feature]** Frontend facelift P1 — visual pass on game UI (PR #11)
- **[feature]** Game interactions — spit, sticky hand slap, core interaction mechanics with server-side cooldown (PR #10)
- **[feature]** Lobby UI rework — new lobby format, background block physics (Lissajous curve, spin decay, corner effect) (PR #9)

## 2026-03-18

- **[feature]** Lobby state rework — frontend lobby state handling overhaul (PR #8)

## 2026-03-17

- **[bug]** UI scaling and bug fixes (PR #7)
- **[feature]** Main menu satisfaction update (PR #6)
- **[feature]** Frontend facelift pt 1 (PR #4)

## 2026-03-16

- **[feature]** Front page UI changes (PR #3)
- **[feature]** Bouncing blocks — background block physics foundation (PR #2)

## Earlier

- **[feature]** Drawing-based hints — players submit vector stroke drawings; drawing sidebar (vertical layout beside canvas), extended hand-picked palette, active color preview, quadrupled max stroke size
- **[feature]** Fill tool — functional but color consistency still occasionally off
- **[feature]** Moop customization — cosmetics system shipped (colors, accessories)
- **[feature]** Lobby chat — up to 150 chars, 1s cooldown
- **[feature]** Copy custom word template — easier custom board creation
- **[feature]** Server maintenance popup — notifies players when server restarts mid-lobby
- **[feature]** New music
- **[bug]** Timer fixes — timer behaviour was broken in multiple cases
- **[bug]** Host elimination lockup — game locked on new round start if host was eliminated
- **[bug]** Endgame ghost hints — all eliminated players now share hints simultaneously instead of one by one
- **[milestone]** Stage 4 — Fly.io hosting live (`fly.toml`, `Dockerfile`, deploy script)
- **[milestone]** Stage 3 — Backend finalized: disconnect handling, custom boards, kick player, host reassignment (159 tests passing)
- **[milestone]** Stage 2 — Full core game mechanics backend + expanding frontend
- **[milestone]** Stage 1 — Backend scaffolding + barebones test frontend
- **[milestone]** Stage 0 — Requirements, user stories, design doc

---
