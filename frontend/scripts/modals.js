// ─── Modal wiring ─────────────────────────────────────────────────────────────
export function initModals() {
  // Changelog modal
  const changelog = document.getElementById('changelog-overlay');
  document.getElementById('changelog-btn').addEventListener('click', () => changelog.classList.add('open'));
  document.getElementById('changelog-btn-footer').addEventListener('click', () => changelog.classList.add('open'));
  document.getElementById('changelog-close').addEventListener('click', () => changelog.classList.remove('open'));
  changelog.addEventListener('click', e => { if (e.target === changelog) changelog.classList.remove('open'); });

  // Help modal
  const help = document.getElementById('help-overlay');
  document.getElementById('help-btn').addEventListener('click', () => help.classList.add('open'));
  document.getElementById('help-btn-footer').addEventListener('click', () => help.classList.add('open'));
  document.getElementById('help-close').addEventListener('click', () => help.classList.remove('open'));
  help.addEventListener('click', e => { if (e.target === help) help.classList.remove('open'); });

  // Credits modal
  const credits = document.getElementById('credits-overlay');
  document.getElementById('credits-btn').addEventListener('click', () => credits.classList.add('open'));
  document.getElementById('credits-close').addEventListener('click', () => credits.classList.remove('open'));
  credits.addEventListener('click', e => { if (e.target === credits) credits.classList.remove('open'); });

  // Maintenance modal
  document.getElementById('maintenance-ok').addEventListener('click', () => {
    document.getElementById('maintenance-overlay').classList.remove('open');
  });
}
