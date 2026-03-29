import { state, send } from './state.js';
import { avatarColor, initials, playerName, httpBase, log, clearPregameLobbyMoops, syncPregameLobbyMoops, refreshBackgroundLogoPaint } from './helpers.js';
import { renderMoopInto } from './cosmetics.js';
import { buildMoopSprite } from './moop-sprite.js';
import { renderStrokesToCanvas, clearCanvas } from './drawing.js';

// ─── Your-turn notification sound ─────────────────────────────────────────────
export function playYourTurnSound() {
  const sfx = new Audio('/music/your_turn.mp3');
  sfx.volume = 0.45;
  sfx.play().catch(() => {});
}

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
  [0.500, 0.200],  // 0 — top center
  [0.740, 0.220],  // 1 — top right
  [0.880, 0.360],  // 2 — right upper
  [0.840, 0.540],  // 3 — right lower
  [0.700, 0.680],  // 4 — bottom right
  [0.500, 0.720],  // 5 — bottom center
  [0.300, 0.680],  // 6 — bottom left
  [0.160, 0.540],  // 7 — left lower
  [0.120, 0.360],  // 8 — left upper
  [0.260, 0.220],  // 9 — top left
];

// ─── Player layout ────────────────────────────────────────────────────────────
function renderPlayers(containerId, { avatarSize = 80 } = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  const currentTurnPid = state._spotlightPid || state.turnOrder[state.hints.length];

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

    const wrap = document.createElement('div');
    wrap.className = 'avatar-wrap';
    wrap.dataset.playerId = p.id;
    wrap.style.left = x + 'px';
    wrap.style.top  = y + 'px';

    // Avatar moop
    const circle = document.createElement('div');
    circle.className = 'moop-avatar';
    circle.style.width  = avatarSize + 'px';
    circle.style.height = avatarSize + 'px';
    if (p.is_ghost)            circle.classList.add('is-ghost');
    if (p.id === state.playerId) circle.classList.add('is-you');
    if (p.id === currentTurnPid && !p.is_ghost) {
      circle.classList.add('is-active');
      if (state._spotlightStyle === 'morp') circle.classList.add('is-active-morp');
    }
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

    // Splatter overlay for vote/damage selection
    const splatter = document.createElement('div');
    splatter.className = 'splatter-overlay';
    circle.appendChild(splatter);

    wrap.appendChild(circle);

    // Hint thumbnail (hint phase + endgame ghost hints)
    // Appended after circle so it layers on top (held-card look)
    const thumbnail = state.hintThumbnails[p.id];
    const hintOnLeft = xf > 0.55 && W <= 1024; // only flip on tablet/mobile
    if (thumbnail !== undefined) {
      const tEl = _buildHintThumbnailEl(thumbnail, hintOnLeft);
      if (hintOnLeft) tEl.classList.add('hint-left');
      // During vote/damage, briefly disable transition so re-render doesn't
      // replay the enlarge effect, then re-enable for future hover interactions
      if (state.avatarInteraction) {
        tEl.style.transition = 'none';
        requestAnimationFrame(() => { tEl.style.transition = ''; });
      }
      wrap.appendChild(tEl);
    }

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
  const el = document.getElementById('game-player-row');
  if (!el) return;
  // If container has no dimensions yet (just un-hidden), defer until after reflow
  if (el.clientWidth === 0 || el.clientHeight === 0) {
    requestAnimationFrame(() => renderInGamePlayerRow());
    return;
  }
  const N = Object.values(state.players).length;
  const W = el.clientWidth;
  const H = el.clientHeight;
  const minDim = Math.min(W, H);
  const isMobile = W <= 430;
  // Scale avatar relative to container, reduce per extra player beyond 3
  // Mobile gets 50% boost, desktop/tablet gets 30% boost
  const scaleFactor = isMobile ? 0.33 : 0.286;
  const cap = isMobile ? 200 : 208;
  const baseSize = Math.min(minDim * scaleFactor, cap);
  const countPenalty = Math.max(0, N - 3) * (baseSize * 0.06);
  const avatarSize = Math.max(44, Math.round(baseSize - countPenalty));
  // Scale hint thumbnails relative to avatar/container size
  const hintScale = Math.max(1, Math.min(3, avatarSize / 50));
  el.style.setProperty('--hint-scale', hintScale.toFixed(2));
  renderPlayers('game-player-row', { avatarSize });
}

