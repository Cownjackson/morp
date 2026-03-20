# Playwright Lobby Script

Opens N browser windows (2–10) all joined to the same Morp lobby for local multiplayer testing — no manual name entry or code copying.

## Setup (one-time)

```bash
cd scripts
npm install
```

This installs Playwright and its Chromium browser.

## Usage

```bash
node open_lobby.js [n] [baseUrl]
```

| Argument | Default | Description |
|---|---|---|
| `n` | `2` | Number of players (2–10) |
| `baseUrl` | `http://localhost:27182` | URL of the running Morp frontend |

**Examples:**

```bash
# 2 players, default URL
node open_lobby.js

# 4 players, default URL
node open_lobby.js 4

# 4 players, custom port
node open_lobby.js 4 http://localhost:27182
```

Press **Ctrl+C** in the terminal to close all browser windows and end the session.

## What it does

1. Opens a visible Chromium window for player `1`, navigates to `baseUrl`
2. Fills in name `"1"` and clicks **Create Lobby**
3. Waits for the lobby code to appear in `#lobby-code-display`
4. For each subsequent player: opens a new isolated browser context, fills in their name and the lobby code, and clicks **Join**
5. All windows stay open until you kill the process

## Key selectors (for reference)

| Element | Selector |
|---|---|
| Name input | `#player-name` |
| Create button | `button:has-text("Create Lobby")` |
| Code input | `#join-code` |
| Join button | `button:has-text("Join")` |
| Connection confirmed | `#lobby-code-display:not(.hidden)` |

The lobby code is read from `#lobby-code-display` which has the format `"Lobby Code: XXXXXX"`.

## Files

- `scripts/open_lobby.js` — the script
- `scripts/package.json` — Playwright dependency
