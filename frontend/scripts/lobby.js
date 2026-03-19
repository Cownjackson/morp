import { state } from './state.js';
import { log, httpBase, _checkProtocol } from './helpers.js';
import { getCosmetics } from './cosmetics.js';
import { connectWS, _setConnectBusy } from './websocket.js';

// ─── Lobby ────────────────────────────────────────────────────────────────────
let _connecting = false;

export async function createLobby() {
  log(`createLobby called, _connecting=${_connecting}`, 'info');
  if (!_checkProtocol() || _connecting) return;
  const name = document.getElementById('player-name').value.trim();
  if (!name) { log('Enter a name to start a lobby.', 'warn'); return; }
  _connecting = true;
  _setConnectBusy(true);
  const base = httpBase();
  try {
    const createRes = await fetch(`${base}/lobby/create`, { method: 'POST' });
    if (!createRes.ok) {
      const body = await createRes.json().catch(() => ({}));
      log(`Create lobby failed: ${body.detail || createRes.status}`, 'error');
      _connecting = false;
      _setConnectBusy(false);
      return;
    }
    const { lobby_id } = await createRes.json();
    const joinRes = await fetch(`${base}/lobby/${lobby_id}/join`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, cosmetics: getCosmetics() }),
    });
    if (!joinRes.ok) {
      const body = await joinRes.json().catch(() => ({}));
      log(`Join failed: ${body.detail || joinRes.status}`, 'error');
      _connecting = false;
      _setConnectBusy(false);
      return;
    }
    const { player_id } = await joinRes.json();
    _connecting = false;
    connectWS(lobby_id, player_id, name);
  } catch (e) {
    log(`Create lobby failed: ${e}`, 'error');
    _connecting = false;
    _setConnectBusy(false);
  }
}

export async function joinLobby() {
  log(`joinLobby called, _connecting=${_connecting}`, 'info');
  if (!_checkProtocol() || _connecting) return;
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  const name = document.getElementById('player-name').value.trim();
  if (!name) { log('Enter a name to join a game.', 'warn'); return; }
  if (!code) { log('Enter a lobby code.', 'warn'); return; }
  _connecting = true;
  _setConnectBusy(true);
  try {
    const r = await fetch(`${httpBase()}/lobby/${code}/join`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, cosmetics: getCosmetics() }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      log(`Join failed: ${body.detail || (r.status === 404 ? 'Lobby not found.' : 'Error.')}`, 'error');
      _connecting = false;
      _setConnectBusy(false);
      return;
    }
    const { player_id } = await r.json();
    _connecting = false;
    connectWS(code, player_id, name);
  } catch (e) {
    log(`Join failed: ${e}`, 'error');
    _connecting = false;
    _setConnectBusy(false);
  }
}

export function copyBoardTemplate() {
  const template = JSON.stringify([
    {
      "board_hint": "Theme name here",
      "words": [
        "word1",  "word2",  "word3",  "word4",  "word5",
        "word6",  "word7",  "word8",  "word9",  "word10",
        "word11", "word12", "word13", "word14", "word15",
        "word16", "word17", "word18", "word19", "word20",
        "word21", "word22", "word23", "word24", "word25"
      ]
    }
  ], null, 2);
  navigator.clipboard.writeText(template).then(() => {
    const btn = document.getElementById('copy-template-btn');
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
}

export async function setCustomBoards() {
  const raw = document.getElementById('custom-boards-input').value.trim();
  const statusEl = document.getElementById('custom-boards-status');
  if (!raw) {
    statusEl.textContent = 'using defaults';
    statusEl.style.color = '#907880';
    return;
  }
  let boards;
  try {
    boards = JSON.parse(raw);
    if (!Array.isArray(boards)) throw new Error('Expected a JSON array.');
  } catch (e) {
    statusEl.textContent = `Invalid JSON: ${e.message}`;
    statusEl.style.color = '#FEAED2';
    return;
  }
  try {
    const r = await fetch(`${httpBase()}/lobby/${state.lobbyId}/boards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: state.playerId, boards }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      statusEl.textContent = body.detail || `Error ${r.status}`;
      statusEl.style.color = '#FEAED2';
      return;
    }
    statusEl.textContent = `${body.boards_set} custom board${body.boards_set === 1 ? '' : 's'} set`;
    statusEl.style.color = '#87DCAB';
  } catch (e) {
    statusEl.textContent = `Request failed: ${e}`;
    statusEl.style.color = '#FEAED2';
  }
}