// Re-layout player orbit on resize (e.g. device rotation, window drag)
let _resizeRaf = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(_resizeRaf);
  _resizeRaf = requestAnimationFrame(() => {
    const el = document.getElementById('game-player-row');
    if (el && el.children.length > 0) renderInGamePlayerRow();
  });
});

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

let _chatFadeTimer = 0;
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
  // Unfade all messages, then fade after 5s of inactivity
  chatEl.querySelectorAll('.chat-faded').forEach(el => el.classList.remove('chat-faded'));
  clearTimeout(_chatFadeTimer);
  _chatFadeTimer = setTimeout(() => {
    chatEl.querySelectorAll('div').forEach(el => el.classList.add('chat-faded'));
  }, 5000);
}

// ─── Hint phase ───────────────────────────────────────────────────────────────
export function resetHintThumbnailAnimations() { _animatedThumbnails.clear(); }

export function openDrawPopup() {
  document.getElementById('draw-popup').classList.remove('hidden');
  document.getElementById('draw-popup-pill').classList.add('hidden');
}
export function minimizeDrawPopup() {
  document.getElementById('draw-popup').classList.add('hidden');
  document.getElementById('draw-popup-pill').classList.remove('hidden');
}
export function hideDrawPopup() {
  document.getElementById('draw-popup').classList.add('hidden');
  document.getElementById('draw-popup-pill').classList.add('hidden');
}

export function openEndgameDrawPopup() {
  document.getElementById('endgame-draw-popup').classList.remove('hidden');
  document.getElementById('endgame-draw-popup-pill').classList.add('hidden');
}
export function minimizeEndgameDrawPopup() {
  document.getElementById('endgame-draw-popup').classList.add('hidden');
  document.getElementById('endgame-draw-popup-pill').classList.remove('hidden');
}
export function hideEndgameDrawPopup() {
  document.getElementById('endgame-draw-popup').classList.add('hidden');
  document.getElementById('endgame-draw-popup-pill').classList.add('hidden');
}

export function checkYourTurn() {
  const currentPid = state.turnOrder[state.hints.length];
  const isMyTurn   = currentPid === state.playerId;
  const inHailMary = !!state._hailMaryMode;
  document.getElementById('your-turn-block').classList.toggle('hidden', !isMyTurn || inHailMary);
  if (isMyTurn && !inHailMary) {
    document.getElementById('hint-text-block').classList.toggle('hidden', state.drawingHints);
    if (state.drawingHints) {
      clearCanvas('hint-canvas');
      openDrawPopup();
    }
    playYourTurnSound();
  } else {
    hideDrawPopup();
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

  // Clear any centerpiece hint card that could block avatar clicks
  const layer = document.getElementById('interaction-anim-layer');
  if (layer) {
    layer.querySelectorAll('.hint-card').forEach(el => el.remove());
  }
  _inflightHint = null;

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

// ─── Vote arrows ──────────────────────────────────────────────────────────────
const _POINTER_ASSET = 'assets/pointer.png';

// ─── Hint display system ──────────────────────────────────────────────────────

const _HINT_FLY_MS    = 450;   // ms for fly-to-centerpiece transition
const _HINT_RETURN_MS = 380;   // ms for fly-back-to-thumbnail transition

let _inflightHint = null;       // { el, player_id, hintData } while hint is at centerpiece
let _pendingFlyCallback = null; // queued when next_turn arrives before showHintAtCenterpiece arms _inflightHint
const _animatedThumbnails = new Set();  // player IDs whose thumbnail has already popped in


// Collapse any pinned hint thumbnail when clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.hint-thumbnail.expanded').forEach(t => t.classList.remove('expanded'));
});

