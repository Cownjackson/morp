import { state, send } from './state.js';
import { avatarColor, initials, playerName, httpBase, log, clearPregameLobbyMoops, syncPregameLobbyMoops, refreshBackgroundLogoPaint } from './helpers.js';
import { renderMoopInto } from './cosmetics.js';
import { buildMoopSprite } from './moop-sprite.js';
import { renderStrokesToCanvas, clearCanvas } from './drawing.js';

// ─── Role banner ──────────────────────────────────────────────────────────────
export function renderRoleBanner() {
  const el = document.getElementById('role-banner');
  const config = {
    safe:  { cls: 'safe',  text: 'YOU ARE SAFE' },
    morp:  { cls: 'morp',  text: 'YOU ARE THE MORP' },
    ghost: { cls: 'ghost', text: 'YOU HAVE BEEN ELIMINATED' },
  };
  const c = config[state.role];
  if (!c) { el.style.display = 'none'; el.className = ''; return; }
  el.className = c.cls;
  el.textContent = c.text;
  el.style.display = 'block';
}

// ─── Board ────────────────────────────────────────────────────────────────────
export function renderBoard() {
  if (!state.board) return;
  const { board_hint, words } = state.board;
  document.getElementById('board-theme-tag').textContent = board_hint;
  const grid = document.getElementById('board-grid');
  const cols = Math.ceil(Math.sqrt(words.length));
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.innerHTML = '';
  const halfSet = state.halfBoard ? new Set(state.halfBoard) : null;
  for (const word of words) {
    const cell = document.createElement('div');
    cell.className = 'word-cell';
    cell.textContent = word;
    if (state.targetWord && word === state.targetWord) {
      cell.classList.add('target');
    } else if (halfSet) {
      cell.classList.add(halfSet.has(word) ? 'half' : 'hidden-word');
    }
    if (state.boardSelectionMode) {
      cell.classList.add('selectable');
      cell.addEventListener('click', () => _handleBoardWordClick(word));
      if (state.boardWordSelected === word) {
        cell.classList.add('word-selected');
      }
    }
    grid.appendChild(cell);
  }
  document.getElementById('half-board-note').style.display = halfSet ? 'block' : 'none';
}

// ─── Seat positions ────────────────────────────────────────────────────────────
// Fixed per-scene seat layout: [left_frac, top_frac] normalized to container W × H.
// Placeholder values — replace with artist-encoded coords once centerpiece art lands.
// Up to 10 seats; players fill from seat 0 upward.
const SEAT_POSITIONS = [
  [0.500, 0.260],  // 0 — top center
  [0.747, 0.306],  // 1 — top right
  [0.900, 0.426],  // 2 — right upper
  [0.900, 0.574],  // 3 — right lower
  [0.747, 0.694],  // 4 — bottom right
  [0.500, 0.740],  // 5 — bottom center
  [0.253, 0.694],  // 6 — bottom left
  [0.100, 0.574],  // 7 — left lower
  [0.100, 0.426],  // 8 — left upper
  [0.253, 0.306],  // 9 — top left
];

