# Morp — Backlog

Items move here when planned, to `changelog.md` when shipped.

**Tags:** `[feature]` `[bug]` `[dev]` `[design]`
**Owners:** `@cownj` `@bisnispinguin` or unowned

---

## In Progress

- [ ] **[feature]** Lobby UI refinement — @bisnispinguin

---

## Queued

- [ ] **[feature]** Hint/skip timer — auto-submit blank hint when a player's turn times out (idle or disconnected); same behavior for both cases — unowned
- [ ] **[bug]** Blank drawing renders brighter than base canvas — submitted empty drawing has unexpected brightness — unowned
- [ ] **[feature]** Ghost heckling interactions — implemented but untested; needs a proper test pass — unowned
- [ ] **[feature]** num_morps picker in lobby UI — expose existing engine config in the lobby; needs UX thought (max morps relative to player count) — unowned
- [ ] **[feature]** Mobile optimization — layout and input handling for phones/tablets — unowned
- [ ] **[feature]** Configurable starting HP — host setting before game start — unowned
- [ ] **[feature]** Configurable max hint length — currently hard-capped at 30 chars — unowned
- [ ] **[dev]** No-cache middleware — `Cache-Control: no-cache` on `/scripts/` and `/styles/` in DEV mode; already prototyped, see `test_notes.md` — unowned

---

## Needs Discussion

- [ ] **[design]** Stage 5 key decisions — framework (plain JS / React / Vue / Svelte), rendering tech (CSS/SVG vs Canvas/WebGL), cosmetics persistence (localStorage vs server-side profile), interaction scope — see `stage5_frontend_design.md §2`
- [ ] **[design]** Multi-morp voting balance — n-votes-each is the starting rule but unvalidated; flag after playtesting
- [ ] **[design]** Lobby banning — kicked players can currently rejoin under the same name; acceptable for now but worth revisiting

---