function _hintCenterpiecePos() {
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.5 };
}

function _buildHintCardEl(hint) {
  const el = document.createElement('div');
  el.className = 'hint-card';
  if (!hint.text && !hint.is_drawing) {
    el.classList.add('hint-skipped');
    el.textContent = '(skipped)';
  } else if (hint.is_drawing && hint.drawing_data) {
    el.classList.add('hint-drawing');
    const cv = document.createElement('canvas');
    cv.width = 360; cv.height = 232;
    renderStrokesToCanvas(cv, hint.drawing_data);
    el.appendChild(cv);
  } else {
    el.classList.add('hint-text');
    el.textContent = hint.text;
  }
  return el;
}

function _buildHintThumbnailEl(hint, isLeft = false) {
  const el = document.createElement('div');
  el.className = 'hint-thumbnail';
  if (!_animatedThumbnails.has(hint.player_id)) {
    _animatedThumbnails.add(hint.player_id);
    const animName = isLeft ? 'hint-thumb-pop-left' : 'hint-thumb-pop';
    el.style.animation = `${animName} 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both`;
    el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
  }
  // Click to pin enlarged — only outside vote/damage mode
  el.addEventListener('click', (e) => {
    if (state.avatarInteraction) return; // let click bubble to vote/damage handler
    e.stopPropagation();
    const wasExpanded = el.classList.contains('expanded');
    document.querySelectorAll('.hint-thumbnail.expanded').forEach(t => t.classList.remove('expanded'));
    if (!wasExpanded) el.classList.add('expanded');
  });
  if (!hint.text && !hint.is_drawing) {
    el.classList.add('hint-skipped');
    el.textContent = '(skip)';
  } else if (hint.is_drawing && hint.drawing_data) {
    el.classList.add('hint-thumbnail-drawing');
    const cv = document.createElement('canvas');
    cv.width = 360; cv.height = 232;
    renderStrokesToCanvas(cv, hint.drawing_data);
    el.appendChild(cv);
  } else {
    el.textContent = hint.text;
  }
  return el;
}

