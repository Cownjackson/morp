import { state, send } from './state.js';
import { hideLobbyCodeDisplays, log, playerName, setPhaseLabel, setEndgamePhaseLabel, showAction, showLanding, showLobbyCodeDisplays, showScreen } from './helpers.js';
import { renderRoleBanner, renderBoard, renderPregameLobby, renderInGamePlayerRow, enableAvatarVoting, disableAvatarVoting, enableAvatarDamage, checkYourTurn, renderChat, enableBoardWordSelection, disableBoardWordSelection, animateWordGuess, resolveWordGuess, animateEndgameReveal, showEnvelopeReveal, playRoleRevealSequence, showVoteArrows, showHintAtCenterpiece, flyHintToThumbnail, flyHintToThumbnailWhenReady, resetHintThumbnailAnimations, hideDrawPopup, playYourTurnSound } from './rendering.js';
import { handleInteraction } from './interactions.js';
import { _localResetToLobby } from './actions.js';
import { startTimer, clearTimer } from './timers.js';
import { _drawState, clearCanvas, finalizeStroke } from './drawing.js';

// ─── WebSocket ────────────────────────────────────────────────────────────────
let _wsRetries = 0;
let _wsKicked = false;
let _wsMaintenance = false;
let _wsIntentionalClose = false;
const _WS_MAX_RETRIES = 4;
const _WS_RETRY_BASE_MS = 1500;

export function _setConnectBusy(busy) {
  document.querySelectorAll('#panel-connect button').forEach(b => b.disabled = busy);
}

export function markIntentionalClose() {
  _wsIntentionalClose = true;
}

export function clearIntentionalClose() {
  _wsIntentionalClose = false;
}

export function closeWS() {
  const ws = state.ws;
  state.ws = null;
  if (ws && ws.readyState < WebSocket.CLOSING) {
    ws.close(4000, 'Leaving lobby');
  }
}

export function connectWS(lobbyId, playerId, name, isRetry) {
  state.lobbyId = lobbyId; state.playerId = playerId; state.playerName = name;
  if (!isRetry) {
    _wsRetries = 0; _wsKicked = false; _wsMaintenance = false; _wsIntentionalClose = false;
    Object.assign(state, {
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
      hintThumbnails: {},
      selectedVotes: [],
      numVotes: 1,
      _accusedMorpIds: [],
      isGhost: false,
      endgameTargetWord: null,
      drawingHints: false,
      avatarInteraction: null,
      damageTarget: null,
      _morpIdsForDamage: [],
      boardSelectionMode: false,
      boardWordSelected: null,
    });
  }

  state.ws = new WebSocket(`${document.getElementById('server-url').value}/ws/${lobbyId}/${playerId}`);

  state.ws.onopen = () => {
    _wsRetries = 0;
    log(`Connected to lobby ${lobbyId} as ${name}`, 'ok');
    showLobbyCodeDisplays(lobbyId);
    document.getElementById('panel-connect').classList.add('hidden');
    showLanding(false);
    renderRoleBanner();
    showScreen(state.screen === 'ingame' ? 'ingame' : 'pregame');
    if (state.screen === 'ingame') {
      renderInGamePlayerRow();
    } else {
      renderPregameLobby();
    }
    renderChat();
  };

  state.ws.onmessage = e => handleMessage(JSON.parse(e.data));

  state.ws.onclose = e => {
    if (e.code === 4403 || _wsKicked) {
      log('You have been kicked from the lobby.', 'error');
      hideLobbyCodeDisplays();
      document.getElementById('role-banner').className = '';
      document.getElementById('role-banner').textContent = '';
      document.getElementById('panel-connect').classList.remove('hidden');
      showLanding(true);
      _setConnectBusy(false);
      return;
    }
    if (e.code === 4004) {
      log('Lobby not found.', 'error');
      _setConnectBusy(false);
      return;
    }
    if (_wsMaintenance) {
      _setConnectBusy(false);
      return;
    }
    if (_wsIntentionalClose) {
      _wsIntentionalClose = false;
      _setConnectBusy(false);
      return;
    }
    if (_wsRetries < _WS_MAX_RETRIES) {
      _wsRetries++;
      const delay = _wsRetries * _WS_RETRY_BASE_MS;
      log(`WebSocket closed. Retrying in ${delay / 1000}s\u2026 (${_wsRetries}/${_WS_MAX_RETRIES})`, 'warn');
      setTimeout(() => connectWS(lobbyId, playerId, name, true), delay);
    } else {
      log('Connection lost. Refresh the page to reconnect.', 'error');
      _setConnectBusy(false);
    }
  };

  state.ws.onerror = () => {};
}



