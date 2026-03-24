#!/usr/bin/env node
/**
 * open_lobby.js — Open N browser windows all joined to the same Morp lobby.
 *
 * Usage:
 *   node open_lobby.js [n] [baseUrl]
 *
 * Examples:
 *   node open_lobby.js              # 2 players, http://localhost:27182
 *   node open_lobby.js 4            # 4 players, http://localhost:27182
 *   node open_lobby.js 4 http://localhost:3000
 *
 * Layout: windows are tiled across 2 monitors.
 *   Primary   → floor(n/2) players stacked vertically  (player 1 always here)
 *   Secondary → ceil(n/2)  players stacked vertically
 *   e.g. 2→1|1, 3→1|2, 4→2|2, 5→2|3, 6→3|3
 *
 * Configure monitor dimensions and positions in scripts/.env (see .env.example).
 *
 * Prerequisites:
 *   cd scripts && npm install
 */

require('dotenv').config();
const { chromium } = require('playwright');

const DEFAULT_URL = 'http://localhost:27182';
const MAX_PLAYERS = 10;

// PRIMARY = the monitor where windows open by default (x=0).
// SECONDARY = the other monitor; use negative SECONDARY_X if it's left of primary.
// All values are in physical pixels as used by the Chrome DevTools Protocol.
const PW = parseInt(process.env.PRIMARY_W   ?? '1920', 10);
const PH = parseInt(process.env.PRIMARY_H   ?? '1080', 10);
const PX = parseInt(process.env.PRIMARY_X   ?? '0',    10);
const PY = parseInt(process.env.PRIMARY_Y   ?? '0',    10);
const SW = parseInt(process.env.SECONDARY_W ?? '1920', 10);
const SH = parseInt(process.env.SECONDARY_H ?? '1080', 10);
// Default: secondary is directly left of primary (negative x).
const SX = parseInt(process.env.SECONDARY_X ?? String(-SW), 10);
const SY = parseInt(process.env.SECONDARY_Y ?? '0',         10);

async function newMutedContext(browser) {
  // viewport: null lets the page render to the actual window size so the game
  // scales correctly after window positioning.
  const ctx = await browser.newContext({ viewport: null });
  // Seed localStorage before any page script runs so initMusic() sees morp_muted=true.
  await ctx.addInitScript(() => localStorage.setItem('morp_muted', 'true'));
  return ctx;
}

/**
 * Build tile bounds for n players across 2 monitors.
 * Returns an array of {left, top, width, height} in player order (player 1 first).
 *   Primary   → first floor(n/2) players
 *   Secondary → remaining ceil(n/2) players
 */
function buildLayout(n) {
  const primaryCount   = Math.floor(n / 2);
  const secondaryCount = n - primaryCount;
  const layout = [];

  for (let i = 0; i < primaryCount; i++) {
    layout.push({
      left:   PX + Math.floor((i * PW) / primaryCount),
      top:    PY,
      width:  Math.floor(PW / primaryCount),
      height: PH,
    });
  }

  for (let i = 0; i < secondaryCount; i++) {
    layout.push({
      left:   SX + Math.floor((i * SW) / secondaryCount),
      top:    SY,
      width:  Math.floor(SW / secondaryCount),
      height: SH,
    });
  }

  return layout;
}

/** Move and resize a browser window using the Chrome DevTools Protocol. */
async function positionWindow(page, bounds, label) {
  const session = await page.context().newCDPSession(page);
  try {
    const { windowId } = await session.send('Browser.getWindowForTarget');
    await session.send('Browser.setWindowBounds', {
      windowId,
      bounds: { ...bounds, windowState: 'normal' },
    });
    // Read back what Chrome actually applied.
    const { bounds: actual } = await session.send('Browser.getWindowBounds', { windowId });
    console.log(`  ${label}: set=${JSON.stringify(bounds)} actual=${JSON.stringify(actual)}`);
  } finally {
    await session.detach();
  }
}

async function main() {
  const n = parseInt(process.argv[2] ?? '2', 10);
  const baseUrl = process.argv[3] ?? DEFAULT_URL;

  if (isNaN(n) || n < 2 || n > MAX_PLAYERS) {
    console.error(`Player count must be between 2 and ${MAX_PLAYERS}. Got: ${process.argv[2]}`);
    process.exit(1);
  }

  console.log(`Opening ${n} players at ${baseUrl}…`);

  const layout = buildLayout(n);
  const browser = await chromium.launch({ headless: false });

  // --- Player 1: create the lobby ---
  const ctx1 = await newMutedContext(browser);
  const page1 = await ctx1.newPage();
  await page1.goto(baseUrl);

  await page1.fill('#player-name', '1');
  await page1.click('#moop-random-btn');
  await page1.click('button:has-text("Create Lobby")');

  // Wait for the lobby code to appear
  await page1.waitForSelector('#pregame-lobby-code-display:not(.hidden)', { timeout: 10_000 });
  const rawText = await page1.textContent('#pregame-lobby-code-display');
  const lobbyCode = rawText.replace('Lobby Code:', '').trim();

  if (!lobbyCode) {
    console.error('Could not extract lobby code from display element.');
    await browser.close();
    process.exit(1);
  }

  console.log(`Lobby created — code: ${lobbyCode}`);
  console.log('Positioning windows (physical px):');
  await positionWindow(page1, layout[0], 'Player 1');

  // --- Players 2–n: join the lobby ---
  for (let i = 2; i <= n; i++) {
    const ctx = await newMutedContext(browser);
    const page = await ctx.newPage();
    await page.goto(baseUrl);

    await page.fill('#player-name', String(i));
    await page.click('#moop-random-btn');
    await page.fill('#join-code', lobbyCode);
    await page.click('button:has-text("Join")');

    await page.waitForSelector('#pregame-lobby-code-display:not(.hidden)', { timeout: 10_000 });
    console.log(`Player ${i} joined.`);
    await positionWindow(page, layout[i - 1], `Player ${i}`);
  }

  // Return focus to the lobby leader.
  await page1.bringToFront();

  console.log(`\nAll ${n} players connected. Close this terminal to end the session.`);
  // Keep the process alive so the browser windows stay open.
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