export function showHintAtCenterpiece(msg, onPhaseReady) {
  const layer = document.getElementById('interaction-anim-layer');
  if (!layer) { if (onPhaseReady) onPhaseReady(); return; }
  const from = _avatarCenterViewport(msg.player_id);
  if (!from) { if (onPhaseReady) onPhaseReady(); return; }

  const el = _buildHintCardEl(msg);
  el.style.cssText = `position:absolute; left:${from.x}px; top:${from.y}px;
    transform:translate(-50%,-50%) scale(0.1); opacity:0; pointer-events:none;`;
  layer.appendChild(el);

  const cp = _hintCenterpiecePos();
  const displayDuration = msg.display_duration || 5000;

  // Fly to centerpiece
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = `all ${_HINT_FLY_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
      el.style.left      = cp.x + 'px';
      el.style.top       = cp.y + 'px';
      el.style.transform = 'translate(-50%,-50%) scale(1)';
      el.style.opacity   = '1';
    });
  });

  // After fly-in + hold: arm next_turn callback and signal phase_ready
  setTimeout(() => {
    _inflightHint = {
      el,
      player_id: msg.player_id,
      hintData: { player_id: msg.player_id, text: msg.text || '', is_drawing: msg.is_drawing || false, drawing_data: msg.drawing_data || null },
    };
    if (onPhaseReady) onPhaseReady();

    // If next_turn arrived before we finished arming, drain the queued fly-back now
    if (_pendingFlyCallback) {
      const cb = _pendingFlyCallback;
      _pendingFlyCallback = null;
      flyHintToThumbnail(cb);
    }

    // Fallback: if next_turn never arrives, clean up after 3s
    setTimeout(() => {
      if (_inflightHint && _inflightHint.el === el) {
        const { player_id: pid, hintData: hd } = _inflightHint;
        el.remove();
        _inflightHint = null;
        state.hintThumbnails[pid] = hd;
        renderInGamePlayerRow();
      }
    }, 3000);
  }, _HINT_FLY_MS + displayDuration);
}

export function flyHintToThumbnail(onDone) {
  if (!_inflightHint) {
    if (onDone) onDone();
    return;
  }
  const { el, player_id, hintData } = _inflightHint;
  _inflightHint = null;

  // Target the avatar's bottom-right where the held-card thumbnail will appear
  const orbit = document.getElementById('game-player-row');
  const wrap  = orbit?.querySelector(`[data-player-id="${player_id}"]`);
  if (!wrap) {
    el.remove();
    state.hintThumbnails[player_id] = hintData;
    renderInGamePlayerRow();
    if (onDone) onDone();
    return;
  }

  const avatar = wrap.querySelector('.moop-avatar');
  const r   = avatar ? avatar.getBoundingClientRect() : wrap.getBoundingClientRect();
  const tx  = r.right;
  const ty  = r.bottom - r.height * 0.2;

  el.style.transition = `all ${_HINT_RETURN_MS}ms cubic-bezier(0.4, 0, 0.6, 1)`;
  el.style.left       = tx + 'px';
  el.style.top        = ty + 'px';
  el.style.transform  = 'translate(-50%,-100%) scale(0.08)';
  el.style.opacity    = '0';

  setTimeout(() => {
    el.remove();
    state.hintThumbnails[player_id] = hintData;
    renderInGamePlayerRow();
    if (onDone) onDone();
  }, _HINT_RETURN_MS);
}

/**
 * Like flyHintToThumbnail but safe to call before showHintAtCenterpiece has armed _inflightHint.
 * If _inflightHint isn't set yet, queues the callback; showHintAtCenterpiece will drain it.
 */
export function flyHintToThumbnailWhenReady(onDone) {
  if (_inflightHint) {
    flyHintToThumbnail(onDone);
  } else {
    _pendingFlyCallback = onDone;
  }
}

/**
 * Get avatar center in viewport coordinates.
 */
function _avatarCenterViewport(playerId) {
  const orbit = document.getElementById('game-player-row');
  if (!orbit) return null;
  const wrap = orbit.querySelector(`[data-player-id="${playerId}"]`);
  if (!wrap) return null;
  const r = wrap.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Position a pointer radially inside an avatar-wrap, aimed toward the accused.
 * The pointer asset points straight up at rest, so we rotate by angle + π/2.
 * Coordinates are relative to the wrap's center (since wrap uses translate(-50%,-50%)).
 */
const _POINTER_RADIAL_OFFSET = 80; // px from wrap center
function _positionPointer(pointer, fromRect, toRect) {
  const fx = fromRect.left + fromRect.width / 2;
  const fy = fromRect.top + fromRect.height / 2;
  const tx = toRect.left + toRect.width / 2;
  const ty = toRect.top + toRect.height / 2;
  const dx = tx - fx;
  const dy = ty - fy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return;

  const angle = Math.atan2(dy, dx);
  // Offset from center of the wrap element
  const px = fromRect.width / 2 + Math.cos(angle) * _POINTER_RADIAL_OFFSET;
  const py = fromRect.height / 2 + Math.sin(angle) * _POINTER_RADIAL_OFFSET;
  pointer.style.left = px + 'px';
  pointer.style.top = py + 'px';
  pointer.style.transform = `translate(-50%, -50%) rotate(${angle + Math.PI / 2}rad)`;
}

/**
 * Show vote pointers radially around each voter, aimed at their accused.
 * Pointers are appended to each voter's .avatar-wrap so they sit below
 * the envelope reveal overlay in the same stacking context.
 * votes: { voter_id: [accused_id, ...] }
 *
 * Returns a cleanup function that fades out and removes the pointers.
 */
export function showVoteArrows(votes) {
  const noop = () => {};

  if (!votes || Object.keys(votes).length === 0) return noop;

  const orbit = document.getElementById('game-player-row');
  if (!orbit) return noop;

  const pointers = []; // { pointer, voterWrap, accusedWrap }

  for (const [voterId, accusedIds] of Object.entries(votes)) {
    const voterWrap = orbit.querySelector(`[data-player-id="${voterId}"]`);
    if (!voterWrap) continue;

    for (const accusedId of accusedIds) {
      const accusedWrap = orbit.querySelector(`[data-player-id="${accusedId}"]`);
      if (!accusedWrap) continue;

      const fromRect = voterWrap.getBoundingClientRect();
      const toRect = accusedWrap.getBoundingClientRect();
      const dx = (toRect.left + toRect.width / 2) - (fromRect.left + fromRect.width / 2);
      const dy = (toRect.top + toRect.height / 2) - (fromRect.top + fromRect.height / 2);
      if (Math.sqrt(dx * dx + dy * dy) < 1) continue;

      const pointer = document.createElement('img');
      pointer.className = 'vote-arrow-pointer';
      pointer.src = _POINTER_ASSET;
      pointer.draggable = false;
      voterWrap.appendChild(pointer);

      _positionPointer(pointer, fromRect, toRect);
      pointers.push({ pointer, voterWrap, accusedWrap });
    }
  }

  if (pointers.length === 0) return noop;

  // Reposition pointers when the user scrolls
  const reposition = () => {
    for (const { pointer, voterWrap, accusedWrap } of pointers) {
      const fromRect = voterWrap.getBoundingClientRect();
      const toRect = accusedWrap.getBoundingClientRect();
      _positionPointer(pointer, fromRect, toRect);
    }
  };
  window.addEventListener('scroll', reposition, { passive: true });

  const allEls = pointers.map(p => p.pointer);

  // Fade in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      allEls.forEach(el => el.classList.add('visible'));
    });
  });

  // Return cleanup: fade out and remove
  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    allEls.forEach(el => el.classList.add('fading'));
    setTimeout(() => {
      allEls.forEach(el => el.remove());
      window.removeEventListener('scroll', reposition);
    }, 500);
  };
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
 * Returns total animation duration in ms (for animation lock timeout).
 */
export function playRoleRevealSequence(revealOrder, onDone) {
  const playerRow = document.getElementById('game-player-row');
  if (!playerRow || revealOrder.length === 0) {
    if (onDone) onDone();
    return 0;
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
  const totalDuration = delay + 1500; // extra hold after final reveal
  setTimeout(() => {
    // Remove all envelope overlays
    for (const els of Object.values(envelopeEls)) {
      els.wrap.remove();
    }
    if (onDone) onDone();
  }, totalDuration);
  return totalDuration;
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
  const msgType = state._hailMaryDamage ? 'hail_mary_deal_damage' : 'morp_deal_damage';
  send({ type: msgType, target_id: state.damageTarget });
  state.avatarInteraction = null;
  state._hailMaryDamage = false;
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
    ['btn-hail-mary-guess', 'hail-mary-selected-word'],
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

  // Auto-open after 3s if the player hasn't clicked
  const autoOpenTimer = setTimeout(openEnvelope, 3000);
  overlay.addEventListener('click', () => {
    clearTimeout(autoOpenTimer);
    if (phase === 'closed') openEnvelope();
    else if (phase === 'revealed') dismiss();
  });
}

// ─── Hail Mary popup ─────────────────────────────────────────────────────────
export function showHailMaryPopup(onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'hail-mary-overlay';

  const text = document.createElement('div');
  text.className = 'hail-mary-text';
  text.textContent = 'HAIL MARY';
  overlay.appendChild(text);
  document.body.appendChild(overlay);

  // Trigger entrance animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('active'));
  });

  setTimeout(() => {
    overlay.classList.add('hiding');
    setTimeout(() => {
      overlay.remove();
      if (onDone) onDone();
    }, 500);
  }, 1800);
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
