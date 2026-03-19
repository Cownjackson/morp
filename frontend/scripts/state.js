// ─── Game state ───────────────────────────────────────────────────────────────
export const state = {
  ws: null,
  screen: 'landing',
  lobbyId: null, playerId: null, playerName: null,
  lobbyStarted: false,
  isHost: false, hostId: null,
  role: null, halfBoard: null,
  targetWord: null, board: null,
  turnOrder: [], hints: [],
  players: {},          // pid -> player object
  chatMessages: [],
  speechBubbles: {},    // pid -> { text, skipped }
  selectedVotes: [], numVotes: 1,
  _accusedMorpIds: [],
  isGhost: false, endgameTargetWord: null,
  drawingHints: false,
};

export function send(msg) { state.ws.send(JSON.stringify(msg)); }
