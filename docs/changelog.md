# Morp — Changelog

Completed work, newest first. Add an entry when a PR merges or a standalone change ships.

---

## 2026-03-22

- **[feature]** Vote arrow visualization — after voting, directional arrows point from each voter to their accused target before the dramatic role reveal; uses pointer.png asset tip; renders via interaction-anim-layer with scroll tracking
- **[feature]** `votes` map in `accusation_result` — server includes full `{ voter_id: [accused_ids] }` map for arrow rendering
- **[fix]** Interaction animations scroll-locked — sticky hand, projectile, spitball, and hand mark now track scroll offset per frame so they stay locked to avatars if the user scrolls mid-animation
- **[feature]** Envelope role reveal — on round start, players see a sealed envelope with wax seal; click to open reveals their role letter (safe/morp) with layered envelope art and SFX; board fades in after dismissal (Phase 2)
- **[feature]** Dramatic role reveal after voting — all non-ghost players get closed envelopes on their avatars; envelopes open one by one in server-dictated order (safe first, accused safe second-to-last, morp last) with letter_open SFX; ~1.5s per reveal with extra morp pause (Phase 5)
- **[feature]** Client-ready signaling (`phase_ready`) — frontend signals backend when animation-gated transitions complete; replaces hardcoded animation duration sleeps; backend waits with 30s timeout fallback
- **[feature]** `reveal_order` in `accusation_result` — server builds ordered reveal array for all non-ghost players; `build_reveal_order()` in voting module with 4 unit tests
- **[fix]** Animation lock supports custom timeouts — `_startAnimationLock(timeoutMs)` for longer animations; deferred messages with deadlines get shifted forward by lock duration
- **[fix]** Removed vestigial accusation result panel — dramatic reveal replaces old instant accusation display; cleaned up HTML, renderAccusation(), ACTIONS entry
- **[dev]** Art assets — envelope_closed, envelope_opened_back, envelope_opened_front, safe_letter, morp_letter PNGs; letter_open.mp3 SFX

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
- **[feature]** Lobby UI layout polish — active players button repositioned for a cleaner lobby layout (PR #23)
- **[feature]** Moop customization menu refinement — customizer UI and cosmetics handling cleanup (PR #22)
- **[feature]** Background block corner bounces — corner bounce effects cleaned up and expanded (PR #21)
- **[bug]** Mobile background viewport handling — stabilized large-style background rendering on mobile (PR #20)
- **[bug]** Responsive background scaling — background sizing and refresh behavior cleaned up for better mobile rendering (PR #19)
- **[feature]** Bouncing moop tuning — size and motion tweaks for the lobby background effect (PR #18)
- **[feature]** Lobby controls update — added lobby copy button, active players button, and exit-to-main-menu button (PR #17)
- **[feature]** Avatar-based voting and damage targeting — players click avatars to vote/deal damage instead of buttons; mint/red glow selection indicators (Phases 4 + 6B)
- **[dev]** Game room flow overhaul design doc — 12-phase spec with backend change requests, branching strategy, testing checklists

## 2026-03-20

- **[feature]** Cleaner front page and pregame lobby UI — simplified lobby layout with broader UI cleanup pass (PR #15)
- **[feature]** Bouncing moop — scaling, hitbox fixes, and lobby bugfix (PR #14)
- **[feature]** Floating lobby player moops — moops appear and float for each connected player in the lobby; new `moop-sprite.js`; background block improvements (PR #13)

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
