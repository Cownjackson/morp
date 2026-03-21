// ─── Modal wiring ─────────────────────────────────────────────────────────────
export function initModals() {
  const openModal = (overlay) => overlay?.classList.add('open');
  const closeModal = (overlay) => overlay?.classList.remove('open');
  const bindModal = ({ overlayId, openButtonIds, closeButtonId }) => {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return null;

    openButtonIds.forEach((buttonId) => {
      document.getElementById(buttonId)?.addEventListener('click', () => openModal(overlay));
    });

    document.getElementById(closeButtonId)?.addEventListener('click', () => closeModal(overlay));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeModal(overlay);
    });

    return overlay;
  };

  // Changelog modal
  bindModal({
    overlayId: 'changelog-overlay',
    openButtonIds: ['changelog-btn', 'pregame-changelog-btn', 'changelog-btn-footer'],
    closeButtonId: 'changelog-close'
  });

  // Help modal
  bindModal({
    overlayId: 'help-overlay',
    openButtonIds: ['help-btn', 'pregame-help-btn', 'help-btn-footer'],
    closeButtonId: 'help-close'
  });

  // Pregame active players modal
  bindModal({
    overlayId: 'pregame-players-overlay',
    openButtonIds: ['pregame-players-btn'],
    closeButtonId: 'pregame-players-close'
  });

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
