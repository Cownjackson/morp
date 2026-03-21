import { state, send } from './state.js';
import { showScreen, setPhaseLabel } from './helpers.js';
import { renderRoleBanner, renderPregameLobby, renderChat } from './rendering.js';
import { _drawState, clearCanvas } from './drawing.js';
import { _timers, clearTimer } from './timers.js';

// ─── Actions ──────────────────────────────────────────────────────────────────
export function startGame() {
  send({
    type: 'start_game',
    timers_enabled: document.getElementById('timers-toggle').checked,
    drawing_hints: document.getElementById('drawing-hints-toggle').checked,
  });
}

export function nextRound() { send({ type: 'next_round' }); }

export function submitHint() {
  if (state.drawingHints) {
    const strokes = _drawState['hint-canvas']?.strokes ?? [];
    send({ type: 'submit_hint', drawing_data: strokes });
    clearCanvas('hint-canvas');
  } else {
    const input = document.getElementById('hint-input');
    const text = input.value.trim();
    if (!text) return;
    send({ type: 'submit_hint', text });
    input.value = '';
  }
}

export function submitVotes() {
  if (state.selectedVotes.length !== state.numVotes) return;
  send({ type: 'submit_votes', accused_ids: state.selectedVotes });
  document.getElementById('btn-submit-votes').disabled = true;
  document.getElementById('vote-waiting').style.display = 'inline';
}

export function submitMorpGuess() {
  const input = document.getElementById('guess-input');
  const guess = input.value.trim();
  if (!guess) return;
  send({ type: 'submit_morp_guess', guess });
  input.disabled = true;
  document.getElementById('btn-morp-guess').disabled = true;
}

export function submitEndgameGhostHint() {
  if (state.drawingHints) {
    const strokes = _drawState['endgame-ghost-canvas']?.strokes ?? [];
    send({ type: 'endgame_submit_ghost_hint', drawing_data: strokes });
    clearCanvas('endgame-ghost-canvas');
    document.getElementById('endgame-ghost-drawing-block').classList.add('hidden');
  } else {
    const input = document.getElementById('endgame-ghost-hint-input');
    const text = input.value.trim();
    if (!text) return;
    send({ type: 'endgame_submit_ghost_hint', text });
    input.disabled = true;
  }
}

export function submitEndgameGuess() {
  const input = document.getElementById('endgame-guess-input');
  const guess = input.value.trim();
  if (!guess) return;
  send({ type: 'endgame_submit_guess', guess });
  input.disabled = true;
  document.getElementById('btn-endgame-guess').disabled = true;
}

export function _localResetToLobby() {
  Object.assign(state, {
    role: null, halfBoard: null, targetWord: null,
    board: null, turnOrder: [], hints: [],
    speechBubbles: {}, selectedVotes: [], numVotes: 1,
    isGhost: false, endgameTargetWord: null, hostId: null,
    drawingHints: false, lobbyStarted: false,
    avatarInteraction: null, damageTarget: null, _morpIdsForDamage: [],
  });
  Object.keys(_timers).forEach(clearTimer);
  renderRoleBanner();
  document.getElementById('board-area').classList.add('hidden');
  showScreen('pregame');
  renderPregameLobby();
  renderChat();
  setPhaseLabel('WAITING');
}

export function resetToLobby() {
  _localResetToLobby();
  if (state.isHost && state.ws) send({ type: 'reset_game' });
}

let _chatCooldown = false;

export function sendChat() {
  if (_chatCooldown) return;
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  state.chatMessages.push({
    player_id: state.playerId,
    name: state.playerName,
    text,
    pendingLocal: true,
  });
  renderChat();
  send({ type: 'chat', text });
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  _chatCooldown = true;
  const btn = document.getElementById('btn-chat-send');
  btn.disabled = true;
  setTimeout(() => {
    _chatCooldown = false;
    btn.disabled = false;
    input.focus();
  }, 1000);
}
