// ─── Game state ───────────────────────────────────────────────────────────────
export const state = {
  ws: null,
  lobbyId: null, playerId: null, playerName: null,
  isHost: false, hostId: null,
  role: null, halfBoard: null,
  targetWord: null, board: null,
  turnOrder: [], hints: [],
  players: {},          // pid -> player object
  speechBubbles: {},    // pid -> { text, skipped }
  selectedVotes: [], numVotes: 1,
  _accusedMorpIds: [],
  isGhost: false, endgameTargetWord: null,
  drawingHints: false,
};

export function send(msg) { state.ws.send(JSON.stringify(msg)); }
