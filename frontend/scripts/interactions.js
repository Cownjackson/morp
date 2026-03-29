import { state, send } from './state.js';

// ─── Spit overlay ───────────────────────────────────────────────────────────
// Blue tint applied to YOUR screen when hit by spitballs.
// TODO: replace with custom artwork overlay once art is ready.
//
// First hit applies a big initial splat. Subsequent hits while active add less
// than the decay removes, so a single player can never stack to blinding.
// But multiple players hitting in concert can overwhelm the decay.
const SPIT_INITIAL_HIT  = 0.55;  // first hit (from zero) — immediately noticeable
const SPIT_STACK_HIT    = 0.18;  // subsequent hits while already active
const SPIT_MAX_OPACITY  = 1.0;   // hard cap
const SPIT_DECAY_RATE   = 0.12;  // opacity lost per second — slow drain

let _spitLevel = 0;
let _spitOverlay = null;
let _spitDecaying = false;

function _ensureSpitOverlay() {
  if (_spitOverlay) return _spitOverlay;
  _spitOverlay = document.createElement('div');
  _spitOverlay.id = 'spit-overlay';
  document.body.appendChild(_spitOverlay);
  return _spitOverlay;
}

function _onSpitHit() {
  _ensureSpitOverlay();
  const bump = _spitLevel <= 0 ? SPIT_INITIAL_HIT : SPIT_STACK_HIT;
  _spitLevel = Math.min(SPIT_MAX_OPACITY, _spitLevel + bump);
  _spitOverlay.style.opacity = String(_spitLevel);
  if (!_spitDecaying) _startSpitDecay();
  // Spawn splatter globs on the screen
  _spawnSpitSplatters();
}

function _spawnSpitSplatters() {
  const count = 4 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const glob = document.createElement('div');
    glob.className = 'spit-glob';
    // Random position biased toward center
    const cx = 50 + (Math.random() - 0.5) * 70;
    const cy = 50 + (Math.random() - 0.5) * 60;
    glob.style.left = cx + '%';
    glob.style.top  = cy + '%';
    // Random blob size
    const size = 30 + Math.random() * 60;
    glob.style.width  = size + 'px';
    glob.style.height = (size * (0.6 + Math.random() * 0.5)) + 'px';
    // Random delay for staggered splat feel
    glob.style.animationDelay = (Math.random() * 0.15) + 's';
    _spitOverlay.appendChild(glob);
    glob.addEventListener('animationend', () => glob.remove(), { once: true });
  }
}

function _startSpitDecay() {
  _spitDecaying = true;
  let last = performance.now();
  function tick(now) {
    const dt = (now - last) / 1000;
    last = now;
    _spitLevel = Math.max(0, _spitLevel - SPIT_DECAY_RATE * dt);
    _spitOverlay.style.opacity = String(_spitLevel);
    if (_spitLevel > 0) {
      requestAnimationFrame(tick);
    } else {
      _spitDecaying = false;
    }
  }
  requestAnimationFrame(tick);
}

