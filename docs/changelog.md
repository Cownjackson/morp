# Morp — Changelog

Completed work, newest first. Add an entry when a PR merges or a standalone change ships.

---

## 2026-03-21

- **[feature]** Lobby UI layout polish — active players button repositioned for a cleaner lobby layout (PR #23)
- **[feature]** Moop customization menu refinement — customizer UI and cosmetics handling cleanup (PR #22)
- **[feature]** Background block corner bounces — corner bounce effects cleaned up and expanded (PR #21)
- **[bug]** Mobile background viewport handling — stabilized large-style background rendering on mobile (PR #20)
- **[bug]** Responsive background scaling — background sizing and refresh behavior cleaned up for better mobile rendering (PR #19)
- **[feature]** Bouncing moop tuning — size and motion tweaks for the lobby background effect (PR #18)
- **[feature]** Lobby controls update — added lobby copy button, active players button, and exit-to-main-menu button (PR #17)

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
