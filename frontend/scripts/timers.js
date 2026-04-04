// ─── Timers ───────────────────────────────────────────────────────────────────
export const _timers = {};

export function startTimer(elId, deadline, onExpire, mirrorIds = []) {
  clearTimer(elId);
  const el = document.getElementById(elId);
  const mirrors = mirrorIds
    .map(id => document.getElementById(id))
    .filter(Boolean);
  _timers[elId] = setInterval(() => {
    const remaining = Math.max(0, Math.ceil(deadline - Date.now() / 1000));
    el.textContent = remaining;
    for (const mirror of mirrors) mirror.textContent = remaining;
    if (remaining <= 0) { clearTimer(elId); onExpire?.(); }
  }, 250);
}

export function clearTimer(elId) {
  if (_timers[elId]) { clearInterval(_timers[elId]); delete _timers[elId]; }
}
