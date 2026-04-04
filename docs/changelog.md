# Morp — Changelog

Completed work, newest first. Add an entry when a PR merges or a standalone change ships.

---

## 2026-04-03

- **[dev]** PR #47 review fixes: cache middleware cleanup (query strings removed from JS imports, middleware already handles no-store headers); removed dead `setPhaseLabel()` code (~13 call sites); deduplicated hail-mary UI (single element moved between hint and draw sections using `syncHailMaryPosition` pattern); fixed hail-mary drawing mode bugs (canvas clear and sound replay on cancel); added 7 cache middleware backend tests; updated user testing docs with long-term error monitoring guidance

---

## 2026-03-29

- **[feature]** Goomba stomp damage animation — morp avatar jumps in a high arc, lands on target with progressive cartoon squish (scaleY→0.35), elastic spring recovery, then bounces back to seat; rAF-driven 4-phase animation (~970ms); render guard prevents DOM wipe mid-animation; animation lock defers round_end
- **[fix]** Hint thumbnails persist through damage — cleared at role reveal start so they don't linger through damage/round-end phases
- **[fix]** Damage stall on missing target — backend pre-validates target exists before engine call; cleans up pending morps if target left; widened exception handler catches KeyError
- **[feature]** Radial vote pointers — replaced line+pointer accusation display with scholastic pointer fingers placed radially around each voter's avatar, aimed at their accused target; 512×512 art at 156px display; pointers linger through full role reveal then fade out; rendered inside `.avatar-wrap` below envelope overlays
- **[feature]** Hover-to-enlarge hint thumbnails — thumbnails now enlarge on hover (previously click-only); click-to-pin still works outside vote/damage phases; during voting, clicks pass through to register the vote; transition skip on re-render prevents animation replay
- **[fix]** Boards blocking votes — centerpiece hint cards cleared when voting opens; hint thumbnails no longer intercept vote/damage clicks
- **[fix]** Hint thumbnail z-index — raised above hat layer so thumbnails aren't hidden behind player accessories
- **[feature]** Endgame UI alignment — ghost hints now display as held-card thumbnails with click-to-expand (matching normal rounds) instead of speech bubbles; ghost drawing input uses a floating popup instead of inline block; red morp spotlight during damage phase; draw popup auto-closes on hail mary
- **[feature]** Hail Mary mechanic — morps can attempt an early guess of the target word at any point during the hint phase; correct guess lets them deal damage, wrong guess costs 1 HP; dramatic animation sequence (splash popup → word guess → full role reveal envelopes → damage/round end); disconnect-safe with 12 new backend tests

---

## 2026-03-28

- **[feature]** Meow interaction sounds — backend picks a random meow from `music/meows/` and broadcasts it so all players hear the same clip
- **[feature]** Noise overlay for self-interactions — bark and meow cycle `noise1.png`/`noise2.png` texture over the player avatar as a visual indicator
- **[feature]** Your-turn notification sound — `your_turn.mp3` plays when it's your turn to draw a hint (normal rounds + endgame ghost hints)
- **[fix]** Blank drawing rendering — empty canvas submissions now render as white instead of transparent
- **[feature]** Responsive game room layout — CSS Grid layout (`grid-template-rows: auto auto 1fr`) fills viewport with zero scrolling on mobile (430px), tablet (768px), 1080p, 1440p, and ultrawide; board and action area auto-center with fluid `clamp()` sizing; player orbit fills remaining space with container-relative avatar scaling
- **[feature]** Held-card hint thumbnails — hints display as small rotated cards tucked against player avatars; side-aware placement flips hints for right-side players on tablet/mobile; click-to-expand with smooth scale animation
- **[feature]** Pass-through chat — chat panel uses `pointer-events: none` so clicks reach hints underneath; messages auto-fade after 5s; focus on input re-enables interaction; hidden scrollbar
- **[feature]** Visible timers for all players — hint timer now displays for non-active players (auto-submit only fires for the active player)
- **[feature]** Envelope auto-open — role reveal envelope auto-opens after 3 seconds if not clicked
- **[feature]** White drawing canvas — canvas background changed from dark grey to white; default stroke color changed from near-white to dark (#222)
- **[feature]** Turn notification sound — plays when it becomes your turn to hint
- **[feature]** iOS web app icons — added home screen icons for iOS
- **[feature]** Custom avatar sprites — added Buffy and Oscar moop sprites
- **[fix]** First-render avatar sizing — deferred `renderInGamePlayerRow` via `requestAnimationFrame` when container has zero dimensions after screen transition
- **[fix]** Hint timer default — increased from 60s to 120s for drawing hints
- **[dev]** Static layout mockup (`test-layout.html`) — standalone test page linking real CSS for visual iteration at multiple viewport sizes

---

## 2026-03-24

- **[feature]** Animated hint lifecycle — submitted hints fly from the player avatar to a centerpiece, hold for `display_duration` (5s), then fly back and shrink to a persistent thumbnail above the player; shared pipeline for text and drawing hints (Phase 3)
- **[feature]** Floating drawing popup — drawing panel moved to a fixed popup window that auto-opens on your turn; can be minimized and reopened via pill button; hides automatically on submit or turn end
- **[feature]** Hint timer — configurable countdown (default 60s, 5s steps) shown while it's your turn; starts only after the player's turn UI is visible (`hint_turn_ready` gate); auto-submits current strokes or typed text on expire, skips if empty
- **[feature]** Click-to-expand hint thumbnails — click any thumbnail to scale it up (6×) for readability; click again or anywhere outside to collapse
- **[dev]** `phase_ready` gate for hints — frontend signals backend after each hint animation completes; backend holds `next_turn` until signal received, keeping all clients in sync
- **[dev]** `flyHintToThumbnailWhenReady` — queues the fly-back callback if `next_turn` arrives before the client's animation has armed `_inflightHint`, preventing premature draw popup on slow clients
- **[dev]** `hint_timer_duration` config — added to `LobbyConfig` (default 60s); `hint_timer_slider` in pregame options panel; broadcast in `round_start` and `next_turn`

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
