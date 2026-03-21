// ─── Entry point ──────────────────────────────────────────────────────────────
import { showLanding } from './helpers.js';
import { toggleLog } from './helpers.js';
import { getCosmetics, initMoopCustomizer } from './cosmetics.js';
import { buildMoopSprite } from './moop-sprite.js';
import { initModals } from './modals.js';
import { initMusic } from './music.js';
import { initCanvas, clearCanvas, undoStroke, setDrawColor, setDrawSize, toggleEraser, toggleFill } from './drawing.js';
import { createLobby, joinLobby, setCustomBoards, copyBoardTemplate } from './lobby.js';
import { startGame, submitHint, submitVotes, submitMorpGuess, submitEndgameGhostHint, submitEndgameGuess, resetToLobby, leaveLobby, sendChat } from './actions.js';
import { confirmDamage } from './rendering.js';
import { initInteractions, toggleInteractionMenu } from './interactions.js';

// ─── Expose functions for HTML onclick attributes ─────────────────────────────
window.createLobby = createLobby;
window.joinLobby = joinLobby;
window.toggleLog = toggleLog;
window.setCustomBoards = setCustomBoards;
window.copyBoardTemplate = copyBoardTemplate;
window.startGame = startGame;
window.submitHint = submitHint;
window.submitVotes = submitVotes;
window.submitMorpGuess = submitMorpGuess;
window.submitEndgameGhostHint = submitEndgameGhostHint;
window.submitEndgameGuess = submitEndgameGuess;
window.resetToLobby = resetToLobby;
window.leaveLobby = leaveLobby;
window.sendChat = sendChat;
window.toggleInteractionMenu = toggleInteractionMenu;
window.confirmDamage = confirmDamage;
window.setDrawColor = setDrawColor;
window.setDrawSize = setDrawSize;
window.toggleEraser = toggleEraser;
window.toggleFill = toggleFill;
window.undoStroke = undoStroke;
window.clearCanvas = clearCanvas;

function initPregameInfoToggles() {
  const waitingLabel = document.getElementById('pregame-lobby-waiting');
  if (waitingLabel) waitingLabel.textContent = 'Waiting for players...';
  const pregamePhaseLabel = document.getElementById('pregame-phase-label');
  if (pregamePhaseLabel && !pregamePhaseLabel.textContent.trim()) {
    pregamePhaseLabel.textContent = 'WAITING';
  }

  const menuConfigs = [
    {
      menu: document.getElementById('pregame-options-menu'),
      button: document.getElementById('pregame-options-btn'),
      panel: document.getElementById('pregame-options-panel')
    },
    {
      menu: document.getElementById('pregame-boards-menu'),
      button: document.getElementById('pregame-boards-btn'),
      panel: document.getElementById('pregame-boards-panel')
    }
  ].filter(config => config.menu && config.button && config.panel);

  if (!menuConfigs.length) return;

  const closeMenu = ({ menu, button, panel }) => {
    menu.classList.remove('is-open');
    panel.classList.add('hidden');
    button.setAttribute('aria-expanded', 'false');
  };

  const closeAllMenus = (exceptMenu = null) => {
    menuConfigs.forEach(config => {
      if (config.menu === exceptMenu) return;
      closeMenu(config);
    });
  };

  menuConfigs.forEach(({ menu, button, panel }) => {
    button.setAttribute('aria-haspopup', 'true');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', panel.id);

    button.addEventListener('click', e => {
      e.stopPropagation();
      const willOpen = !menu.classList.contains('is-open');
      closeAllMenus(menu);
      menu.classList.toggle('is-open', willOpen);
      panel.classList.toggle('hidden', !willOpen);
      button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });

    panel.addEventListener('click', e => {
      e.stopPropagation();
    });
  });

  document.addEventListener('click', e => {
    if (menuConfigs.some(({ menu }) => menu.contains(e.target))) return;
    closeAllMenus();
  });
}

function initChatPanel() {
  const wrap = document.getElementById('chat-wrap');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('btn-chat-send');
  if (!wrap || !input || !sendBtn) return;

  const syncDraftState = () => {
    wrap.classList.toggle('chat-has-draft', !!input.value.trim());
  };

  wrap.addEventListener('click', e => {
    if (e.target === sendBtn) return;
    if (e.target !== input) {
      requestAnimationFrame(() => input.focus());
    }
  });

  input.addEventListener('input', syncDraftState);
  input.addEventListener('blur', syncDraftState);
  sendBtn.addEventListener('blur', syncDraftState);

  syncDraftState();
}