// ─── Interaction catalog ───────────────────────────────────────────────────────
// Add new interactions here — no other file needs to change for new types.
const INTERACTIONS = [
  { id: 'spitball',    label: 'Spitball',    targeted: true,  emoji: '🫧', icon: '/assets/spitball.png' },
  { id: 'sticky_hand', label: 'Sticky Hand', targeted: true,  emoji: '🖐️', icon: '/assets/sticky_hand.png' },
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
    const iconHtml = ix.icon
      ? `<img class="ix-icon" src="${ix.icon}" alt="${ix.label}" draggable="false">`
      : `<span class="ix-emoji">${ix.emoji}</span>`;
    btn.innerHTML = `${iconHtml}<span class="ix-label">${ix.label}</span>`;
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
export function handleInteraction({ player_id, interaction, target_id, sound }) {
  if (target_id) {
    if (interaction === 'sticky_hand') {
      _playStickyHand(player_id, target_id);
    } else if (interaction === 'spitball') {
      _playSpitball(player_id, target_id);
    } else {
      _playProjectile(player_id, target_id, interaction);
    }
  } else {
    _playSelfAnim(player_id);
    _playNoiseOverlay(player_id);
    if (interaction === 'meow' && sound) {
      const sfx = new Audio(`/music/meows/${sound}`);
      sfx.volume = 0.5;
      sfx.play().catch(() => {});
    }
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
  const scrollY0 = window.scrollY;

  const start = performance.now();
  function step(now) {
    const t   = Math.min(1, (now - start) / dur);
    const sdy = window.scrollY - scrollY0;
    const arc = Math.sin(t * Math.PI) * -50;
    const px  = from.x + dx * t + (-dy / dist) * arc;
    const py  = from.y - sdy + dy * t + (dx / dist) * arc;
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

// ─── Spitball animation ──────────────────────────────────────────────────────
// Lean-back windup → straight shot with ease-out → wet blue trail → splat.
function _playSpitball(fromId, toId) {
  const from = _avatarCenter(fromId);
  const to   = _avatarCenter(toId);
  if (!from || !to) return;

  const layer = document.getElementById('interaction-anim-layer');
  const dx   = to.x - from.x;
  const dy   = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Unit vector toward target (for lean direction)
  const ux = dx / dist;
  const uy = dy / dist;

  // Spitball image (hidden during windup)
  const ball = document.createElement('img');
  ball.className = 'ix-spitball';
  ball.src = '/assets/spitball.png';
  ball.draggable = false;
  ball.style.opacity = '0';
  layer.appendChild(ball);

  // Spit sound — plays when ball launches, not during windup
  const spitSfx = new Audio('/music/spit.mp3');
  spitSfx.volume = 0.5;

  // Phase durations
  const T_LEAN  = 300;   // lean back
  const T_FLIGHT = Math.max(790, Math.min(1460, dist * 1.46));

  let launched = false;
  let lastTrailT = 0;
  const start = performance.now();
  const scrollY0 = window.scrollY;

  // Lean-back: tilt sender avatar away from target
  const fromAvatar = document.querySelector(
    `#game-player-row [data-player-id="${fromId}"] .moop-avatar`
  );
  if (fromAvatar) {
    fromAvatar.style.setProperty('--lean-x', `${-ux * 18}px`);
    fromAvatar.style.setProperty('--lean-y', `${-uy * 18}px`);
  }
  _applyAvatarClass(fromId, 'ix-spit-lean');

  function step(now) {
    const e = now - start;
    const sdy = window.scrollY - scrollY0;

    if (e < T_LEAN) {
      // Windup — ball stays hidden, avatar is leaning via CSS class
      requestAnimationFrame(step);

    } else {
      // ── FLIGHT ──
      if (!launched) {
        launched = true;
        ball.style.opacity = '1';
        spitSfx.play().catch(() => {});
      }

      const t = Math.min(1, (e - T_LEAN) / T_FLIGHT);
      // Slight ease-out that stays punchy — doesn't linger at the end
      const ease = 1 - Math.pow(1 - t, 1.6);

      const bx = from.x + dx * ease;
      const by = from.y - sdy + dy * ease;

      ball.style.left = bx + 'px';
      ball.style.top  = by + 'px';
      const spin = t * 540;
      ball.style.transform = `translate(-50%,-50%) rotate(${spin}deg) scale(${0.9 + 0.3 * Math.sin(t * Math.PI)})`;

      // Trail drops every ~6%
      if (t - lastTrailT > 0.06 && t < 0.92) {
        lastTrailT = t;
        _spawnTrailDrop(layer, bx, by);
      }

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        ball.remove();
        _spawnSplatBurst(layer, to.x, to.y - sdy);
        _playHitReaction(toId);
        if (toId === state.playerId) _onSpitHit();
      }
    }
  }
  requestAnimationFrame(step);
}

function _spawnTrailDrop(layer, x, y) {
  const drop = document.createElement('div');
  drop.className = 'ix-spit-trail';
  // Slight random offset for organic feel
  const ox = (Math.random() - 0.5) * 8;
  const oy = (Math.random() - 0.5) * 8;
  drop.style.left = (x + ox) + 'px';
  drop.style.top  = (y + oy) + 'px';
  const size = 4 + Math.random() * 6;
  drop.style.width  = size + 'px';
  drop.style.height = size + 'px';
  layer.appendChild(drop);
  drop.addEventListener('animationend', () => drop.remove(), { once: true });
}

function _spawnSplatBurst(layer, x, y) {
  for (let i = 0; i < 6; i++) {
    const drop = document.createElement('div');
    drop.className = 'ix-spit-splat';
    const angle = (Math.PI * 2 / 6) * i + (Math.random() - 0.5) * 0.5;
    const r = 12 + Math.random() * 18;
    drop.style.left = (x + Math.cos(angle) * r) + 'px';
    drop.style.top  = (y + Math.sin(angle) * r) + 'px';
    const size = 5 + Math.random() * 7;
    drop.style.width  = size + 'px';
    drop.style.height = size + 'px';
    layer.appendChild(drop);
    drop.addEventListener('animationend', () => drop.remove(), { once: true });
  }
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

  // Track scroll so animation stays locked to avatars
  const scrollY0 = window.scrollY;

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

  function _setBand(hx, hy, fx, fy, opacity = 1) {
    const bx  = hx - fx;
    const by  = hy - fy;
    const len = Math.sqrt(bx * bx + by * by);
    const ang = Math.atan2(by, bx);
    band.style.left      = fx + 'px';
    band.style.top       = fy + 'px';
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
    // Scroll-adjust: shift all Y positions so animation tracks avatars
    const sdy = window.scrollY - scrollY0;
    const fy = from.y - sdy;
    const ty = to.y - sdy;
    const pY = peakY - sdy;

    if (e < T_WINDUP) {
      // ── WINDUP — figure-8 back lobe, sender to peak (π → 3π/2) ────────
      const t = e / T_WINDUP;

      // Lissajous half-lobe: parameter sweeps π → 3π/2
      //   π    → (0,0)  = sender (start)
      //   3π/2 → (-1,0) = windup peak (behind sender) — throw launches here
      const param = Math.PI + t * (Math.PI / 2);
      const lx = Math.sin(param);
      const ly = Math.sin(2 * param) / 2;

      const xScale = dist * 0.3;
      const yScale = dist * 0.5;

      const hx = from.x + lx * xScale * ux + ly * yScale * px;
      const hy = fy + lx * xScale * uy + ly * yScale * py;

      // Rotation follows the curve tangent naturally
      const tanFx = Math.cos(param);
      const tanFy = Math.cos(2 * param);
      const wTanX = tanFx * ux + tanFy * px;
      const wTanY = tanFx * uy + tanFy * py;
      const handRot = Math.atan2(wTanY, wTanX) + Math.PI / 2;

      _setHand(hx, hy, 0.55 + 0.15 * t, handRot);
      _setBand(hx, hy, from.x, fy);
      requestAnimationFrame(step);

    } else if (e < T_WINDUP + T_THROW) {
      // ── THROW — from windup peak straight at target ────────────────────
      const t = (e - T_WINDUP) / T_THROW;
      const ease = 1 - Math.pow(1 - t, 3);  // ease-out: explosive start

      // Subtle overhead arc
      const arc = Math.sin(t * Math.PI) * dist * -0.08;
      const hx = peakX + (to.x - peakX) * ease + px * arc;
      const hy = pY + (ty - pY) * ease + py * arc;

      _setHand(hx, hy, 0.7 + 0.5 * ease, faceAngle);
      _setBand(hx, hy, from.x, fy);
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
      _setHand(to.x, ty, scaleX, faceAngle);
      _setBand(to.x, ty, from.x, fy);
      requestAnimationFrame(step);

    } else if (e < T_WINDUP + T_THROW + T_SMACK + T_STICK) {
      // ── STICK — adheres with wobble ────────────────────────────────────
      const t      = (e - T_WINDUP - T_THROW - T_SMACK) / T_STICK;
      const wobble = Math.sin(t * Math.PI * 5) * 0.04 * (1 - t);
      _setHand(to.x, ty, 1 + wobble, faceAngle);
      _setBand(to.x, ty, from.x, fy);
      requestAnimationFrame(step);

    } else if (e < T_WINDUP + T_THROW + T_SMACK + T_STICK + T_RETRACT) {
      // ── RETRACT — slow peel then elastic snap ──────────────────────────
      const t    = (e - T_WINDUP - T_THROW - T_SMACK - T_STICK) / T_RETRACT;
      const ease = t * t * t;
      if (!markStamped) { markStamped = true; _stampHandMark(to.x, ty, faceAngle); }
      const hx = to.x + (from.x - to.x) * ease;
      const hy = ty + (fy - ty) * ease;
      _setHand(hx, hy, 1 - 0.5 * ease, faceAngle + ease * 0.8);
      _setBand(hx, hy, from.x, fy, 1 - ease * 0.9);
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

  const markScrollY0 = window.scrollY;
  const onScroll = () => {
    mark.style.top = (y - (window.scrollY - markScrollY0)) + 'px';
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  mark.addEventListener('animationend', () => {
    mark.remove();
    window.removeEventListener('scroll', onScroll);
  }, { once: true });
}

function _playSelfAnim(playerId) {
  _applyAvatarClass(playerId, 'ix-self');
}

// ─── Noise overlay — cycles noise1/noise2 PNGs over avatar ──────────────────
function _playNoiseOverlay(playerId) {
  const orbit = document.getElementById('game-player-row');
  if (!orbit) return;
  const wrap = orbit.querySelector(`[data-player-id="${playerId}"]`);
  if (!wrap) return;
  const avatar = wrap.querySelector('.moop-avatar');
  if (!avatar) return;

  const overlay = document.createElement('div');
  overlay.className = 'ix-noise-overlay';
  overlay.style.backgroundImage = 'url(/assets/noise/noise1.png)';
  avatar.appendChild(overlay);

  let frame = 0;
  const totalFrames = 6; // 3 full cycles of noise1/noise2
  const interval = setInterval(() => {
    frame++;
    overlay.style.backgroundImage = `url(/assets/noise/noise${(frame % 2) + 1}.png)`;
    if (frame >= totalFrames) {
      clearInterval(interval);
      overlay.remove();
    }
  }, 120);
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

// ─── Stomp damage animation ──────────────────────────────────────────────────
let _stompAnimating = false;

/** Check if stomp animation is in progress (prevents re-renders from destroying DOM). */
export function isStompAnimating() { return _stompAnimating; }

/**
 * Play goomba-stomp damage animation.
 * Moves fromId's actual .avatar-wrap to toId's position, squishes target, bounces back.
 */
export function playStompAnimation(fromId, toId, onDone) {
  if (fromId === toId) { onDone?.(); return; }

  const orbit = document.getElementById('game-player-row');
  if (!orbit) { onDone?.(); return; }

  const fromWrap = orbit.querySelector(`[data-player-id="${fromId}"]`);
  const toWrap   = orbit.querySelector(`[data-player-id="${toId}"]`);
  if (!fromWrap || !toWrap) { onDone?.(); return; }

  const fromAvatar = fromWrap.querySelector('.moop-avatar');
  const toAvatar   = toWrap.querySelector('.moop-avatar');
  if (!fromAvatar) { onDone?.(); return; }

  // Capture original position (container-relative px)
  const origLeft = parseFloat(fromWrap.style.left);
  const origTop  = parseFloat(fromWrap.style.top);
  const targLeft = parseFloat(toWrap.style.left);
  const targTop  = parseFloat(toWrap.style.top);

  const dx = targLeft - origLeft;
  const dy = targTop  - origTop;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Higher arc so attacker comes down from above the target
  const arcHeight = Math.max(180, Math.min(320, dist * 0.7));
  const returnArc = arcHeight * 0.5;

  // Phase durations (ms)
  const T1 = 100;   // windup
  const T2 = 300;   // jump arc (longer for higher arc)
  const T3 = 350;   // stomp: progressive squish down + elastic spring back
  const T4 = 220;   // bounce-back
  const P2 = T1;
  const P3 = T1 + T2;
  const P4 = T1 + T2 + T3;
  const END = T1 + T2 + T3 + T4;

  // Squish sub-phase split: how much of T3 is crushing vs springing
  const CRUSH_FRAC = 0.3;  // first 30% is pressing down
  const SPRING_FRAC = 0.7; // remaining 70% is elastic recovery

  _stompAnimating = true;
  fromWrap.style.zIndex = '50';

  const start = performance.now();

  function step(now) {
    const elapsed = now - start;

    if (elapsed < P2) {
      // Phase 1: Anticipation squash
      const t = elapsed / T1;
      const ease = t * t;
      fromAvatar.style.transform = `scaleX(${1 + 0.15 * ease}) scaleY(${1 - 0.25 * ease})`;
      fromAvatar.style.transformOrigin = 'center bottom';
      requestAnimationFrame(step);

    } else if (elapsed < P3) {
      // Phase 2: Jump arc — biased so attacker arrives from above
      const t = (elapsed - P2) / T2;
      const ease = 1 - Math.pow(1 - t, 2); // ease-out

      // Horizontal: smooth ease to target
      const px = origLeft + dx * ease;
      // Vertical: skew the arc peak earlier (t=0.35) so descent is steeper
      const arcT = Math.sin(Math.pow(t, 0.7) * Math.PI);
      const py = origTop + dy * ease - arcT * arcHeight;

      fromWrap.style.left = px + 'px';
      fromWrap.style.top  = py + 'px';

      // Stretch back to normal during flight
      const sy = 0.75 + 0.25 * t;
      const sx = 1.15 - 0.15 * t;
      const tilt = Math.sin(t * Math.PI) * 10;
      fromAvatar.style.transform = `scaleX(${sx}) scaleY(${sy}) rotate(${tilt}deg)`;
      requestAnimationFrame(step);

    } else if (elapsed < P4) {
      // Phase 3: Stomp — progressive cartoon squish then elastic spring
      const t = (elapsed - P3) / T3;

      fromWrap.style.left = targLeft + 'px';
      fromWrap.style.top  = targTop + 'px';

      if (t < CRUSH_FRAC) {
        // Sub-phase A: Crushing down — target progressively pancakes
        const ct = t / CRUSH_FRAC; // 0 -> 1 within crush
        const crushEase = 1 - Math.pow(1 - ct, 3); // ease-out for snappy impact

        // Target: squish from 1.0 down to 0.35 scaleY, widen to 1.5 scaleX
        const tSy = 1 - 0.65 * crushEase;
        const tSx = 1 + 0.5 * crushEase;
        if (toAvatar) {
          toAvatar.style.transform = `scaleX(${tSx}) scaleY(${tSy})`;
          toAvatar.style.transformOrigin = 'center bottom';
        }

        // Attacker: pancake slightly on landing
        const aSy = 1 - 0.2 * crushEase;
        const aSx = 1 + 0.15 * crushEase;
        fromAvatar.style.transform = `scaleX(${aSx}) scaleY(${aSy})`;
        fromAvatar.style.transformOrigin = 'center bottom';

      } else {
        // Sub-phase B: Elastic spring back — damped sine oscillation
        const st = (t - CRUSH_FRAC) / SPRING_FRAC; // 0 -> 1 within spring

        // Target: spring from squished (0.35) back to 1.0 with overshoot
        const spring = Math.exp(-4 * st) * Math.sin(st * Math.PI * 3);
        const tSy = 1 - 0.65 * (1 - st) * Math.exp(-3 * st) + 0.2 * spring;
        const tSx = 1 + 0.5 * (1 - st) * Math.exp(-3 * st) - 0.15 * spring;
        if (toAvatar) {
          toAvatar.style.transform = `scaleX(${Math.max(0.8, tSx)}) scaleY(${Math.max(0.35, tSy)})`;
          toAvatar.style.transformOrigin = 'center bottom';
        }

        // Attacker: recover and bounce slightly above
        const aSy = 1 - 0.2 * (1 - st) * Math.exp(-3 * st);
        const aSx = 1 + 0.15 * (1 - st) * Math.exp(-3 * st);
        fromAvatar.style.transform = `scaleX(${aSx}) scaleY(${aSy})`;
        fromAvatar.style.transformOrigin = 'center bottom';

        // Bounce attacker upward as target springs back
        const bounce = Math.abs(spring) * 15;
        fromWrap.style.top = (targTop - bounce) + 'px';
      }

      requestAnimationFrame(step);

    } else if (elapsed < END) {
      // Phase 4: Bounce back to seat
      const t = (elapsed - P4) / T4;
      const ease = t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const px = targLeft + (origLeft - targLeft) * ease;
      const py = targTop  + (origTop  - targTop)  * ease;
      const arc = -Math.sin(t * Math.PI) * returnArc;

      fromWrap.style.left = px + 'px';
      fromWrap.style.top  = (py + arc) + 'px';
      fromAvatar.style.transform = '';
      fromAvatar.style.transformOrigin = '';

      requestAnimationFrame(step);

    } else {
      // Done — restore everything
      fromWrap.style.left = origLeft + 'px';
      fromWrap.style.top  = origTop  + 'px';
      fromWrap.style.zIndex = '';
      fromAvatar.style.transform = '';
      fromAvatar.style.transformOrigin = '';
      if (toAvatar) {
        toAvatar.style.transform = '';
        toAvatar.style.transformOrigin = '';
      }
      _stompAnimating = false;
      onDone?.();
    }
  }

  requestAnimationFrame(step);
}

// ─── Visibility ───────────────────────────────────────────────────────────────
export function showInteractionTrigger(visible) {
  document.getElementById('interaction-trigger')?.classList.toggle('hidden', !visible);
  if (!visible) closeMenu();
}