// ─── Player layout ────────────────────────────────────────────────────────────
function renderPlayers(containerId, { avatarSize = 80 } = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  const currentTurnPid = state.turnOrder[state.hints.length];

  const players = Object.values(state.players);
  const N = players.length;
  if (N === 0) return;

  const W = el.clientWidth  || 640;
  const H = el.clientHeight || 560;

  for (let idx = 0; idx < N; idx++) {
    const p = players[idx];
    // Distribute N players evenly across the 10 seats so they never cluster
    const seatIdx = Math.round(idx * SEAT_POSITIONS.length / N) % SEAT_POSITIONS.length;
    const [xf, yf] = SEAT_POSITIONS[seatIdx];
    const x = W * xf;
    const y = H * yf;

    const _p = Math.PI;
    const _a = Math.atan2(y - H * 0.5, x - W * 0.5);
    const bubbleDir = _a > -5*_p/8 && _a <= -3*_p/8 ? 'above'
                    : _a > -3*_p/8 && _a <= -_p/8   ? 'above-right'
                    : _a > -_p/8   && _a <=  _p/8   ? 'right'
                    : _a >  _p/8   && _a <=  3*_p/8 ? 'below-right'
                    : _a >  3*_p/8 && _a <=  5*_p/8 ? 'below'
                    : _a >  5*_p/8 && _a <=  7*_p/8 ? 'below-left'
                    : (_a >  7*_p/8 || _a <= -7*_p/8) ? 'left'
                    : 'above-left';

    const wrap = document.createElement('div');
    wrap.className = 'avatar-wrap';
    wrap.dataset.playerId = p.id;
    wrap.style.left = x + 'px';
    wrap.style.top  = y + 'px';

    // Speech bubble
    const bubble = state.speechBubbles[p.id];
    if (bubble !== undefined) {
      const bel = document.createElement('div');
      const dirClass = bubbleDir !== 'above' ? ` bubble-${bubbleDir}` : '';
      if (bubble.skipped) {
        bel.className = 'speech-bubble skipped' + dirClass;
        bel.textContent = '(skipped)';
      } else if (bubble.is_drawing && bubble.drawing_data) {
        bel.className = 'speech-bubble drawing-bubble' + dirClass;
        const cv = document.createElement('canvas');
        cv.width = 360; cv.height = 232;
        renderStrokesToCanvas(cv, bubble.drawing_data);
        bel.appendChild(cv);
      } else {
        bel.className = 'speech-bubble' + dirClass;
        bel.textContent = bubble.text;
      }
      wrap.appendChild(bel);
    }

    // Avatar moop
    const circle = document.createElement('div');
    circle.className = 'moop-avatar';
    circle.style.width  = avatarSize + 'px';
    circle.style.height = avatarSize + 'px';
    if (p.is_ghost)            circle.classList.add('is-ghost');
    if (p.id === state.playerId) circle.classList.add('is-you');
    if (p.id === currentTurnPid && !p.is_ghost) circle.classList.add('is-active');
    if (p.is_connected === false) circle.classList.add('disconnected');
    if (p.cosmetics) {
      renderMoopInto(circle, p.cosmetics);
    } else {
      circle.style.background = avatarColor(p.id);
      circle.textContent = initials(p.name);
    }

    // Host crown
    if (p.id === state.hostId) {
      const crown = document.createElement('span');
      crown.className = 'host-crown'; crown.textContent = '♛';
      circle.appendChild(crown);
    }

    // Name
    const nameEl = document.createElement('div');
    nameEl.className = 'avatar-name' + (p.id === state.playerId ? ' is-you' : '');
    nameEl.textContent = p.name;

    // HP pips
    const hpEl = document.createElement('div');
    hpEl.className = 'hp-pips';
    for (let i = 0; i < 3; i++) {
      const pip = document.createElement('div');
      pip.className = 'hp-pip' + (i >= p.hp ? ' empty' : '');
      hpEl.appendChild(pip);
    }

    // Kick button (host only, not for self)
    if (state.isHost && p.id !== state.playerId) {
      const kickBtn = document.createElement('button');
      kickBtn.textContent = '✕';
      kickBtn.title = `Kick ${p.name}`;
      kickBtn.style.cssText = 'font-size:0.7em;padding:1px 5px;margin-top:2px;background:#4a1a1a;border-color:#933;color:#f88';
      kickBtn.onclick = () => kickPlayer(p.id);
      wrap.appendChild(kickBtn);
    }

    wrap.appendChild(circle);
    wrap.appendChild(nameEl);
    wrap.appendChild(hpEl);

    // ── Avatar interaction state (vote / damage) ──
    if (state.avatarInteraction === 'vote') {
      if (!p.is_ghost && p.id !== state.playerId) {
        wrap.classList.add('voteable');
        wrap.addEventListener('click', () => _handleAvatarVoteClick(p.id));
        if (state.selectedVotes.includes(p.id)) {
          wrap.classList.add('vote-selected');
        }
      }
    } else if (state.avatarInteraction === 'damage') {
      if (!p.is_ghost && !state._morpIdsForDamage.includes(p.id)) {
        wrap.classList.add('damageable');
        wrap.addEventListener('click', () => _handleAvatarDamageClick(p.id));
        if (state.damageTarget === p.id) {
          wrap.classList.add('damage-selected');
        }
      }
    }

    el.appendChild(wrap);
  }

}