// ─── Animation lock — defer state-changing messages while animations play ────
let _animationLock = false;
let _animationLockStartedAt = 0;
let _deferredQueue = [];
let _animationLockTimer = null;
const _ANIMATION_LOCK_TIMEOUT_MS = 5000;

const _DEFERRED_TYPES = new Set([
  'lobby_update', 'round_end', 'damage_dealt', 'damage_phase',
  'endgame_round_end', 'round_start', 'endgame_round_start', 'game_over',
]);

function _startAnimationLock(timeoutMs) {
  _animationLock = true;
  _animationLockStartedAt = Date.now();
  clearTimeout(_animationLockTimer);
  _animationLockTimer = setTimeout(_endAnimationLock, timeoutMs || _ANIMATION_LOCK_TIMEOUT_MS);
}

function _endAnimationLock() {
  _animationLock = false;
  const lockDurationSec = (Date.now() - _animationLockStartedAt) / 1000;
  clearTimeout(_animationLockTimer);
  const queued = _deferredQueue.splice(0);
  for (const m of queued) {
    // Shift time-based deadlines forward by how long they were deferred
    if (m.deadline && lockDurationSec > 0) {
      m.deadline += lockDurationSec;
    }
    _processMessage(m);
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────
function handleMessage(msg) {
  log(`← ${msg.type}`, 'info');

  if (_animationLock && _DEFERRED_TYPES.has(msg.type)) {
    log(`   ⏸ deferred (animation lock)`, 'info');
    _deferredQueue.push(msg);
    return;
  }

  _processMessage(msg);
}

function _processMessage(msg) {
  switch (msg.type) {

    case 'kicked': {
      _wsKicked = true;
      break;
    }

    case 'maintenance_shutdown': {
      _wsMaintenance = true;
      hideLobbyCodeDisplays();
      document.getElementById('role-banner').className = '';
      document.getElementById('role-banner').textContent = '';
      document.getElementById('panel-connect').classList.remove('hidden');
      showLanding(true);
      document.getElementById('maintenance-overlay').classList.add('open');
      break;
    }

    case 'lobby_update': {
      state.players     = Object.fromEntries(msg.players.map(p => [p.id, p]));
      state.lobbyStarted = !!msg.started;
      state.hostId      = msg.host_id;
      state.isHost      = msg.host_id === state.playerId;
      state.isGhost     = state.players[state.playerId]?.is_ghost ?? false;
      state.drawingHints = msg.drawing_hints ?? false;
      if (state.screen === 'ingame') {
        renderInGamePlayerRow();
      } else {
        renderPregameLobby();
      }
      setPhaseLabel(msg.started ? 'IN GAME' : 'WAITING');
      if (state.isGhost && state.role !== 'ghost') {
        state.role = 'ghost';
        renderRoleBanner();
      }
      break;
    }

    case 'role_assigned':
      state.role = msg.role;
      state.halfBoard = msg.half_board || null;
      // Don't render banner yet — envelope reveal will show role first
      log(`Your role: ${msg.role}${state.halfBoard ? ' (going first — partial board visible)' : ''}`,
        msg.role === 'morp' ? 'warn' : 'ok');
      break;

    case 'round_start': {
      showScreen('ingame');
      state.lobbyStarted = true;
      state.board      = { board_hint: msg.board_hint, words: msg.words };
      state.turnOrder  = msg.turn_order;
      state.targetWord = msg.target_word || null;
      state.hints         = [];
      state.speechBubbles = {};
      state.hintThumbnails = {};
      state.timersEnabled = msg.timers_enabled ?? true;
      state.hintTimerDuration = msg.hint_timer_duration ?? 120;
      resetHintThumbnailAnimations();
      state.endgameTargetWord = null;
      state.avatarInteraction = null;
      state.damageTarget = null;
      state._morpIdsForDamage = [];
      state.boardSelectionMode = false;
      state.boardWordSelected = null;
      renderBoard();
      renderInGamePlayerRow();
      renderChat();

      // Board starts hidden — will fade in after envelope
      const boardArea = document.getElementById('board-area');
      boardArea.classList.remove('hidden');
      boardArea.style.opacity = '0';
      boardArea.style.transition = 'opacity 0.8s ease';

      setPhaseLabel(`ROUND ${msg.round_number}`);
      log(`Round ${msg.round_number} — "${msg.board_hint}"`, 'ok');

      // Show envelope role reveal, then fade in board and start hint phase
      showEnvelopeReveal(state.role, () => {
        renderRoleBanner();
        boardArea.style.opacity = '1';
        checkYourTurn();
        showAction('hint');
        setPhaseLabel(`ROUND ${msg.round_number} — HINTS`);
        // Show timer for all players; auto-submit only for the active player
        if (state.timersEnabled) {
          const isFirst = state.turnOrder[0] === state.playerId;
          if (isFirst) send({ type: 'hint_turn_ready' });
          const hintTimerEl = document.getElementById('hint-timer');
          hintTimerEl.style.display = '';
          const onExpire = isFirst ? () => {
            if (state.drawingHints) {
              finalizeStroke('hint-canvas');
              const strokes = _drawState['hint-canvas']?.strokes ?? [];
              if (strokes.length > 0) {
                send({ type: 'submit_hint', drawing_data: strokes });
                clearCanvas('hint-canvas');
              }
              hideDrawPopup();
            } else {
              const input = document.getElementById('hint-input');
              const text = input?.value.trim() ?? '';
              if (text) send({ type: 'submit_hint', text });
            }
          } : null;
          startTimer('hint-timer', Date.now() / 1000 + state.hintTimerDuration, onExpire);
        }
      });
      break;
    }

    case 'hint_received': {
      const hintData = { player_id: msg.player_id, text: msg.text || '', is_drawing: msg.is_drawing || false, drawing_data: msg.drawing_data || null };
      state.hints.push(hintData);
      log(msg.is_drawing ? `Drawing hint from ${playerName(msg.player_id)}` : `Hint from ${playerName(msg.player_id)}: "${msg.text || '(skipped)'}"`, '');
      // Always clear the hint timer when a hint is received (someone submitted)
      clearTimer('hint-timer');
      document.getElementById('hint-timer').style.display = 'none';
      if (msg.display_duration) {
        // Live hint — animate to centerpiece, hold, then signal backend
        // hintThumbnails set later by flyHintToThumbnail so thumbnail only appears after animation
        showHintAtCenterpiece(msg, () => send({ type: 'phase_ready' }));
      } else {
        // Rejoin replay — show thumbnail immediately, no animation
        state.hintThumbnails[msg.player_id] = hintData;
        renderInGamePlayerRow();
        checkYourTurn();
      }
      break;
    }

    case 'next_turn': {
      // Update cached timer config in case it changed (it won't mid-game, but belt-and-suspenders)
      if (msg.hint_timer_duration != null) state.hintTimerDuration = msg.hint_timer_duration;
      if (msg.timers_enabled     != null) state.timersEnabled     = msg.timers_enabled;
      const isMyTurn = msg.player_id === state.playerId;
      flyHintToThumbnailWhenReady(() => {
        checkYourTurn();
        if (state.timersEnabled) {
          if (isMyTurn) send({ type: 'hint_turn_ready' });
          const hintTimerEl = document.getElementById('hint-timer');
          hintTimerEl.style.display = '';
          const onExpire = isMyTurn ? () => {
            if (state.drawingHints) {
              finalizeStroke('hint-canvas');
              const strokes = _drawState['hint-canvas']?.strokes ?? [];
              if (strokes.length > 0) {
                send({ type: 'submit_hint', drawing_data: strokes });
                clearCanvas('hint-canvas');
              }
              hideDrawPopup();
            } else {
              const input = document.getElementById('hint-input');
              const text = input?.value.trim() ?? '';
              if (text) send({ type: 'submit_hint', text });
            }
          } : null;
          startTimer('hint-timer', Date.now() / 1000 + state.hintTimerDuration, onExpire);
        }
      });
      break;
    }

    case 'voting_open': {
      clearTimer('hint-timer');
      document.getElementById('hint-timer').style.display = 'none';
      state.hints         = msg.hints;
      state.numVotes      = msg.num_votes;
      state.selectedVotes = [];
      for (const h of msg.hints) {
        // Populate thumbnails for any hints not yet shown (e.g. rejoin during voting)
        if (!state.hintThumbnails[h.player_id]) {
          state.hintThumbnails[h.player_id] = {
            player_id: h.player_id, text: h.text || '', is_drawing: h.is_drawing || false, drawing_data: h.drawing_data || null,
          };
        }
      }
      const openVotingUI = () => {
        if (!state.isGhost) {
          enableAvatarVoting();
          showAction('vote');
        } else {
          renderInGamePlayerRow();
        }
        setPhaseLabel('VOTING');
        log('Voting open!', 'ok');
      };
      // Close draw popup (last hinter may still have it open)
      hideDrawPopup();
      // If the last hinter's card is still at centerpiece, fly it home first
      flyHintToThumbnailWhenReady(openVotingUI);
      break;
    }

    case 'accusation_result': {
      disableAvatarVoting();
      _startAnimationLock(30000);
      // Show vote arrows first, then dramatic role reveal
      setPhaseLabel('VOTES');
      showVoteArrows(msg.votes || {}, () => {
        setPhaseLabel('ROLE REVEAL');
        playRoleRevealSequence(msg.reveal_order || [], () => {
          send({ type: 'phase_ready' });
          _endAnimationLock();
        });
      });
      break;
    }

    case 'morp_guess_phase': {
      state._accusedMorpIds = msg.accused_morp_ids;
      const isMorpBeingAsked = msg.accused_morp_ids.includes(state.playerId);
      document.getElementById('morp-guess-input-block').classList.toggle('hidden', !isMorpBeingAsked);
      document.getElementById('guess-result').textContent =
        isMorpBeingAsked ? '' : `Waiting for ${msg.accused_morp_ids.map(playerName).join(', ')} to guess…`;
      document.getElementById('guess-result').style.color = '#705060';
      if (isMorpBeingAsked) enableBoardWordSelection();
      if (msg.timers_enabled) {
        startTimer('guess-timer', msg.deadline, () => {
          if (isMorpBeingAsked && state.boardSelectionMode) {
            const guess = state.boardWordSelected || '';
            send({ type: 'submit_morp_guess', guess });
            disableBoardWordSelection();
            document.getElementById('btn-morp-guess').disabled = true;
          }
        });
      } else {
        document.getElementById('guess-timer').textContent = '∞';
      }
      showAction('morp-guess');
      setPhaseLabel('MORP GUESS');
      log('Morp is guessing!', 'warn');
      break;
    }

    case 'morp_guess_result': {
      clearTimer('guess-timer');
      const resultText = msg.correct
        ? `✓ ${playerName(msg.morp_id)} guessed correctly! Target: "${msg.target_word}"`
        : `✗ ${playerName(msg.morp_id)} guessed wrong. Target: "${msg.target_word}"${msg.timed_out ? ' (timed out)' : ''}`;
      log(resultText, msg.correct ? 'ok' : 'warn');
      _startAnimationLock();
      if (msg.guess) {
        animateWordGuess(msg.guess);
        resolveWordGuess(msg.correct, () => {
          document.getElementById('guess-result').textContent = resultText;
          document.getElementById('guess-result').style.color = msg.correct ? '#87DCAB' : '#FEAED2';
          state.targetWord = msg.target_word;
          renderBoard();
          _endAnimationLock();
        });
      } else {
        // No guess submitted — show failure message with a brief delay for readability
        document.getElementById('guess-result').textContent =
          `✗ ${playerName(msg.morp_id)} failed to guess! Target: "${msg.target_word}"`;
        document.getElementById('guess-result').style.color = '#FEAED2';
        state.targetWord = msg.target_word;
        renderBoard();
        setTimeout(_endAnimationLock, 2000);
      }
      break;
    }

    case 'damage_phase': {
      const isMorp = msg.morp_ids.includes(state.playerId);
      document.getElementById('damage-morp-action').classList.toggle('hidden', !isMorp);
      document.getElementById('damage-waiting').style.display = isMorp ? 'none' : 'block';
      if (isMorp) enableAvatarDamage(msg.morp_ids);
      showAction('damage');
      setPhaseLabel('DAMAGE');
      break;
    }

    case 'damage_dealt':
      if (state.avatarInteraction === 'damage') {
        state.avatarInteraction = null;
        state.damageTarget = null;
        state._morpIdsForDamage = [];
      }
      log(`${playerName(msg.from_id)} → ${playerName(msg.to_id)} (${msg.hp_remaining} HP${msg.eliminated ? ', eliminated' : ''})`, 'warn');
      break;

    case 'round_end': {
      const isEndgameTransition = !!msg.endgame_transition;
      setPhaseLabel(isEndgameTransition ? 'SUDDEN DEATH' : 'ROUND OVER');
      const rc = document.getElementById('round-end-content');
      rc.innerHTML = '';
      if (isEndgameTransition) {
        const announce = document.createElement('p');
        announce.style.cssText = 'color:#FFCE18;font-size:1.1em;margin-bottom:8px';
        announce.textContent = 'Two players remain — Sudden Death!';
        rc.appendChild(announce);
      }
      if (state.isHost) {
        const btn = document.createElement('button');
        btn.className = 'primary';
        btn.textContent = isEndgameTransition ? 'Start Sudden Death ▶' : 'Next Round ▶';
        btn.onclick = () => { send({ type: 'next_round' }); btn.disabled = true; };
        rc.appendChild(btn);
      } else {
        const wait = document.createElement('p');
        wait.style.cssText = 'color:#453060;font-size:0.88em';
        wait.textContent = isEndgameTransition
          ? 'Waiting for host to start sudden death…'
          : 'Waiting for host to start next round…';
        rc.appendChild(wait);
      }
      showAction('round-end');
      log(isEndgameTransition ? 'Sudden Death!' : 'Round over.', 'ok');
      break;
    }

    // ── 2-Player Endgame ──────────────────────────────────────────────────────

    case 'endgame_round_start': {
      showScreen('ingame');
      state.lobbyStarted = true;
      state.endgameTargetWord = msg.target_word || null;
      state.halfBoard = null;
      state.speechBubbles = {};
      state.board      = { board_hint: msg.board_hint, words: msg.words };
      state.targetWord = state.endgameTargetWord;
      renderBoard();
      renderInGamePlayerRow();
      renderChat();
      document.getElementById('board-area').classList.remove('hidden');

      const isGhost = (msg.ghost_ids || []).includes(state.playerId);
      document.getElementById('endgame-ghost-section').classList.toggle('hidden', !isGhost);
      document.getElementById('endgame-finalist-section').classList.toggle('hidden', isGhost);
      if (isGhost) {
        document.getElementById('endgame-ghost-input-block').classList.remove('hidden');
        document.getElementById('endgame-ghost-text-block').classList.toggle('hidden', state.drawingHints);
        document.getElementById('endgame-ghost-drawing-block').classList.toggle('hidden', !state.drawingHints);
        if (state.drawingHints) clearCanvas('endgame-ghost-canvas');
        document.getElementById('endgame-ghost-waiting').style.display = 'none';
        document.getElementById('endgame-ghost-hint-input').disabled   = false;
        playYourTurnSound();
      } else {
        enableBoardWordSelection();
      }
      document.getElementById('endgame-guess-result').textContent = '';

      clearTimer('endgame-hint-timer');
      clearTimer('endgame-guess-timer');
      document.getElementById('endgame-guess-timer').style.display = 'none';
      const hintTimerEl = document.getElementById('endgame-hint-timer');
      if (msg.timers_enabled) {
        hintTimerEl.style.display = 'inline-block';
        startTimer('endgame-hint-timer', msg.hint_deadline, () => {});
      } else {
        hintTimerEl.style.display = 'none';
      }
      setEndgamePhaseLabel('Ghost Hints');
      showAction('endgame');
      log(`Endgame! ${msg.finalist_ids.map(playerName).join(' vs ')}`, 'warn');
      break;
    }

    case 'endgame_hint_received':
      if (msg.text || msg.is_drawing) {
        state.speechBubbles[msg.player_id] = {
          text: msg.text || '', skipped: false,
          is_drawing: msg.is_drawing || false, drawing_data: msg.drawing_data || null,
        };
        renderInGamePlayerRow();
      }
      if (msg.player_id === state.playerId) {
        document.getElementById('endgame-ghost-input-block').classList.add('hidden');
        document.getElementById('endgame-ghost-waiting').style.display = 'block';
      }
      break;

    case 'endgame_hint_phase_over': {
      if (state.isGhost && !document.getElementById('endgame-ghost-input-block').classList.contains('hidden')) {
        if (state.drawingHints) {
          finalizeStroke('endgame-ghost-canvas');
          const strokes = _drawState['endgame-ghost-canvas']?.strokes ?? [];
          if (strokes.length > 0) send({ type: 'endgame_submit_ghost_hint', drawing_data: strokes });
        } else {
          const text = document.getElementById('endgame-ghost-hint-input').value.trim();
          if (text) send({ type: 'endgame_submit_ghost_hint', text });
        }
      }
      clearTimer('endgame-hint-timer');
      document.getElementById('endgame-hint-timer').style.display  = 'none';
      document.getElementById('endgame-ghost-section').classList.add('hidden');
      const guessTimerEl = document.getElementById('endgame-guess-timer');
      const isFinalist2 = !state.isGhost;
      if (isFinalist2 && !state.boardSelectionMode) enableBoardWordSelection();
      if (msg.timers_enabled) {
        guessTimerEl.style.display = 'inline-block';
        startTimer('endgame-guess-timer', msg.guess_deadline, () => {
          if (isFinalist2 && state.boardSelectionMode) {
            const guess = state.boardWordSelected || '';
            send({ type: 'endgame_submit_guess', guess, auto_submitted: true });
            disableBoardWordSelection();
            document.getElementById('btn-endgame-guess').disabled = true;
          }
        });
      } else {
        guessTimerEl.style.display = 'none';
      }
      if (isFinalist2) document.getElementById('endgame-finalist-section').classList.remove('hidden');
      setEndgamePhaseLabel('Guess!');
      log('Hint phase over: guess now!', 'warn');
      break;
    }

    case 'endgame_hints_revealed':
      break;

    case 'endgame_guesses_revealed': {
      clearTimer('endgame-hint-timer');
      clearTimer('endgame-guess-timer');
      disableBoardWordSelection();
      _startAnimationLock();
      const resEl = document.getElementById('endgame-guess-result');
      if (msg.timed_out) {
        resEl.innerHTML = `<span style="color:#FEAED2">⏰ Time's up!</span>`;
      }
      animateEndgameReveal(msg.results, msg.safe_player_id, msg.draw, () => {
        const winner = msg.safe_player_id ? playerName(msg.safe_player_id) : null;
        resEl.innerHTML = msg.draw
          ? `<span style="color:#FFCE18">Draw! Both auto-submitted correctly. Target: "${msg.target_word}"</span>`
          : winner
            ? `<span style="color:#87DCAB">✓ ${winner} guessed correctly! Target: "${msg.target_word}"</span>`
            : `<span style="color:#FEAED2">✗ Nobody got it. Target: "${msg.target_word}"</span>`;
        for (const r of msg.results) {
          const line = document.createElement('div');
          line.style.color = r.correct ? '#87DCAB' : '#FEAED2';
          line.style.fontSize = '0.85em';
          line.textContent = r.guess
            ? `${playerName(r.player_id)}: "${r.guess}" ${r.correct ? '✓' : '✗'}`
            : `${playerName(r.player_id)}: (no guess)`;
          resEl.appendChild(line);
        }
        state.targetWord = msg.target_word;
        renderBoard();
        _endAnimationLock();
      });
      log(msg.timed_out ? `Time's up. Target: "${msg.target_word}"` : `Endgame guesses revealed.`, 'warn');
      break;
    }

    case 'endgame_round_end': {
      const ec = document.getElementById('round-end-content');
      ec.innerHTML = msg.draw
        ? `<p style="color:#FFCE18;margin-bottom:8px">Draw! Both auto-submitted correctly. Target: "${msg.target_word}"</p>`
        : msg.safe_player_id
          ? `<p style="color:#C09AB8;margin-bottom:8px">${playerName(msg.safe_player_id)} survived. Target: "${msg.target_word}"</p>`
          : `<p style="color:#FEAED2;margin-bottom:8px">Nobody guessed correctly. Target: "${msg.target_word}"</p>`;
      if (state.isHost) {
        const btn = document.createElement('button');
        btn.className = 'primary'; btn.textContent = 'Next Sudden Death Round ▶';
        btn.onclick = () => { send({ type: 'next_round' }); btn.disabled = true; };
        ec.appendChild(btn);
      } else {
        const wait = document.createElement('p');
        wait.style.cssText = 'color:#453060;font-size:0.88em;margin-top:4px';
        wait.textContent = 'Waiting for host…';
        ec.appendChild(wait);
      }
      showAction('round-end');
      log(`Endgame round over. Target: "${msg.target_word}"`, 'ok');
      break;
    }

    case 'game_over':
      clearTimer('hint-timer'); clearTimer('guess-timer'); clearTimer('endgame-hint-timer'); clearTimer('endgame-guess-timer');
      document.getElementById('hint-timer').style.display = 'none';
      document.getElementById('game-over-title').textContent = 'Game Over!';
      document.getElementById('game-over-content').innerHTML = msg.winner_id
        ? `Winner: <strong style="color:#FFCE18">${msg.winner_name}</strong>`
        : '<em style="color:#705060">Draw!</em>';
      showAction('game-over');
      setPhaseLabel('GAME OVER');
      log(`Game over! Winner: ${msg.winner_name || 'nobody'}`, 'ok');
      break;

    case 'game_reset':
      _localResetToLobby();
      log('Game reset. Back in lobby.', 'ok');
      break;

    case 'interaction':
      handleInteraction(msg);
      break;

    case 'chat': {
      const pendingIndex = state.chatMessages.findIndex(entry =>
        entry.pendingLocal &&
        entry.player_id === msg.player_id &&
        entry.text === msg.text
      );
      if (pendingIndex >= 0) {
        state.chatMessages[pendingIndex] = {
          player_id: msg.player_id,
          name: msg.name,
          text: msg.text,
        };
      } else {
        state.chatMessages.push({
          player_id: msg.player_id,
          name: msg.name,
          text: msg.text,
        });
      }
      renderChat();
      break;
    }

    case 'error':
      log(`Error: ${msg.message}`, 'error');
      break;

    default:
      log(`Unhandled: ${msg.type}`, 'warn');
  }
}
