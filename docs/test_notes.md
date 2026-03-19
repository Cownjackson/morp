# Test Notes

## Backend: Interaction cooldown (`main.py`)

Server-side cooldown of 1.5s per player per lobby (`_INTERACTION_COOLDOWN`).

### Cases to cover

**Cooldown enforcement**
- Player sends two interactions within 1.5s — second should be silently dropped
- Player sends two interactions >1.5s apart — both should broadcast
- Different players in the same lobby can interact simultaneously without blocking each other
- Same player in different lobbies has independent cooldown tracking

**Target validation**
- Valid connected non-ghost target — should broadcast
- Target that is disconnected — should raise "Target is not available."
- Target that is a ghost (eliminated) — should raise "Target is not available."
- `target_id` not in `engine.lobby.players` — should raise "Target is not available."
- No `target_id` (self-interaction) — should broadcast without target validation

**Input validation**
- Empty `interaction` string — should raise "Missing interaction."
- Interaction string longer than 32 chars — should be truncated and broadcast

**Memory cleanup**
- All `_interaction_times` keys for a lobby should be removed when the last player disconnects