export function renderInGamePlayerRow() {
  const N = Object.values(state.players).length;
  // 320px at 3 players, scales down to ~160px at 10 — keeps avatars from overlapping
  const avatarSize = Math.max(160, Math.round(320 - Math.max(0, N - 3) * 22));
  renderPlayers('game-player-row', { avatarSize });
}

let backgroundLobbySyncToken = 0;

async function syncPregameLobbyBackgroundMoops() {
  const syncToken = ++backgroundLobbySyncToken;

  if (state.screen !== 'pregame') {
    clearPregameLobbyMoops();
    return;
  }

  const players = Object.values(state.players).filter(player => player.is_connected !== false);
  if (players.length === 0) {
    clearPregameLobbyMoops();
    return;
  }

  const payload = await Promise.all(players.map(async (player) => {
    let spriteSrc = null;
    let spriteBounds = null;

    if (player.cosmetics) {
      try {
        const sprite = await buildMoopSprite(player.cosmetics);
        spriteSrc = sprite.src;
        spriteBounds = sprite.bounds || null;
      } catch (error) {
        console.warn(`Failed to build lobby floating sprite for ${player.name || player.id}.`, error);
      }
    }

    return {
      id: player.id,
      name: player.name,
      cosmetics: player.cosmetics || null,
      spriteSrc,
      spriteBounds,
      isHost: player.id === state.hostId,
      isYou: player.id === state.playerId
    };
  }));

  if (syncToken !== backgroundLobbySyncToken || state.screen !== 'pregame') return;
  syncPregameLobbyMoops(payload);
}

function createPregamePlayerBadge(text, className = '') {
  const badge = document.createElement('span');
  badge.className = className ? `pregame-player-badge ${className}` : 'pregame-player-badge';
  badge.textContent = text;
  return badge;
}

function createPregamePlayerItem(player) {
  const item = document.createElement('div');
  item.className = 'pregame-player-item';
  if (player.is_connected === false) item.classList.add('is-muted');

  const nameWrap = document.createElement('div');
  nameWrap.className = 'pregame-player-name-wrap';

  const nameEl = document.createElement('span');
  nameEl.className = 'pregame-player-name';
  nameEl.textContent = player.name;
  nameWrap.appendChild(nameEl);

  if (player.id === state.playerId) {
    nameWrap.appendChild(createPregamePlayerBadge('you'));
  }

  if (player.id === state.hostId) {
    nameWrap.appendChild(createPregamePlayerBadge('host', 'host'));
  }

  const statusEl = document.createElement('span');
  statusEl.className = 'pregame-player-status';
  statusEl.textContent = player.is_connected === false ? 'joining' : 'connected';

  item.appendChild(nameWrap);
  item.appendChild(statusEl);
  return item;
}

function renderPregamePlayersPanel(players) {
  const pregamePlayersList = document.getElementById('pregame-players-list');
  const pregamePlayersCount = document.getElementById('pregame-players-count');
  if (!pregamePlayersList || !pregamePlayersCount) return;

  pregamePlayersList.replaceChildren(...players.map(createPregamePlayerItem));
  pregamePlayersCount.textContent = String(players.length);
}

export function renderPregameLobby() {
  syncPregameLobbyBackgroundMoops();
  const isHost = state.isHost;
  const pregameHostControls = document.getElementById('pregame-host-controls');
  const startButton = document.getElementById('btn-start');
  const players = Object.values(state.players);

  pregameHostControls.classList.toggle('hidden', !isHost);

  startButton.disabled =
    !isHost || state.lobbyStarted || players.length < 3;

  renderPregamePlayersPanel(players);

  refreshBackgroundLogoPaint({ delayed: true, late: true });
}

export function renderChat() {
  const chatEl = document.getElementById('chat-messages');
  if (!chatEl) return;
  chatEl.classList.toggle('hidden', state.chatMessages.length === 0);
  chatEl.innerHTML = '';
  for (const msg of state.chatMessages) {
    const d = document.createElement('div');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'chat-name';
    nameSpan.style.color = avatarColor(msg.player_id);
    nameSpan.textContent = msg.name + ': ';
    d.appendChild(nameSpan);
    d.appendChild(document.createTextNode(msg.text));
    chatEl.appendChild(d);
  }
  chatEl.scrollTop = chatEl.scrollHeight;
}

