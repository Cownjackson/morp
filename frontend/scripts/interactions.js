import { state, send } from './state.js';

// ─── Interaction catalog ───────────────────────────────────────────────────────
// Add new interactions here — no other file needs to change for new types.
const INTERACTIONS = [
  { id: 'spitball',    label: 'Spitball',    targeted: true,  emoji: '🫧' },
  { id: 'sticky_hand', label: 'Sticky Hand', targeted: true,  emoji: '🖐️' },
  { id: 'bark',        label: 'Bark',        targeted: false, emoji: '🐕' },
  { id: 'meow',        label: 'Meow',        targeted: false, emoji: '🐱' },
];

const COOLDOWN_MS = 2000;

// ─── Module state ─────────────────────────────────────────────────────────────
let _menuOpen = false;
let _pending = null;   // interaction waiting for a target
let _onCooldown = false;

// ─── Init ─────────────────────────────────────────────────────────────────────
export function initInteractions() {
  // Trigger button
  const triggerEl = document.createElement('div');
  triggerEl.id = 'interaction-trigger';
  triggerEl.className = 'hidden';
  triggerEl.innerHTML = `
    <button id="interaction-btn" title="Interactions">🎭</button>
    <div id="interaction-menu" class="interaction-menu hidden"></div>
  `;
  document.body.appendChild(triggerEl);

  // Animation layer (fixed, full-viewport, pointer-events: none)
  const animLayer = document.createElement('div');
  animLayer.id = 'interaction-anim-layer';
  document.body.appendChild(animLayer);

  // Populate menu
  const menu = document.getElementById('interaction-menu');
  for (const ix of INTERACTIONS) {
    const btn = document.createElement('button');
    btn.className = 'ix-option';
    btn.dataset.id = ix.id;
    btn.innerHTML = `<span class="ix-emoji">${ix.emoji}</span><span class="ix-label">${ix.label}</span>`;
    btn.addEventListener('click', e => { e.stopPropagation(); _onOptionClick(ix); });
    menu.appendChild(btn);
  }

  document.getElementById('interaction-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggleInteractionMenu();
  });

  // Clicking anything outside closes the menu
  document.addEventListener('click', () => closeMenu());
}

// ─── Menu open/close ──────────────────────────────────────────────────────────
export function toggleInteractionMenu() {
  _menuOpen ? closeMenu() : _openMenu();
}

function _openMenu() {
  if (_onCooldown) return;
  _menuOpen = true;
  document.getElementById('interaction-menu').classList.remove('hidden');
  document.getElementById('interaction-btn').classList.add('open');
}

function closeMenu() {
  if (!_menuOpen && !_pending) return;
  _menuOpen = false;
  _pending = null;
  document.getElementById('interaction-menu').classList.add('hidden');
  document.getElementById('interaction-btn').classList.remove('open');
  _clearTargetingMode();
}

// ─── Option selected ──────────────────────────────────────────────────────────
function _onOptionClick(ix) {
  if (ix.targeted) {
    _pending = ix;
    document.getElementById('interaction-menu').classList.add('hidden');
    _menuOpen = false;
    _enterTargetingMode();
  } else {
    _fire(ix.id, null);
    closeMenu();
  }
}

// ─── Targeting mode ───────────────────────────────────────────────────────────
function _enterTargetingMode() {
  const orbit = document.getElementById('game-player-row');
  if (!orbit) return;
  orbit.classList.add('targeting-mode');
  orbit.querySelectorAll('.avatar-wrap').forEach(wrap => {
    const pid = wrap.dataset.playerId;
    if (pid && pid !== state.playerId) {
      wrap.classList.add('targetable');
      wrap.addEventListener('click', _onTargetClick, { once: true });
    }
  });
}

function _clearTargetingMode() {
  const orbit = document.getElementById('game-player-row');
  if (!orbit) return;
  orbit.classList.remove('targeting-mode');
  orbit.querySelectorAll('.avatar-wrap').forEach(wrap => {
    wrap.classList.remove('targetable');
    wrap.removeEventListener('click', _onTargetClick);
  });
}

function _onTargetClick(e) {
  e.stopPropagation();
  const pid = e.currentTarget.dataset.playerId;
  if (!_pending || !pid) return;
  _fire(_pending.id, pid);
  closeMenu();
}

// ─── Fire ─────────────────────────────────────────────────────────────────────
function _fire(interactionId, targetId) {
  if (_onCooldown) return;
  const msg = { type: 'interaction', interaction: interactionId };
  if (targetId) msg.target_id = targetId;
  send(msg);
  _startCooldown();
}

function _startCooldown() {
  _onCooldown = true;
  const btn = document.getElementById('interaction-btn');
  btn.disabled = true;
  btn.classList.add('cooldown');
  setTimeout(() => {
    _onCooldown = false;
    btn.disabled = false;
    btn.classList.remove('cooldown');
  }, COOLDOWN_MS);
}

// ─── Handle incoming interaction (server echo) ────────────────────────────────
export function handleInteraction({ player_id, interaction, target_id }) {
  if (target_id) {
    _playProjectile(player_id, target_id, interaction);
  } else {
    _playSelfAnim(player_id);
  }
}

// ─── Animation helpers ────────────────────────────────────────────────────────
function _avatarCenter(playerId) {
  const orbit = document.getElementById('game-player-row');
  if (!orbit) return null;
  const wrap = orbit.querySelector(`[data-player-id="${playerId}"]`);
  if (!wrap) return null;
  const r = wrap.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function _playProjectile(fromId, toId, interaction) {
  const from = _avatarCenter(fromId);
  const to   = _avatarCenter(toId);
  if (!from || !to) return;

  const ix    = INTERACTIONS.find(i => i.id === interaction);
  const emoji = ix?.emoji ?? '💥';
  const layer = document.getElementById('interaction-anim-layer');

  const proj = document.createElement('div');
  proj.className = 'ix-projectile';
  proj.textContent = emoji;
  layer.appendChild(proj);

  const dx   = to.x - from.x;
  const dy   = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const dur  = Math.max(400, Math.min(900, dist * 1.2));

  const start = performance.now();
  function step(now) {
    const t   = Math.min(1, (now - start) / dur);
    const arc = Math.sin(t * Math.PI) * -50;
    const px  = from.x + dx * t + (-dy / dist) * arc;
    const py  = from.y + dy * t + (dx / dist) * arc;
    proj.style.left      = px + 'px';
    proj.style.top       = py + 'px';
    proj.style.transform = `translate(-50%,-50%) scale(${0.6 + 0.8 * Math.sin(t * Math.PI)})`;
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      proj.remove();
      _playHitReaction(toId);
    }
  }
  requestAnimationFrame(step);
}

function _playSelfAnim(playerId) {
  _applyAvatarClass(playerId, 'ix-self');
}

function _playHitReaction(playerId) {
  _applyAvatarClass(playerId, 'ix-hit');
}

function _applyAvatarClass(playerId, cls) {
  const orbit = document.getElementById('game-player-row');
  if (!orbit) return;
  const avatar = orbit.querySelector(`[data-player-id="${playerId}"] .moop-avatar`);
  if (!avatar) return;
  avatar.classList.add(cls);
  avatar.addEventListener('animationend', () => avatar.classList.remove(cls), { once: true });
}

// ─── Visibility ───────────────────────────────────────────────────────────────
export function showInteractionTrigger(visible) {
  document.getElementById('interaction-trigger')?.classList.toggle('hidden', !visible);
  if (!visible) closeMenu();
}
