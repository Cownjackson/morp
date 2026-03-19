// ─── Entry point ──────────────────────────────────────────────────────────────
import { showLanding } from './helpers.js';
import { toggleLog } from './helpers.js';
import { initMoopCustomizer } from './cosmetics.js';
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

// ─── Init ──────────────────────────────────────────────────────────────────────

// Default the server URL to wherever this page was served from
document.getElementById('server-url').value =
  (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host;

initModals();
initMusic();
initInteractions();
initCanvas('hint-canvas',         'hint');
initCanvas('endgame-ghost-canvas', 'endgame');

// Start in landing mode
showLanding(true);
initMoopCustomizer();

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