// ─── Hint phase ───────────────────────────────────────────────────────────────
export function checkYourTurn() {
  const currentPid = state.turnOrder[state.hints.length];
  const isMyTurn   = currentPid === state.playerId;
  document.getElementById('your-turn-block').classList.toggle('hidden', !isMyTurn);
  if (isMyTurn) {
    document.getElementById('hint-text-block').classList.toggle('hidden', state.drawingHints);
    document.getElementById('hint-drawing-block').classList.toggle('hidden', !state.drawingHints);
    if (state.drawingHints) clearCanvas('hint-canvas');
  }
  const indicator = document.getElementById('turn-indicator');
  if (!currentPid) {
    indicator.textContent = ''; indicator.style.color = '';
  } else if (isMyTurn) {
    indicator.textContent = 'Your turn!'; indicator.style.color = '#87DCAB';
  } else {
    indicator.textContent = `Waiting for ${playerName(currentPid)}…`; indicator.style.color = '#D1912A';
  }
  renderInGamePlayerRow();
}

// ─── Voting (avatar-based) ────────────────────────────────────────────────────
export function enableAvatarVoting() {
  state.avatarInteraction = 'vote';
  state.selectedVotes = [];
  document.getElementById('vote-waiting').style.display = 'none';
  _updateVoteUI();
  renderInGamePlayerRow();
}

function _handleAvatarVoteClick(pid) {
  const idx = state.selectedVotes.indexOf(pid);
  if (idx >= 0) {
    state.selectedVotes.splice(idx, 1);
  } else if (state.selectedVotes.length < state.numVotes) {
    state.selectedVotes.push(pid);
  } else if (state.numVotes === 1) {
    // Swap: replace the single selection
    state.selectedVotes[0] = pid;
  }
  _updateVoteUI();
  renderInGamePlayerRow();
}

function _updateVoteUI() {
  const btn = document.getElementById('btn-submit-votes');
  btn.disabled = state.selectedVotes.length !== state.numVotes;
  const countEl = document.getElementById('vote-count-label');
  if (state.numVotes > 1) {
    btn.textContent = 'Submit Votes';
    countEl.textContent = `${state.selectedVotes.length}/${state.numVotes} selected`;
    countEl.style.display = 'inline';
  } else {
    btn.textContent = 'Submit Vote';
    countEl.style.display = 'none';
  }
}

export function disableAvatarVoting() {
  state.avatarInteraction = null;
  renderInGamePlayerRow();
}

// ─── Dramatic role reveal (Phase 5) ───────────────────────────────────────────
const _REVEAL_ASSETS = {
  closed: 'assets/letter/envelope_closed.png',
  back:   'assets/letter/envelope_opened_back.png',
  front:  'assets/letter/envelope_opened_front.png',
  safe:   'assets/letter/safe_letter.png',
  morp:   'assets/letter/morp_letter.png',
};

/**
 * Play the dramatic one-by-one role reveal on player avatars.
 * revealOrder: [{player_id, role}, ...] — server-dictated order (morp last)
 * onDone: callback after entire reveal sequence finishes
 */
