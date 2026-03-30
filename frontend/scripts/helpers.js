import { state } from './state.js';
import { AVATAR_COLORS, ACTIONS } from './constants.js';
import { showInteractionTrigger, mountInteractionTrigger } from './interactions.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const _colorMap = {};
let _colorNext = 0;

export function avatarColor(pid) {
  if (!(pid in _colorMap)) _colorMap[pid] = _colorNext++ % AVATAR_COLORS.length;
  return AVATAR_COLORS[_colorMap[pid]];
}

export function initials(name) {
  return (name || '?').split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
}

export function playerName(id) {
  return state.players[id]?.name || id?.slice(0, 8) || '?';
}

export function setPhaseLabel(text) {
  document.getElementById('phase-label')?.textContent = text;
}

export function setEndgamePhaseLabel(text) {
  document.getElementById('endgame-phase-label').textContent = text;
}

function getLobbyCodeCopyButtons() {
  return ['pregame-lobby-code-copy', 'ingame-lobby-code-copy']
    .map(id => document.getElementById(id))
    .filter(Boolean);
}

export function setLobbyCodeCopyButtonState(copied = false) {
  const text = copied ? 'Copied' : 'Copy';
  const label = copied ? 'Lobby code copied' : 'Copy lobby code';
  getLobbyCodeCopyButtons().forEach(button => {
    button.textContent = text;
    button.title = label;
    button.setAttribute('aria-label', label);
  });
}

export function showLobbyCodeDisplays(lobbyId) {
  const lobbyCodeText = `Lobby Code: ${lobbyId}`;
  const ingameCodeEl = document.getElementById('lobby-code-display');
  const pregameCodeEl = document.getElementById('pregame-lobby-code-display');
  const pregameCopyEl = document.getElementById('pregame-lobby-code-copy');
  const ingameCopyEl = document.getElementById('ingame-lobby-code-copy');

  if (ingameCodeEl) {
    ingameCodeEl.textContent = lobbyCodeText;
    ingameCodeEl.classList.remove('hidden');
  }

  if (pregameCodeEl) {
    pregameCodeEl.textContent = lobbyCodeText;
    pregameCodeEl.classList.remove('hidden');
  }

  if (pregameCopyEl) {
    setLobbyCodeCopyButtonState(false);
    pregameCopyEl.classList.remove('hidden');
  }

  if (ingameCopyEl) {
    setLobbyCodeCopyButtonState(false);
    ingameCopyEl.classList.remove('hidden');
  }
}

export function hideLobbyCodeDisplays() {
  document.getElementById('lobby-code-display')?.classList.add('hidden');
  document.getElementById('pregame-lobby-code-display')?.classList.add('hidden');
  document.getElementById('pregame-lobby-code-copy')?.classList.add('hidden');
  document.getElementById('ingame-lobby-code-copy')?.classList.add('hidden');
}

export function showAction(name) {
  ACTIONS.forEach(a => document.getElementById(`act-${a}`)?.classList.toggle('hidden', a !== name));
}

function _callBackgroundMoopApi(functionName, ...args) {
  const fn = window[functionName];
  if (typeof fn === 'function') {
    fn(...args);
    return true;
  }
  return false;
}

export function clearPregameLobbyMoops() {
  if (_callBackgroundMoopApi('setBackgroundMoopMode', 'off')) return;
  _callBackgroundMoopApi('syncBackgroundPlayers', []);
}

export function syncPregameLobbyMoops(players = []) {
  if (_callBackgroundMoopApi('setBackgroundMoopMode', 'pregame')) {
    _callBackgroundMoopApi('syncPregameLobbyMoops', players);
    return;
  }
  _callBackgroundMoopApi('syncBackgroundPlayers', players);
}

function syncScreenClasses(screenName) {
  document.body.classList.toggle('screen-pregame', screenName === 'pregame');
  document.body.classList.toggle('screen-ingame', screenName === 'ingame');
}

let backgroundLogoRefreshTimeout = 0;
let backgroundLogoRefreshLateTimeout = 0;

export function refreshBackgroundLogoPaint({ delayed = false, late = false } = {}) {
  const refresh = window.refreshBackgroundLogoPaint;
  if (typeof refresh === 'function') {
    refresh();
    requestAnimationFrame(() => refresh());
    clearTimeout(backgroundLogoRefreshTimeout);
    clearTimeout(backgroundLogoRefreshLateTimeout);

    if (delayed) {
      backgroundLogoRefreshTimeout = window.setTimeout(() => refresh(), 120);
    }

    if (late) {
      backgroundLogoRefreshLateTimeout = window.setTimeout(() => refresh(), 280);
    }
  }
}

export function showScreen(name) {
  state.screen = name;
  document.getElementById('pregame-layout').classList.toggle('hidden', name !== 'pregame');
  document.getElementById('game-layout').classList.toggle('hidden', name !== 'ingame');
  syncScreenClasses(name);
  if (state.lobbyId) showLobbyCodeDisplays(state.lobbyId);
  else hideLobbyCodeDisplays();
  refreshBackgroundLogoPaint({ delayed: true });
  if (name !== 'pregame') clearPregameLobbyMoops();
  if (name === 'ingame') mountInteractionTrigger();
  showInteractionTrigger(name === 'ingame');
}

// ─── Logging ──────────────────────────────────────────────────────────────────
export function log(msg, cls = '') {
  const el = document.getElementById('log');
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
}

export function toggleLog() {
  const hidden = document.getElementById('log').classList.toggle('hidden');
  document.getElementById('log-toggle').textContent = (hidden ? '▸' : '▾') + ' Event Log';
}

// ─── Landing show/hide helper ──
export function showLanding(show) {
  const method = show ? 'remove' : 'add';
  state.screen = show ? 'landing' : state.screen;
  document.getElementById('landing-main-cluster').classList[method]('hidden');
  document.getElementById('landing-footer').classList[method]('hidden');
  document.body.classList[show ? 'add' : 'remove']('is-landing');
  syncScreenClasses(show ? 'landing' : state.screen);
  refreshBackgroundLogoPaint({ delayed: true });
  document.getElementById('chat-wrap').classList.toggle('hidden', show);
  if (show) {
    clearPregameLobbyMoops();
    document.getElementById('pregame-layout').classList.add('hidden');
    document.getElementById('game-layout').classList.add('hidden');
    showInteractionTrigger(false);
  }
}

// ─── REST helpers ─────────────────────────────────────────────────────────────
export function httpBase() {
  return document.getElementById('server-url').value.replace(/^ws/, 'http');
}

export function _checkProtocol() {
  if (location.protocol === 'file:') {
    log('Open this app via http://localhost:2718 — direct file:// access is not supported.', 'error');
    return false;
  }
  return true;
}