function initLandingNameAutosize() {
  const input = document.getElementById('player-name');
  if (!input || input.dataset.autosizeInit === 'true') return;
  input.dataset.autosizeInit = 'true';

  const field = input.closest('.connect-field');
  let measure = document.getElementById('landing-name-measure');
  if (!measure) {
    measure = document.createElement('span');
    measure.id = 'landing-name-measure';
    measure.setAttribute('aria-hidden', 'true');
    measure.style.position = 'absolute';
    measure.style.visibility = 'hidden';
    measure.style.whiteSpace = 'pre';
    measure.style.pointerEvents = 'none';
    measure.style.left = '-9999px';
    measure.style.top = '0';
    document.body.appendChild(measure);
  }

  const syncWidth = () => {
    const styles = window.getComputedStyle(input);
    measure.style.font = styles.font;
    measure.style.letterSpacing = styles.letterSpacing;
    measure.textContent = input.value || input.placeholder || '';

    const horizontalPadding =
      parseFloat(styles.paddingLeft) +
      parseFloat(styles.paddingRight) +
      parseFloat(styles.borderLeftWidth) +
      parseFloat(styles.borderRightWidth) +
      18;
    const minWidth = window.innerWidth <= 430 ? 176 : 188;
    const defaultMaxWidth = window.innerWidth <= 430 ? 320 : 352;
    const fieldWidth = field?.clientWidth || input.parentElement?.clientWidth || defaultMaxWidth;
    const maxWidth = Math.min(fieldWidth, defaultMaxWidth);
    const contentWidth = Math.ceil(measure.getBoundingClientRect().width + horizontalPadding);
    const width = Math.max(minWidth, Math.min(maxWidth, contentWidth));
    input.style.width = `${width}px`;
  };

  input.addEventListener('input', syncWidth);
  window.addEventListener('resize', syncWidth);
  if (typeof ResizeObserver === 'function' && field) {
    const resizeObserver = new ResizeObserver(syncWidth);
    resizeObserver.observe(field);
    input._landingAutosizeObserver = resizeObserver;
  }
  if (document.fonts?.ready) {
    document.fonts.ready.then(syncWidth).catch(() => {});
  }
  syncWidth();
}

let backgroundPrototypeSyncToken = 0;

async function syncBackgroundPrototypePlayer() {
  const nameInput = document.getElementById('player-name');
  const cosmetics = getCosmetics();
  const syncToken = ++backgroundPrototypeSyncToken;
  let spriteSrc = null;
  let spriteBounds = null;

  try {
    const sprite = await buildMoopSprite(cosmetics);
    if (syncToken !== backgroundPrototypeSyncToken) return;
    spriteSrc = sprite.src;
    spriteBounds = sprite.bounds || null;
  } catch (error) {
    if (syncToken !== backgroundPrototypeSyncToken) return;
    console.warn('Failed to build background prototype sprite.', error);
  }

  const prototypePlayerData = {
    name: nameInput?.value.trim() || 'you',
    cosmetics,
    spriteSrc,
    spriteBounds
  };

  window.backgroundPrototypePlayerData = prototypePlayerData;
  window.dispatchEvent(new CustomEvent('background-prototype-player-change', {
    detail: prototypePlayerData
  }));

  if (typeof window.setBackgroundPrototypePlayer === 'function') {
    window.setBackgroundPrototypePlayer(prototypePlayerData);
  }
}

// ─── Init ──────────────────────────────────────────────────────────────────────

// Default the server URL to wherever this page was served from
document.getElementById('server-url').value =
  (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host;

initModals();
initMusic();
initInteractions();
initCanvas('hint-canvas',         'hint');
initCanvas('endgame-ghost-canvas', 'endgame');
initPregameInfoToggles();
initChatPanel();
syncBackgroundPrototypePlayer();

// Start in landing mode
showLanding(true);
initMoopCustomizer();
initLandingNameAutosize();
syncBackgroundPrototypePlayer();

const playerNameInput = document.getElementById('player-name');
if (playerNameInput) {
  playerNameInput.addEventListener('input', syncBackgroundPrototypePlayer);
}
window.addEventListener('moop-cosmetics-changed', syncBackgroundPrototypePlayer);

// ─── Enter key shortcuts ──────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const id = document.activeElement.id;
  if (id === 'hint-input')               submitHint();
  if (id === 'guess-input')              submitMorpGuess();
  if (id === 'endgame-ghost-hint-input') submitEndgameGhostHint();
  if (id === 'endgame-guess-input')      submitEndgameGuess();
  if (id === 'join-code')                joinLobby();
  if (id === 'chat-input')               sendChat();
});
