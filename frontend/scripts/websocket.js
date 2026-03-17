import { state, send } from './state.js';
import { log, playerName, setPhaseLabel, setEndgamePhaseLabel, showAction, showLanding } from './helpers.js';
import { avatarColor } from './helpers.js';
import { renderRoleBanner, renderBoard, renderPlayerRow, renderVoteButtons, renderAccusation, renderDamageButtons, checkYourTurn } from './rendering.js';
import { _localResetToLobby } from './actions.js';
import { startTimer, clearTimer } from './timers.js';
import { _drawState, clearCanvas } from './drawing.js';

// ─── WebSocket ────────────────────────────────────────────────────────────────
let _wsRetries = 0;
let _wsOpened = false;
let _wsKicked = false;
let _wsMaintenance = false;
const _WS_MAX_RETRIES = 4;
const _WS_RETRY_BASE_MS = 1500;

export function _setConnectBusy(busy) {
  document.querySelectorAll('#panel-connect button').forEach(b => b.disabled = busy);
}

export function connectWS(lobbyId, playerId, name, isRetry) {
  state.lobbyId = lobbyId; state.playerId = playerId; state.playerName = name;
  if (!isRetry) { _wsRetries = 0; _wsOpened = false; _wsKicked = false; _wsMaintenance = false; }

  state.ws = new WebSocket(`${document.getElementById('server-url').value}/ws/${lobbyId}/${playerId}`);

  state.ws.onopen = () => {
    _wsOpened = true;
    _wsRetries = 0;
    log(`Connected to lobby ${lobbyId} as ${name}`, 'ok');
    const codeEl = document.getElementById('lobby-code-display');
    codeEl.textContent = 'Lobby Code: ' + lobbyId;
    codeEl.classList.remove('hidden');
    document.getElementById('panel-connect').classList.add('hidden');
    showLanding(false);
    document.getElementById('game-layout').classList.remove('hidden');
    showAction('lobby');
  };

  state.ws.onmessage = e => handleMessage(JSON.parse(e.data));

  state.ws.onclose = e => {
    if (e.code === 4403 || _wsKicked) {
      log('You have been kicked from the lobby.', 'error');
      document.getElementById('game-layout').classList.add('hidden');
      document.getElementById('lobby-code-display').classList.add('hidden');
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



// ─── Message handler ──────────────────────────────────────────────────────────
function handleMessage(msg) {
  log(`← ${msg.type}`, 'info');

  switch (msg.type) {

    case 'kicked': {
      _wsKicked = true;
      break;
    }

    case 'maintenance_shutdown': {
      _wsMaintenance = true;
      document.getElementById('game-layout').classList.add('hidden');
      document.getElementById('lobby-code-display').classList.add('hidden');
      document.getElementById('role-banner').className = '';
      document.getElementById('role-banner').textContent = '';
      document.getElementById('panel-connect').classList.remove('hidden');
      showLanding(true);
      document.getElementById('maintenance-overlay').classList.add('open');
      break;
    }

    case 'lobby_update': {
      state.players     = Object.fromEntries(msg.players.map(p => [p.id, p]));
      state.hostId      = msg.host_id;
      state.isHost      = msg.host_id === state.playerId;
      state.isGhost     = state.players[state.playerId]?.is_ghost ?? false;
      state.drawingHints = msg.drawing_hints ?? false;
      renderPlayerRow();
      document.getElementById('host-controls').classList.toggle('hidden', !state.isHost);
      document.getElementById('lobby-waiting').style.display = state.isHost ? 'none' : 'block';
      document.getElementById('btn-start').disabled =
        !state.isHost || msg.started || msg.players.length < 3;
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
      renderRoleBanner();
      log(`Your role: ${msg.role}${state.halfBoard ? ' (going first — partial board visible)' : ''}`,
        msg.role === 'morp' ? 'warn' : 'ok');
      break;

    case 'round_start':
      state.board      = { board_hint: msg.board_hint, words: msg.words };
      state.turnOrder  = msg.turn_order;
      state.targetWord = msg.target_word || null;
      state.hints      = [];
      state.speechBubbles = {};
      state.endgameTargetWord = null;
      renderBoard();
      renderPlayerRow();
      document.getElementById('board-area').classList.remove('hidden');
      checkYourTurn();
      showAction('hint');
      setPhaseLabel(`ROUND ${msg.round_number} — HINTS`);
      log(`Round ${msg.round_number} — "${msg.board_hint}"`, 'ok');
      break;

    case 'hint_received':
      state.hints.push({ player_id: msg.player_id, text: msg.text, is_drawing: msg.is_drawing, drawing_data: msg.drawing_data });
      state.speechBubbles[msg.player_id] = {
        text: msg.text, skipped: !msg.text && !msg.is_drawing,
        is_drawing: msg.is_drawing || false, drawing_data: msg.drawing_data || null,
      };
      renderPlayerRow();
      checkYourTurn();
      log(msg.is_drawing ? `Drawing hint from ${playerName(msg.player_id)}` : `Hint from ${playerName(msg.player_id)}: "${msg.text || '(skipped)'}"`, '');
      break;

    case 'voting_open':
      state.hints      = msg.hints;
      state.numVotes   = msg.num_votes;
      state.selectedVotes = [];
      for (const h of msg.hints) {
        state.speechBubbles[h.player_id] = {
          text: h.text, skipped: !h.text && !h.is_drawing,
          is_drawing: h.is_drawing || false, drawing_data: h.drawing_data || null,
        };
      }
      renderPlayerRow();
      if (!state.isGhost) {
        renderVoteButtons();
        showAction('vote');
      }
      setPhaseLabel('VOTING');
      log('Voting open!', 'ok');
      break;

    case 'accusation_result':
      renderAccusation(msg);
      showAction('accusation');
      setPhaseLabel('ACCUSATION');
      break;

    case 'morp_guess_phase': {
      state._accusedMorpIds = msg.accused_morp_ids;
      const isMorpBeingAsked = msg.accused_morp_ids.includes(state.playerId);
      document.getElementById('morp-guess-input-block').classList.toggle('hidden', !isMorpBeingAsked);
      document.getElementById('guess-input').disabled = false;
      document.getElementById('btn-morp-guess').disabled = false;
      document.getElementById('guess-result').textContent =
        isMorpBeingAsked ? '' : `Waiting for ${msg.accused_morp_ids.map(playerName).join(', ')} to guess…`;
      document.getElementById('guess-result').style.color = '#705060';
      if (msg.timers_enabled) {
        startTimer('guess-timer', msg.deadline, () => {
          if (isMorpBeingAsked && !document.getElementById('guess-input').disabled) {
            send({ type: 'submit_morp_guess', guess: '' });
            document.getElementById('guess-input').disabled = true;
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
      document.getElementById('guess-result').textContent = resultText;
      document.getElementById('guess-result').style.color = msg.correct ? '#87DCAB' : '#FEAED2';
      log(resultText, msg.correct ? 'ok' : 'warn');
      state.targetWord = msg.target_word;
      renderBoard();
      break;
    }

    case 'damage_phase': {
      const isMorp = msg.morp_ids.includes(state.playerId);
      document.getElementById('damage-morp-action').classList.toggle('hidden', !isMorp);
      document.getElementById('damage-waiting').style.display = isMorp ? 'none' : 'block';
      if (isMorp) renderDamageButtons(msg.morp_ids);
      showAction('damage');
      setPhaseLabel('DAMAGE');
      break;
    }

    case 'damage_dealt':
      log(`${playerName(msg.from_id)} → ${playerName(msg.to_id)} (${msg.hp_remaining} HP${msg.eliminated ? ', eliminated' : ''})`, 'warn');
      break;

    case 'round_end': {
      setPhaseLabel('ROUND OVER');
      const rc = document.getElementById('round-end-content');
      rc.innerHTML = '';
      if (state.isHost) {
        const btn = document.createElement('button');
        btn.className = 'primary'; btn.textContent = 'Next Round ▶';
        btn.onclick = () => { send({ type: 'next_round' }); btn.disabled = true; };
        rc.appendChild(btn);
      } else {
        rc.innerHTML = '<p style="color:#453060;font-size:0.88em">Waiting for host to start next round…</p>';
      }
      showAction('round-end');
      log('Round over.', 'ok');
      break;
    }

    // ── 2-Player Endgame ──────────────────────────────────────────────────────

    case 'endgame_round_start': {
      state.endgameTargetWord = msg.target_word || null;
      state.halfBoard = null;
      state.speechBubbles = {};
      state.board      = { board_hint: msg.board_hint, words: msg.words };
      state.targetWord = state.endgameTargetWord;
      renderBoard();
      renderPlayerRow();
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
      } else {
        document.getElementById('endgame-guess-input').disabled  = false;
        document.getElementById('btn-endgame-guess').disabled    = false;
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
        renderPlayerRow();
      }
      if (msg.player_id === state.playerId) {
        document.getElementById('endgame-ghost-input-block').classList.add('hidden');
        document.getElementById('endgame-ghost-waiting').style.display = 'block';
      }
      break;

    case 'endgame_hint_phase_over': {
      if (state.isGhost && !document.getElementById('endgame-ghost-input-block').classList.contains('hidden')) {
        if (state.drawingHints) {
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
      if (msg.timers_enabled) {
        guessTimerEl.style.display = 'inline-block';
        const isFinalist2 = !state.isGhost;
        startTimer('endgame-guess-timer', msg.guess_deadline, () => {
          if (isFinalist2 && !document.getElementById('endgame-guess-input').disabled) {
            send({ type: 'endgame_submit_guess', guess: '' });
            document.getElementById('endgame-guess-input').disabled = true;
            document.getElementById('btn-endgame-guess').disabled   = true;
          }
        });
      } else {
        guessTimerEl.style.display = 'none';
      }
      if (!state.isGhost) document.getElementById('endgame-finalist-section').classList.remove('hidden');
      setEndgamePhaseLabel('Guess!');
      log('Hint phase over: guess now!', 'warn');
      break;
    }

    case 'endgame_hints_revealed':
      break;

    case 'endgame_guess_result': {
      if (msg.round_over) {
        clearTimer('endgame-hint-timer');
        clearTimer('endgame-guess-timer');
      }
      const resEl = document.getElementById('endgame-guess-result');
      if (msg.round_over) {
        const winner = msg.safe_player_id ? playerName(msg.safe_player_id) : null;
        resEl.innerHTML = winner
          ? `<span style="color:#87DCAB">✓ ${winner} guessed correctly! Target: "${msg.target_word}"</span>`
          : `<span style="color:#FEAED2">✗ Nobody got it. Target: "${msg.target_word}"</span>`;
      } else {
        const line = document.createElement('div');
        line.style.color = '#FEAED2';
        line.textContent = `✗ ${playerName(msg.player_id)} guessed wrong.`;
        resEl.appendChild(line);
        if (msg.player_id === state.playerId) {
          document.getElementById('endgame-guess-input').disabled  = true;
          document.getElementById('btn-endgame-guess').disabled    = true;
        }
      }
      break;
    }

    case 'endgame_timeout':
      clearTimer('endgame-hint-timer');
      clearTimer('endgame-guess-timer');
      document.getElementById('endgame-guess-result').innerHTML =
        `<span style="color:#FEAED2">⏰ Time's up! Target was: "${msg.target_word}"</span>`;
      log(`Time's up. Target: "${msg.target_word}"`, 'warn');
      break;

    case 'endgame_round_end': {
      const ec = document.getElementById('round-end-content');
      ec.innerHTML = msg.safe_player_id
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
      clearTimer('guess-timer'); clearTimer('endgame-hint-timer'); clearTimer('endgame-guess-timer');
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

    case 'chat': {
      const chatEl = document.getElementById('chat-messages');
      const d = document.createElement('div');
      const nameSpan = document.createElement('span');
      nameSpan.className = 'chat-name';
      nameSpan.style.color = avatarColor(msg.player_id);
      nameSpan.textContent = msg.name + ': ';
      d.appendChild(nameSpan);
      d.appendChild(document.createTextNode(msg.text));
      chatEl.appendChild(d);
      chatEl.scrollTop = chatEl.scrollHeight;
      break;
    }

    case 'error':
      log(`Error: ${msg.message}`, 'error');
      break;

    default:
      log(`Unhandled: ${msg.type}`, 'warn');
  }
}
