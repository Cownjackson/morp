import { state, send } from './state.js';
import { showScreen, setPhaseLabel, showLanding, httpBase, log, hideLobbyCodeDisplays, setLobbyCodeCopyButtonState } from './helpers.js';
import { renderRoleBanner, renderPregameLobby, renderChat, enableBoardWordSelection, disableBoardWordSelection, hideDrawPopup, hideEndgameDrawPopup } from './rendering.js';
import { _drawState, clearCanvas } from './drawing.js';
import { _timers, clearTimer } from './timers.js';
import { _setConnectBusy, markIntentionalClose, clearIntentionalClose, closeWS } from './websocket.js';

// ─── Actions ──────────────────────────────────────────────────────────────────
export function startGame() {
  send({
    type: 'start_game',
    timers_enabled: document.getElementById('timers-toggle').checked,
    drawing_hints: document.getElementById('drawing-hints-toggle').checked,
    hint_timer_duration: document.getElementById('hint-timer-slider').valueAsNumber,
  });
}

export function nextRound() { send({ type: 'next_round' }); }

export function submitHint() {
  if (state.drawingHints) {
    const strokes = _drawState['hint-canvas']?.strokes ?? [];
    send({ type: 'submit_hint', drawing_data: strokes });
    clearCanvas('hint-canvas');
    hideDrawPopup();
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
  const guess = state.boardWordSelected;
  if (!guess) return;
  send({ type: 'submit_morp_guess', guess });
  disableBoardWordSelection();
  document.getElementById('btn-morp-guess').disabled = true;
  // Animation waits for server echo (morp_guess_result) so all players see it in sync
}

export function enterHailMary() {
  document.getElementById('btn-hail-mary').classList.add('hidden');
  document.getElementById('hail-mary-confirm').classList.remove('hidden');
  document.getElementById('your-turn-block').classList.add('hidden');
  enableBoardWordSelection();
  state._hailMaryMode = true;
}

export function cancelHailMary() {
  state._hailMaryMode = false;
  disableBoardWordSelection();
  document.getElementById('hail-mary-confirm').classList.add('hidden');
  document.getElementById('btn-hail-mary').classList.remove('hidden');
  document.getElementById('btn-hail-mary-guess').disabled = true;
  document.getElementById('hail-mary-selected-word').textContent = '—';
  // Restore your-turn block if it's your turn
  const rs = state.turnOrder;
  const hintCount = state.hints?.length ?? 0;
  if (rs && rs[hintCount] === state.playerId) {
    document.getElementById('your-turn-block').classList.remove('hidden');
  }
}

export function submitHailMary() {
  const guess = state.boardWordSelected;
  if (!guess) return;
  state._hailMaryMode = false;
  send({ type: 'submit_hail_mary', guess });
  disableBoardWordSelection();
  document.getElementById('btn-hail-mary-guess').disabled = true;
}

export function submitEndgameGhostHint() {
  if (state.drawingHints) {
    const strokes = _drawState['endgame-ghost-canvas']?.strokes ?? [];
    send({ type: 'endgame_submit_ghost_hint', drawing_data: strokes });
    clearCanvas('endgame-ghost-canvas');
    hideEndgameDrawPopup();
  } else {
    const input = document.getElementById('endgame-ghost-hint-input');
    const text = input.value.trim();
    if (!text) return;
    send({ type: 'endgame_submit_ghost_hint', text });
    input.disabled = true;
  }
}

export function submitEndgameGuess() {
  const guess = state.boardWordSelected;
  if (!guess) return;
  send({ type: 'endgame_submit_guess', guess });
  disableBoardWordSelection();
  document.getElementById('btn-endgame-guess').disabled = true;
  // No animation here — wait for endgame_guesses_revealed so both play together
}

export function _localResetToLobby() {
  Object.assign(state, {
    role: null, halfBoard: null, targetWord: null,
    board: null, turnOrder: [], hints: [],
    speechBubbles: {}, selectedVotes: [], numVotes: 1,
    isGhost: false, endgameTargetWord: null, hostId: null,
    drawingHints: false, lobbyStarted: false,
    avatarInteraction: null, damageTarget: null, _morpIdsForDamage: [],
    boardSelectionMode: false, boardWordSelected: null,
    _hailMaryMode: false, _hailMaryDamage: false,
    _spotlightPid: null, _spotlightStyle: null,
  });
  Object.keys(_timers).forEach(clearTimer);
  hideDrawPopup();
  hideEndgameDrawPopup();
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

let _leavingLobby = false;
let _copyLobbyCodeResetTimeout = 0;

function resetLobbyCodeCopyButton() {
  window.clearTimeout(_copyLobbyCodeResetTimeout);
  _copyLobbyCodeResetTimeout = 0;
  setLobbyCodeCopyButtonState(false);
}

function _setLeaveUiBusy(busy) {
  _setConnectBusy(busy);
  document.getElementById('pregame-exit-btn')?.toggleAttribute('disabled', busy);
}

function _localReturnToMainMenu() {
  Object.assign(state, {
    ws: null,
    screen: 'landing',
    lobbyId: null,
    playerId: null,
    playerName: null,
    lobbyStarted: false,
    isHost: false,
    hostId: null,
    role: null,
    halfBoard: null,
    targetWord: null,
    board: null,
    turnOrder: [],
    hints: [],
    players: {},
    chatMessages: [],
    speechBubbles: {},
    selectedVotes: [],
    numVotes: 1,
    _accusedMorpIds: [],
    isGhost: false,
    endgameTargetWord: null,
    drawingHints: false,
    avatarInteraction: null,
    damageTarget: null,
    _morpIdsForDamage: [],
    _hailMaryMode: false,
    _hailMaryDamage: false,
  });
  Object.keys(_timers).forEach(clearTimer);
  renderRoleBanner();
  document.getElementById('board-area').classList.add('hidden');
  hideLobbyCodeDisplays();
  resetLobbyCodeCopyButton();
  document.getElementById('role-banner').className = '';
  document.getElementById('role-banner').textContent = '';
  document.getElementById('panel-connect').classList.remove('hidden');
  showLanding(true);
  renderChat();
  setPhaseLabel('');
}

export async function copyLobbyCode() {
  if (!state.lobbyId) return;

  const lobbyCode = state.lobbyId.trim();
  if (!lobbyCode) return;

  const fallbackCopy = () => {
    const input = document.createElement('textarea');
    input.value = lobbyCode;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
  };

  try {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(lobbyCode);
      } catch {
        fallbackCopy();
      }
    } else {
      fallbackCopy();
    }

    const button = document.getElementById('pregame-lobby-code-copy');
    if (!button) return;
    resetLobbyCodeCopyButton();
    setLobbyCodeCopyButtonState(true);
    _copyLobbyCodeResetTimeout = window.setTimeout(() => {
      resetLobbyCodeCopyButton();
    }, 1200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Copy failed: ${message}`, 'error');
    resetLobbyCodeCopyButton();
  }
}

export async function leaveLobby() {
  if (_leavingLobby || !state.lobbyId || !state.playerId) return;
  _leavingLobby = true;
  _setLeaveUiBusy(true);
  markIntentionalClose();

  try {
    const response = await fetch(`${httpBase()}/lobby/${state.lobbyId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: state.playerId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      clearIntentionalClose();
      throw new Error(body.detail || `Error ${response.status}`);
    }
    closeWS();
    _localReturnToMainMenu();
  } catch (error) {
    clearIntentionalClose();
    const message = error instanceof Error ? error.message : String(error);
    log(`Leave failed: ${message}`, 'error');
  } finally {
    _setLeaveUiBusy(false);
    _leavingLobby = false;
  }
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
