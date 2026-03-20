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
    if (interaction === 'sticky_hand') {
      _playStickyHand(player_id, target_id);
    } else {
      _playProjectile(player_id, target_id, interaction);
    }
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

// ─── Sticky hand animation ────────────────────────────────────────────────────
// Lissajous back-lobe windup (π → 3π/2) → direct throw → SMACK → STICK → RETRACT.
function _playStickyHand(fromId, toId) {
  const from = _avatarCenter(fromId);
  const to   = _avatarCenter(toId);
  if (!from || !to) return;

  const layer = document.getElementById('interaction-anim-layer');
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // Hand art points UP — offset so fingers face target direction
  const faceAngle = Math.atan2(dy, dx) + Math.PI / 2;

  // Unit vectors: forward toward target, perpendicular for lateral sweep
  const ux = dx / dist;
  const uy = dy / dist;
  const px = -uy;
  const py =  ux;

  // Red elastic band tether
  const band = document.createElement('div');
  band.style.cssText = 'position:fixed;height:4px;'
    + 'background:linear-gradient(90deg, rgba(200,30,30,0.95), rgba(230,50,50,0.7));'
    + 'transform-origin:left center;pointer-events:none;z-index:24;border-radius:2px;';
  layer.appendChild(band);

  // Hand image
  const hand = document.createElement('img');
  hand.className = 'ix-sticky-hand';
  hand.src = '/assets/sticky_hand.png';
  hand.draggable = false;
  layer.appendChild(hand);

  // Slap sound
  const slapSfx = new Audio('/music/sticky_hand_slap.mp3');
  slapSfx.volume = 0.6;

  // Phase durations (ms)
  const T_WINDUP  = Math.max(500, Math.min(700, dist * 0.7));
  const T_THROW   = Math.max(150, Math.min(300, dist * 0.35));
  const T_SMACK   = 200;
  const T_STICK   = 550;
  const T_RETRACT = Math.max(250, Math.min(500, dist * 0.6));

  // Windup peak — throw launches from here (30% behind sender, on-axis)
  const peakX = from.x - dist * 0.3 * ux;
  const peakY = from.y - dist * 0.3 * uy;

  let hitFired    = false;
  let markStamped = false;
  const start = performance.now();

  function _setBand(hx, hy, opacity = 1) {
    const bx  = hx - from.x;
    const by  = hy - from.y;
    const len = Math.sqrt(bx * bx + by * by);
    const ang = Math.atan2(by, bx);
    band.style.left      = from.x + 'px';
    band.style.top       = from.y + 'px';
    band.style.width     = len + 'px';
    band.style.opacity   = String(opacity);
    band.style.transform = `translateY(-50%) rotate(${ang}rad)`;
  }

  function _setHand(hx, hy, scale, rot) {
    hand.style.left      = hx + 'px';
    hand.style.top       = hy + 'px';
    hand.style.transform = `translate(-50%,-50%) rotate(${rot}rad) scale(${scale})`;
  }

  function step(now) {
    const e = now - start;

    if (e < T_WINDUP) {
      // ── WINDUP — figure-8 back lobe, sender to peak (π → 3π/2) ────────
      const t = e / T_WINDUP;

      // Lissajous half-lobe: parameter sweeps π → 3π/2
      //   π    → (0,0)  = sender (start)
      //   3π/2 → (-1,0) = windup peak (behind sender) — throw launches here
      const param = Math.PI + t * (Math.PI / 2);
      const fx = Math.sin(param);
      const fy = Math.sin(2 * param) / 2;

      const xScale = dist * 0.3;
      const yScale = dist * 0.5;

      const hx = from.x + fx * xScale * ux + fy * yScale * px;
      const hy = from.y + fx * xScale * uy + fy * yScale * py;

      // Rotation follows the curve tangent naturally
      const tanFx = Math.cos(param);
      const tanFy = Math.cos(2 * param);
      const wTanX = tanFx * ux + tanFy * px;
      const wTanY = tanFx * uy + tanFy * py;
      const handRot = Math.atan2(wTanY, wTanX) + Math.PI / 2;

      _setHand(hx, hy, 0.55 + 0.15 * t, handRot);
      _setBand(hx, hy);
      requestAnimationFrame(step);

    } else if (e < T_WINDUP + T_THROW) {
      // ── THROW — from windup peak straight at target ────────────────────
      const t = (e - T_WINDUP) / T_THROW;
      const ease = 1 - Math.pow(1 - t, 3);  // ease-out: explosive start

      // Subtle overhead arc
      const arc = Math.sin(t * Math.PI) * dist * -0.08;
      const hx = peakX + (to.x - peakX) * ease + px * arc;
      const hy = peakY + (to.y - peakY) * ease + py * arc;

      _setHand(hx, hy, 0.7 + 0.5 * ease, faceAngle);
      _setBand(hx, hy);
      requestAnimationFrame(step);

    } else if (e < T_WINDUP + T_THROW + T_SMACK) {
      // ── SMACK — splat on impact ────────────────────────────────────────
      const t = (e - T_WINDUP - T_THROW) / T_SMACK;
      if (!hitFired) {
        hitFired = true;
        _applyAvatarClass(toId, 'ix-slap-judder');
        slapSfx.play().catch(() => {});
      }
      const scaleX = t < 0.3 ? 1.0 + 0.6 * (t / 0.3)
                   : t < 0.6 ? 1.6 - 0.8 * ((t - 0.3) / 0.3)
                   :           0.8 + 0.2 * ((t - 0.6) / 0.4);
      _setHand(to.x, to.y, scaleX, faceAngle);
      _setBand(to.x, to.y);
      requestAnimationFrame(step);

    } else if (e < T_WINDUP + T_THROW + T_SMACK + T_STICK) {
      // ── STICK — adheres with wobble ────────────────────────────────────
      const t      = (e - T_WINDUP - T_THROW - T_SMACK) / T_STICK;
      const wobble = Math.sin(t * Math.PI * 5) * 0.04 * (1 - t);
      _setHand(to.x, to.y, 1 + wobble, faceAngle);
      _setBand(to.x, to.y);
      requestAnimationFrame(step);

    } else if (e < T_WINDUP + T_THROW + T_SMACK + T_STICK + T_RETRACT) {
      // ── RETRACT — slow peel then elastic snap ──────────────────────────
      const t    = (e - T_WINDUP - T_THROW - T_SMACK - T_STICK) / T_RETRACT;
      const ease = t * t * t;
      if (!markStamped) { markStamped = true; _stampHandMark(to.x, to.y, faceAngle); }
      const hx = to.x + (from.x - to.x) * ease;
      const hy = to.y + (from.y - to.y) * ease;
      _setHand(hx, hy, 1 - 0.5 * ease, faceAngle + ease * 0.8);
      _setBand(hx, hy, 1 - ease * 0.9);
      requestAnimationFrame(step);

    } else {
      hand.remove();
      band.remove();
    }
  }

  requestAnimationFrame(step);
}

function _stampHandMark(x, y, rot) {
  const layer = document.getElementById('interaction-anim-layer');
  if (!layer) return;

  const mark = document.createElement('img');
  mark.className = 'ix-hand-mark';
  mark.src = '/assets/sticky_hand.png';
  mark.draggable = false;
  mark.style.left      = x + 'px';
  mark.style.top       = y + 'px';
  mark.style.transform = `translate(-50%,-50%) rotate(${rot}rad)`;
  layer.appendChild(mark);

  mark.addEventListener('animationend', () => mark.remove(), { once: true });
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
