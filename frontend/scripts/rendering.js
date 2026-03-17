import { state, send } from './state.js';
import { avatarColor, initials, playerName, httpBase, log } from './helpers.js';
import { renderMoopInto } from './cosmetics.js';
import { renderStrokesToCanvas, _drawState, clearCanvas } from './drawing.js';

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
    grid.appendChild(cell);
  }
  document.getElementById('half-board-note').style.display = halfSet ? 'block' : 'none';
}

// ─── Player row ───────────────────────────────────────────────────────────────
export function renderPlayerRow() {
  const el = document.getElementById('player-row');
  el.innerHTML = '';
  const currentTurnPid = state.turnOrder[state.hints.length];

  const players = Object.values(state.players);
  const N = players.length;
  if (N === 0) return;

  const W = el.clientWidth || 640;
  const H = 560;
  const cx = W * 0.50;
  const cy = H * 0.50;
  const rx = W * 0.42;
  const ry = H * 0.24;

  for (let idx = 0; idx < N; idx++) {
    const p = players[idx];
    const angle = (2 * Math.PI * idx / N) - Math.PI / 2;
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    const _p = Math.PI;
    const _a = angle > _p ? angle - 2*_p : angle;
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
    circle.style.width = '80px';
    circle.style.height = '80px';
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
    el.appendChild(wrap);
  }

  // Centre the poker table image
  const tableImg = document.createElement('img');
  tableImg.src = '/assets/poker-table-texas-hold-em-online-poker-poker-Photoroom.png';
  tableImg.style.cssText = `position:absolute;pointer-events:none;opacity:0.22;`
    + `transform:translate(-50%,-50%);left:${cx}px;top:${cy}px;width:${rx * 2 * 0.72}px`;
  el.appendChild(tableImg);
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
  renderPlayerRow();
}

// ─── Voting ───────────────────────────────────────────────────────────────────
export function renderVoteButtons() {
  const el = document.getElementById('vote-buttons');
  el.innerHTML = '';
  document.getElementById('vote-count-label').textContent = state.numVotes;
  document.getElementById('vote-waiting').style.display = 'none';

  for (const p of Object.values(state.players)) {
    if (p.is_ghost || p.id === state.playerId) continue;
    const btn = document.createElement('button');
    btn.className = 'vote-btn';
    btn.textContent = p.name; btn.dataset.pid = p.id;
    btn.onclick = () => toggleVote(p.id, btn);
    el.appendChild(btn);
  }
  updateVoteSubmitBtn();
}

function toggleVote(pid, btn) {
  const idx = state.selectedVotes.indexOf(pid);
  if (idx >= 0) {
    state.selectedVotes.splice(idx, 1); btn.classList.remove('selected');
  } else if (state.selectedVotes.length < state.numVotes) {
    state.selectedVotes.push(pid); btn.classList.add('selected');
  }
  updateVoteSubmitBtn();
}

function updateVoteSubmitBtn() {
  document.getElementById('btn-submit-votes').disabled =
    state.selectedVotes.length !== state.numVotes;
}

// ─── Accusation ───────────────────────────────────────────────────────────────
export function renderAccusation(msg) {
  const lines = msg.accused_ids.map(id => {
    const role = msg.roles_revealed[id];
    return `<div style="display:flex;gap:8px;align-items:center;margin:4px 0">
      <div class="moop-avatar" id="acc-moop-${id}" style="width:40px;height:40px;flex-shrink:0"></div>
      <strong>${playerName(id)}</strong>
      <span class="tag ${role}">${role.toUpperCase()}</span>
    </div>`;
  });
  document.getElementById('accusation-content').innerHTML =
    `<p style="color:#705060;font-size:0.85em;margin-bottom:6px">Accused:</p>${lines.join('')}`;
  msg.accused_ids.forEach(id => {
    const el = document.getElementById(`acc-moop-${id}`);
    if (el && state.players[id]?.cosmetics) renderMoopInto(el, state.players[id].cosmetics);
  });
}

// ─── Damage ───────────────────────────────────────────────────────────────────
export function renderDamageButtons(morpIds) {
  const el = document.getElementById('damage-buttons');
  el.innerHTML = '';
  for (const p of Object.values(state.players)) {
    if (p.is_ghost || morpIds.includes(p.id)) continue;
    const btn = document.createElement('button');
    btn.className = 'danger';
    btn.textContent = `✕ ${p.name}`;
    btn.onclick = () => {
      send({ type: 'morp_deal_damage', target_id: p.id });
      el.querySelectorAll('button').forEach(b => b.disabled = true);
    };
    el.appendChild(btn);
  }
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
