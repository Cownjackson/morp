// ─── Timers ───────────────────────────────────────────────────────────────────
export const _timers = {};

export function startTimer(elId, deadline, onExpire) {
  clearTimer(elId);
  const el = document.getElementById(elId);
  _timers[elId] = setInterval(() => {
    const remaining = Math.max(0, Math.ceil(deadline - Date.now() / 1000));
    el.textContent = remaining;
    if (remaining <= 0) { clearTimer(elId); onExpire?.(); }
  }, 250);
}

export function clearTimer(elId) {
  if (_timers[elId]) { clearInterval(_timers[elId]); delete _timers[elId]; }
}