export function playRoleRevealSequence(revealOrder, onDone) {
  const playerRow = document.getElementById('game-player-row');
  if (!playerRow || revealOrder.length === 0) {
    if (onDone) onDone();
    return;
  }

  // Place closed envelopes on all players in the reveal order
  const envelopeEls = {};
  for (const entry of revealOrder) {
    const wrap = playerRow.querySelector(`[data-player-id="${entry.player_id}"]`);
    if (!wrap) continue;

    const envWrap = document.createElement('div');
    envWrap.className = 'avatar-envelope';

    const closedImg = document.createElement('img');
    closedImg.src = _REVEAL_ASSETS.closed;
    closedImg.className = 'avatar-envelope-closed';
    envWrap.appendChild(closedImg);

    // Prepare opened state (hidden)
    const openedWrap = document.createElement('div');
    openedWrap.className = 'avatar-envelope-opened';

    const backImg = document.createElement('img');
    backImg.src = _REVEAL_ASSETS.back;
    backImg.className = 'avatar-envelope-back';
    openedWrap.appendChild(backImg);

    const letterImg = document.createElement('img');
    letterImg.src = entry.role === 'morp' ? _REVEAL_ASSETS.morp : _REVEAL_ASSETS.safe;
    letterImg.className = 'avatar-envelope-letter';
    openedWrap.appendChild(letterImg);

    const frontImg = document.createElement('img');
    frontImg.src = _REVEAL_ASSETS.front;
    frontImg.className = 'avatar-envelope-front';
    openedWrap.appendChild(frontImg);

    envWrap.appendChild(openedWrap);
    wrap.appendChild(envWrap);
    envelopeEls[entry.player_id] = { wrap: envWrap, openedWrap, closedImg, letterImg };
  }

  // Reveal one at a time
  const baseInterval = 1500;
  const morpPause = 1000;
  let delay = 600; // initial pause before first reveal

  for (let i = 0; i < revealOrder.length; i++) {
    const entry = revealOrder[i];
    const isMorp = entry.role === 'morp';
    const isLast = i === revealOrder.length - 1;

    // Extra pause before morp reveal
    if (isMorp) delay += morpPause;

    setTimeout(() => {
      const els = envelopeEls[entry.player_id];
      if (!els) return;

      // Play SFX
      try {
        const sfx = new Audio(_LETTER_OPEN_SFX);
        sfx.volume = 0.4;
        sfx.play().catch(() => {});
      } catch (_) { /* no-op */ }

      // Open the envelope
      els.closedImg.classList.add('hiding');
      els.openedWrap.classList.add('active');
      setTimeout(() => {
        els.letterImg.classList.add('revealed');
      }, 200);
    }, delay);

    delay += baseInterval;
  }

  // After all reveals + hold time, clean up and callback
  setTimeout(() => {
    // Remove all envelope overlays
    for (const els of Object.values(envelopeEls)) {
      els.wrap.remove();
    }
    if (onDone) onDone();
  }, delay + 1500); // extra hold after final reveal
}

// ─── Damage (avatar-based) ────────────────────────────────────────────────────
export function enableAvatarDamage(morpIds) {
  state.avatarInteraction = 'damage';
  state._morpIdsForDamage = morpIds;
  state.damageTarget = null;
  _updateDamageUI();
  renderInGamePlayerRow();
}

function _handleAvatarDamageClick(pid) {
  state.damageTarget = state.damageTarget === pid ? null : pid;
  _updateDamageUI();
  renderInGamePlayerRow();
}

function _updateDamageUI() {
  const btn = document.getElementById('btn-confirm-damage');
  btn.disabled = !state.damageTarget;
  const label = document.getElementById('damage-target-label');
  if (state.damageTarget) {
    const name = state.players[state.damageTarget]?.name || '???';
    label.textContent = name;
    label.style.display = 'inline';
  } else {
    label.style.display = 'none';
  }
}

export function confirmDamage() {
  if (!state.damageTarget) return;
  send({ type: 'morp_deal_damage', target_id: state.damageTarget });
  state.avatarInteraction = null;
  document.getElementById('btn-confirm-damage').disabled = true;
  renderInGamePlayerRow();
}

export function disableAvatarDamage() {
  state.avatarInteraction = null;
  state.damageTarget = null;
  state._morpIdsForDamage = [];
  renderInGamePlayerRow();
}

// ─── Board word selection (morp guess phase) ─────────────────────────────────
export function enableBoardWordSelection() {
  state.boardSelectionMode = true;
  state.boardWordSelected = null;
  _updateWordGuessUI();
  renderBoard();
}

function _handleBoardWordClick(word) {
  state.boardWordSelected = state.boardWordSelected === word ? null : word;
  _updateWordGuessUI();
  renderBoard();
}

function _updateWordGuessUI() {
  // Update whichever guess button is active (morp guess or endgame guess)
  for (const [btnId, labelId] of [
    ['btn-morp-guess', 'morp-guess-selected-word'],
    ['btn-endgame-guess', 'endgame-guess-selected-word'],
  ]) {
    const btn = document.getElementById(btnId);
    const label = document.getElementById(labelId);
    if (!btn) continue;
    if (state.boardWordSelected) {
      btn.disabled = false;
      if (label) label.textContent = state.boardWordSelected;
    } else {
      btn.disabled = true;
      if (label) label.textContent = '—';
    }
  }
}

