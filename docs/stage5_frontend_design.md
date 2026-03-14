# Morp — Stage 5 Frontend Design

> Living document. Start with open questions; fill in decisions as they're made.

---

## 1. Goals

Replace the plain HTML test client with a polished, expressive frontend where players can represent themselves visually through a customizable orb, react to the game with orb-to-orb interactions, and feel more connected to other players during play.

**Non-goals for this stage:**
- _TBD_

---

## 2. Key Decisions

These must be resolved before implementation begins. Fill in as decisions are made.

| # | Question | Decision | Notes |
|---|---|---|---|
| 1 | Frontend framework (plain JS / React / Vue / Svelte) | TBD | |
| 2 | Orb rendering technology (CSS/SVG vs Canvas/WebGL) | TBD | |
| 3 | Cosmetics persistence (localStorage vs server-side profile) | TBD | |
| 4 | Interaction mechanics — purely cosmetic or game-effect? | TBD | |
| 5 | Which interactions ship in Stage 5 (MVP interaction list) | TBD | |
| 6 | New backend WS events required? | TBD | |
| 7 | Mobile support in scope for Stage 5? | TBD | |

---

## 3. Visual Design

### 3.1 Layout
- _TBD_

### 3.2 Orb Design
- _TBD_ — shape, base appearance, animation states (idle, hinting, voting, eliminated/ghost, etc.)

### 3.3 Game Board
- _TBD_ — carries over from prototype or redesigned?

### 3.4 Speech Bubbles / Hint Display
- **⚠️ Key layout constraint (drawing hints):** When drawing hints are enabled, players submit vector stroke drawings instead of text. The test client displays these as small thumbnails in speech bubbles above orbs and as a labeled scrollable list in the voting panel. Neither approach scales well to a polished UI with many players. Stage 5 will need a dedicated solution — options include a modal/drawer gallery, a split-panel layout with a hint review pane, or thumbnail cards with tap-to-expand. This is a first-class layout problem and should be resolved before designing the voting and hint-phase screens.
- The drawing canvas in the test client is 560×360 pixels. Stroke coordinates are stored at that resolution and scaled at render time. Stage 5 should pick a canonical source resolution and document it so display canvases everywhere scale consistently.

---

## 4. Cosmetics System

### 4.1 Cosmetic Categories
- _TBD_ — e.g. base color, accessories (hat, glasses, ...), facial features, trail/aura

### 4.2 Equip Flow
- _TBD_ — where does the player configure their orb? (lobby screen, dedicated menu, etc.)

### 4.3 Persistence
- _TBD_ — depends on Decision #3

### 4.4 Cosmetic Scope (MVP list)
- _TBD_

---

## 5. Interactions System

### 5.1 What Is an Interaction?
- _TBD_ — triggered by player, targets another player's orb, produces a visual (and optionally mechanical) effect

### 5.2 MVP Interaction List
- _TBD_

### 5.3 Interaction Rules
- When can interactions be triggered? (any time / hint phase only / etc.) — _TBD_
- Are interactions visible to all players or only sender/target? — _TBD_
- Rate limiting / cooldowns — _TBD_

### 5.4 Backend Requirements
- New WS message types needed — _TBD_
- Server-side validation / rate limiting — _TBD_

---

## 6. Tech Stack

| Layer | Technology | Status |
|---|---|---|
| Framework | TBD | Decision #1 |
| Orb rendering | TBD | Decision #2 |
| Build tooling | TBD | Depends on framework choice |
| Backend | Python / FastAPI / WebSockets | Unchanged |

---

## 7. Backend Changes

_List new or modified endpoints and WS message types required. To be filled in once Decisions #4–6 are resolved._

### New REST endpoints
- _TBD_

### New WebSocket messages (server → client)
- _TBD_

### New WebSocket messages (client → server)
- _TBD_

---

## 8. Resolved Decisions

_Moved here from Section 2 as decisions are finalized._

_(none yet)_

---

## 9. Out of Scope (Stage 5)

- _TBD_
