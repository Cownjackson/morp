# Morp — Backlog

Items move here when planned, to `changelog.md` when shipped.

**Workflow:** Planned → backlog → in progress → when ready, add test cases to `user_testing.md` → once testing passes, close out to `changelog.md`

**Tags:** `[feature]` `[bug]` `[dev]` `[design]`
**Owners:** `@cownj` `@bisnispinguin` or unowned

---

## In Progress

- [ ] **[feature]** Game room flow overhaul — full redesign of in-game experience across 12 phases; see `game_room_overhaul.md` for spec — @cownj
  - [x] Phase 4 — Vote via avatars (`vote-and-damage-avatars`, merged)
  - [x] Phase 6B — Damage via avatars (`vote-and-damage-avatars`, merged)
  - [x] Phase 6A — Word board click (`word-board-click`, ready to merge)
  - [x] Phase 9 — Sudden Death pause screen (partial, `word-board-click`)
  - [x] Phase 10 — Endgame board click + simultaneous reveal (partial, `word-board-click`)
  - [ ] Phase 2 — Role assignment & board reveal
  - [ ] Phase 5 — Dramatic role reveal
  - [ ] Phase 3 — Hint display overhaul
  - [ ] Phase 7 — Auto round transition
  - [ ] Phase 8 — Death animation
  - [ ] Phase 1 — Magnetic snap
  - [ ] Phase 9 — Sudden Death fanfare (full-screen overlay, SFX)
  - [ ] Phase 10 — Endgame shootout presentation (Ready… DRAW!, one-shot lockout)
  - [ ] Phase 11 — Game end announcement

---

## Queued

- [ ] **[bug]** Post-game join softlock — if a 4th player joins after a 3-player game ends but before host returns to lobby, the new player becomes host but cannot start the next game; lobby is softlocked — unowned
- [ ] **[bug]** `test_websocket.py` setup error — `test_create_lobby_returns_lobby_id` fails at setup (pre-existing, unrelated to game logic); all 121 engine/game tests pass — unowned
- [ ] **[bug]** Blank drawing renders brighter than base canvas — submitted empty drawing has unexpected brightness — unowned
- [ ] **[feature]** Ghost heckling interactions — implemented but untested; needs a proper test pass — unowned
- [ ] **[feature]** num_morps picker in lobby UI — expose existing engine config in the lobby; needs UX thought (max morps relative to player count) — unowned
- [ ] **[feature]** Mobile optimization — layout and input handling for phones/tablets — unowned
- [ ] **[feature]** Configurable starting HP — host setting before game start — unowned
- [ ] **[feature]** Configurable max hint length — currently hard-capped at 30 chars — unowned
- [ ] **[dev]** No-cache middleware — `Cache-Control: no-cache` on `/scripts/` and `/styles/` in DEV mode; already prototyped, see `test_notes.md` — unowned

---

## Needs Discussion

- [ ] **[design]** Multi-morp voting balance — n-votes-each is the starting rule but unvalidated; flag after playtesting
- [ ] **[design]** Lobby banning — kicked players can currently rejoin under the same name; acceptable for now but worth revisiting

---