export function disableBoardWordSelection() {
  state.boardSelectionMode = false;
  state.boardWordSelected = null;
  renderBoard();
}

// ─── Word toss animation ─────────────────────────────────────────────────────
let _wordTossEl = null;
let _wordTossRevealAt = null;

export function animateWordGuess(word) {
  // Find the board cell's position
  const grid = document.getElementById('board-grid');
  let originRect = { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
  if (grid) {
    for (const cell of grid.querySelectorAll('.word-cell')) {
      if (cell.textContent.trim() === word) {
        originRect = cell.getBoundingClientRect();
        break;
      }
    }
  }

  const card = document.createElement('div');
  card.className = 'word-toss-card';
  card.textContent = word;
  document.body.appendChild(card);
  _wordTossEl = card;
  _wordTossRevealAt = Date.now() + 1400; // 400ms fly + 1000ms suspense

  const startX = originRect.left + originRect.width / 2;
  const startY = originRect.top + originRect.height / 2;
  card.style.left = startX + 'px';
  card.style.top = startY + 'px';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      card.classList.add('word-toss-flying');
    });
  });
}

export function resolveWordGuess(correct, onReveal) {
  if (!_wordTossEl) {
    // No animation in progress (e.g. timed out with no selection)
    if (onReveal) onReveal();
    return;
  }
  const remaining = Math.max(0, _wordTossRevealAt - Date.now());
  setTimeout(() => {
    if (_wordTossEl) {
      _wordTossEl.classList.add(correct ? 'word-toss-correct' : 'word-toss-wrong');
    }
    setTimeout(() => {
      if (_wordTossEl) {
        _wordTossEl.classList.add('word-toss-hiding');
        setTimeout(() => { _wordTossEl?.remove(); _wordTossEl = null; }, 500);
      }
      if (onReveal) onReveal();
    }, 800);
  }, remaining);
}

/**
 * Animate the simultaneous endgame guess reveal.
 * results: [{player_id, guess, correct}, ...] — in submission order
 * safePlayerId: the winner (first correct guesser), or null
 * onDone: callback after all animations finish
 */
export function animateEndgameReveal(results, safePlayerId, isDraw, onDone) {
  const guessesWithWords = results.filter(r => r.guess);
  if (guessesWithWords.length === 0) {
    if (onDone) onDone();
    return;
  }

  const grid = document.getElementById('board-grid');
  const cards = [];
  const offsets = guessesWithWords.length === 1
    ? [{ x: '50vw', y: '40vh' }]
    : [{ x: '35vw', y: '40vh' }, { x: '65vw', y: '40vh' }];

  guessesWithWords.forEach((r, i) => {
    let originRect = { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
    if (grid) {
      for (const cell of grid.querySelectorAll('.word-cell')) {
        if (cell.textContent.trim() === r.guess) {
          originRect = cell.getBoundingClientRect();
          break;
        }
      }
    }
    const card = document.createElement('div');
    card.className = 'word-toss-card';
    card.textContent = r.guess;
    document.body.appendChild(card);

    const startX = originRect.left + originRect.width / 2;
    const startY = originRect.top + originRect.height / 2;
    card.style.left = startX + 'px';
    card.style.top = startY + 'px';
    card.dataset.flyX = offsets[i].x;
    card.dataset.flyY = offsets[i].y;

    // Determine card style: draw = both green, correct winner = green, slower correct = yellow, wrong = red
    let style = 'wrong';
    if (isDraw) {
      style = 'correct';
    } else if (r.correct) {
      style = (safePlayerId && r.player_id === safePlayerId) ? 'correct' : 'slow-correct';
    }
    cards.push({ el: card, style });
  });

  // Fly all cards
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      cards.forEach(c => {
        c.el.style.left = c.el.dataset.flyX;
        c.el.style.top = c.el.dataset.flyY;
        c.el.style.transform = 'translate(-50%, -50%) scale(1.5)';
      });
    });
  });

  // After fly (400ms) + suspense (1000ms), reveal result
  setTimeout(() => {
    cards.forEach(c => {
      c.el.classList.add(`word-toss-${c.style}`);
    });
    // Hold the reveal, then fade out
    setTimeout(() => {
      cards.forEach(c => {
        c.el.classList.add('word-toss-hiding');
        setTimeout(() => c.el.remove(), 500);
      });
      if (onDone) onDone();
    }, 800);
  }, 1400);
}

