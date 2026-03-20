#!/usr/bin/env node
/**
 * open_lobby.js — Open N browser windows all joined to the same Morp lobby.
 *
 * Usage:
 *   node open_lobby.js [n] [baseUrl]
 *
 * Examples:
 *   node open_lobby.js              # 2 players, http://localhost:2718
 *   node open_lobby.js 4            # 4 players, http://localhost:2718
 *   node open_lobby.js 4 http://localhost:3000
 *
 * Prerequisites:
 *   cd scripts && npm install
 */

const { chromium } = require('playwright');

const DEFAULT_URL = 'http://localhost:27182';
const MAX_PLAYERS = 10;

async function newMutedContext(browser) {
  const ctx = await browser.newContext();
  // Seed localStorage before any page script runs so initMusic() sees morp_muted=true.
  await ctx.addInitScript(() => localStorage.setItem('morp_muted', 'true'));
  return ctx;
}

async function main() {
  const n = parseInt(process.argv[2] ?? '2', 10);
  const baseUrl = process.argv[3] ?? DEFAULT_URL;

  if (isNaN(n) || n < 2 || n > MAX_PLAYERS) {
    console.error(`Player count must be between 2 and ${MAX_PLAYERS}. Got: ${process.argv[2]}`);
    process.exit(1);
  }

  console.log(`Opening ${n} players at ${baseUrl}…`);

  const browser = await chromium.launch({ headless: false });

  // --- Player 1: create the lobby ---
  const ctx1 = await newMutedContext(browser);
  const page1 = await ctx1.newPage();
  await page1.goto(baseUrl);

  await page1.fill('#player-name', '1');
  await page1.click('#moop-random-btn');
  await page1.click('button:has-text("Create Lobby")');

  // Wait for the lobby code to appear
  await page1.waitForSelector('#lobby-code-display:not(.hidden)', { timeout: 10_000 });
  const rawText = await page1.textContent('#lobby-code-display');
  const lobbyCode = rawText.replace('Lobby Code:', '').trim();

  if (!lobbyCode) {
    console.error('Could not extract lobby code from display element.');
    await browser.close();
    process.exit(1);
  }

  console.log(`Lobby created — code: ${lobbyCode}`);
  await page1.bringToFront();

  // --- Players 2–n: join the lobby ---
  for (let i = 2; i <= n; i++) {
    const ctx = await newMutedContext(browser);
    const page = await ctx.newPage();
    await page.goto(baseUrl);

    await page.fill('#player-name', String(i));
    await page.click('#moop-random-btn');
    await page.fill('#join-code', lobbyCode);
    await page.click('button:has-text("Join")');

    await page.waitForSelector('#lobby-code-display:not(.hidden)', { timeout: 10_000 });
    console.log(`Player ${i} joined.`);
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
