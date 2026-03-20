// ─── Entry point ──────────────────────────────────────────────────────────────
import { showLanding } from './helpers.js';
import { toggleLog } from './helpers.js';
import { getCosmetics, initMoopCustomizer } from './cosmetics.js';
import { buildMoopSprite } from './moop-sprite.js';
import { initModals } from './modals.js';
import { initMusic } from './music.js';
import { initCanvas, clearCanvas, undoStroke, setDrawColor, setDrawSize, toggleEraser, toggleFill } from './drawing.js';
import { createLobby, joinLobby, setCustomBoards, copyBoardTemplate } from './lobby.js';
import { startGame, submitHint, submitVotes, submitMorpGuess, submitEndgameGhostHint, submitEndgameGuess, resetToLobby, sendChat } from './actions.js';
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
window.sendChat = sendChat;
window.toggleInteractionMenu = toggleInteractionMenu;
window.setDrawColor = setDrawColor;
window.setDrawSize = setDrawSize;
window.toggleEraser = toggleEraser;
window.toggleFill = toggleFill;
window.undoStroke = undoStroke;
window.clearCanvas = clearCanvas;

function initPregameInfoToggles() {
  const waitingLabel = document.getElementById('pregame-lobby-waiting');
  if (waitingLabel) waitingLabel.textContent = 'Waiting for players...';

  const optionsMenu = document.getElementById('pregame-options-menu');
  const optionsBtn = document.getElementById('pregame-options-btn');
  const optionsPanel = document.getElementById('pregame-options-panel');
  if (optionsMenu && optionsBtn && optionsPanel) {
    const closeOptionsMenu = () => {
      optionsMenu.classList.remove('is-open');
      optionsPanel.classList.add('hidden');
      optionsBtn.setAttribute('aria-expanded', 'false');
    };

    optionsBtn.setAttribute('aria-haspopup', 'true');
    optionsBtn.setAttribute('aria-expanded', 'false');
    optionsBtn.setAttribute('aria-controls', 'pregame-options-panel');

    optionsBtn.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = optionsMenu.classList.toggle('is-open');
      optionsPanel.classList.toggle('hidden', !isOpen);
      optionsBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    optionsPanel.addEventListener('click', e => {
      e.stopPropagation();
    });

    document.addEventListener('click', e => {
      if (optionsMenu.contains(e.target)) return;
      closeOptionsMenu();
    });
  }
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

let backgroundPrototypeSyncToken = 0;

async function syncBackgroundPrototypePlayer() {
  const nameInput = document.getElementById('player-name');
  const cosmetics = getCosmetics();
  const syncToken = ++backgroundPrototypeSyncToken;
  let spriteSrc = null;

  try {
    const sprite = await buildMoopSprite(cosmetics);
    if (syncToken !== backgroundPrototypeSyncToken) return;
    spriteSrc = sprite.src;
  } catch (error) {
    if (syncToken !== backgroundPrototypeSyncToken) return;
    console.warn('Failed to build background prototype sprite.', error);
  }

  const prototypePlayerData = {
    name: nameInput?.value.trim() || 'you',
    cosmetics,
    spriteSrc
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
