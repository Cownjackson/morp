// ─── Modal wiring ─────────────────────────────────────────────────────────────
export function initModals() {
  const openModal = (overlay) => overlay?.classList.add('open');
  const closeModal = (overlay) => overlay?.classList.remove('open');
  const bindOpenButton = (buttonId, overlay) => {
    document.getElementById(buttonId)?.addEventListener('click', () => openModal(overlay));
  };

  // Changelog modal
  const changelog = document.getElementById('changelog-overlay');
  bindOpenButton('changelog-btn', changelog);
  bindOpenButton('pregame-changelog-btn', changelog);
  bindOpenButton('changelog-btn-footer', changelog);
  document.getElementById('changelog-close').addEventListener('click', () => closeModal(changelog));
  changelog.addEventListener('click', e => { if (e.target === changelog) closeModal(changelog); });

  // Help modal
  const help = document.getElementById('help-overlay');
  bindOpenButton('help-btn', help);
  bindOpenButton('pregame-help-btn', help);
  bindOpenButton('help-btn-footer', help);
  document.getElementById('help-close').addEventListener('click', () => closeModal(help));
  help.addEventListener('click', e => { if (e.target === help) closeModal(help); });

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