// ─── Envelope role reveal ─────────────────────────────────────────────────────
const _ENVELOPE_ASSETS = {
  closed: 'assets/letter/envelope_closed.png',
  back:   'assets/letter/envelope_opened_back.png',
  front:  'assets/letter/envelope_opened_front.png',
  safe:   'assets/letter/safe_letter.png',
  morp:   'assets/letter/morp_letter.png',
};
const _LETTER_OPEN_SFX = 'music/letter_open.mp3';

export function showEnvelopeReveal(role, onDismiss) {
  const overlay = document.createElement('div');
  overlay.className = 'envelope-overlay';

  const container = document.createElement('div');
  container.className = 'envelope-container';

  // Closed state
  const closed = document.createElement('div');
  closed.className = 'envelope-closed';
  const closedImg = document.createElement('img');
  closedImg.src = _ENVELOPE_ASSETS.closed;
  closedImg.alt = 'Sealed envelope';
  closed.appendChild(closedImg);

  // Opened state (hidden initially)
  const opened = document.createElement('div');
  opened.className = 'envelope-opened';

  const backLayer = document.createElement('div');
  backLayer.className = 'envelope-layer-back';
  const backImg = document.createElement('img');
  backImg.src = _ENVELOPE_ASSETS.back;
  backLayer.appendChild(backImg);

  const letter = document.createElement('div');
  letter.className = 'envelope-letter';
  const letterImg = document.createElement('img');
  letterImg.src = role === 'morp' ? _ENVELOPE_ASSETS.morp : _ENVELOPE_ASSETS.safe;
  letterImg.alt = role === 'morp' ? 'Morp letter' : 'Safe letter';
  letter.appendChild(letterImg);

  const frontLayer = document.createElement('div');
  frontLayer.className = 'envelope-layer-front';
  const frontImg = document.createElement('img');
  frontImg.src = _ENVELOPE_ASSETS.front;
  frontLayer.appendChild(frontImg);

  opened.appendChild(backLayer);
  opened.appendChild(letter);
  opened.appendChild(frontLayer);

  const prompt = document.createElement('div');
  prompt.className = 'envelope-prompt';
  prompt.textContent = 'Click to open';

  container.appendChild(closed);
  container.appendChild(opened);
  container.appendChild(prompt);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  // Fade in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('visible'));
  });

  let phase = 'closed'; // 'closed' → 'opening' → 'revealed'
  let autoDismissTimer = null;

  function dismiss() {
    if (phase === 'dismissed') return;
    phase = 'dismissed';
    clearTimeout(autoDismissTimer);
    overlay.classList.add('dismissing');
    setTimeout(() => {
      overlay.remove();
      if (onDismiss) onDismiss();
    }, 400);
  }

  function openEnvelope() {
    if (phase !== 'closed') return;
    phase = 'opening';
    prompt.remove();

    // Play SFX
    try {
      const sfx = new Audio(_LETTER_OPEN_SFX);
      sfx.volume = 0.5;
      sfx.play().catch(() => {});
    } catch (_) { /* no-op */ }

    // Swap to opened envelope
    closed.style.opacity = '0';
    opened.classList.add('active');

    // Slide letter out after a brief moment
    setTimeout(() => {
      letter.classList.add('revealed');
      phase = 'revealed';

      // Auto-dismiss after 3s
      autoDismissTimer = setTimeout(dismiss, 3000);
    }, 300);
  }

  // TODO: consider auto-opening the envelope after ~3s if the player hasn't clicked
  overlay.addEventListener('click', () => {
    if (phase === 'closed') openEnvelope();
    else if (phase === 'revealed') dismiss();
  });
}

// ─── Damage animation placeholder ────────────────────────────────────────────
export function playDamageAnimation(_targetId, _amount) {
  // Placeholder — mechanic TBD by team
}

async function kickPlayer(targetId) {
  try {
    const r = await fetch(`${httpBase()}/lobby/${state.lobbyId}/kick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: state.playerId, target_id: targetId }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      log(`Kick failed: ${body.detail || r.status}`, 'error');
    }
  } catch (e) {
    log(`Kick failed: ${e}`, 'error');
  }
}
