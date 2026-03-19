# Playwright Lobby Script Plan

## Goal
Automate opening N browser windows (2–10) all joined to the same lobby for faster local testing — no manual name entry or code copying.

## Files to Create
- `scripts/open_lobby.js` — main script
- `scripts/package.json` — `{ "dependencies": { "playwright": "*" } }`

## Usage
```bash
cd scripts && npm install
node open_lobby.js [n] [baseUrl]
# e.g. node open_lobby.js 4 http://localhost:2718
```

## Flow
1. Launch Chromium (`headless: false`)
2. Open isolated context for player `1` → go to `baseUrl`
3. Fill `#player-name` = `"1"` → click `button:has-text("Create Lobby")`
4. Wait for `#lobby-code-display:not(.hidden)` → extract code from text `"Lobby Code: XXXXXX"`
5. For players `2`–`n`: new context → go to `baseUrl` → fill name → fill `#join-code` → click `"Join"` → wait for `#lobby-code-display:not(.hidden)`

## Key Selectors
| Element | Selector |
|---|---|
| Name input | `#player-name` |
| Create button | `button:has-text("Create Lobby")` |
| Code input | `#join-code` |
| Join button | `button:has-text("Join")` |
| Connection confirmed | `#lobby-code-display:not(.hidden)` |

## Notes
- Each player needs a separate `browser.newContext()` for isolated storage/session
- Lobby code is in the format `"Lobby Code: XXXXXX"` — strip prefix to get raw code
- Default URL: `http://localhost:2718`
- Max 10 players per lobby (enforced by CLI arg validation)
