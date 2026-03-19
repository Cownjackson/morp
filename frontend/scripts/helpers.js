import { state } from './state.js';
import { AVATAR_COLORS, ACTIONS } from './constants.js';

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
  document.getElementById('phase-label').textContent = text;
}

export function setEndgamePhaseLabel(text) {
  document.getElementById('endgame-phase-label').textContent = text;
}

export function showAction(name) {
  ACTIONS.forEach(a => document.getElementById(`act-${a}`)?.classList.toggle('hidden', a !== name));
}

export function showScreen(name) {
  state.screen = name;
  document.getElementById('pregame-layout').classList.toggle('hidden', name !== 'pregame');
  document.getElementById('game-layout').classList.toggle('hidden', name !== 'ingame');
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
  document.getElementById('landing-logo').classList[method]('hidden');
  document.getElementById('landing-footer').classList[method]('hidden');
  document.querySelector('header').classList[show ? 'add' : 'remove']('landing-mode');
  document.body.classList[show ? 'add' : 'remove']('is-landing');
  document.querySelector('.card-row').classList[method]('hidden');
  if (show) {
    document.getElementById('pregame-layout').classList.add('hidden');
    document.getElementById('game-layout').classList.add('hidden');
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
