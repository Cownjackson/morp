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
  speechBubbles: {},    // pid -> { text, skipped } (endgame ghost hints)
  hintThumbnails: {},   // pid -> hint data; persists for rest of hint/voting phase
  selectedVotes: [], numVotes: 1,
  _accusedMorpIds: [],
  isGhost: false, endgameTargetWord: null,
  drawingHints: false,
  avatarInteraction: null,   // null | 'vote' | 'damage'
  damageTarget: null,        // pid selected for damage
  _morpIdsForDamage: [],     // morp ids during damage phase
  boardSelectionMode: false, // true when morp can click board words to guess
  boardWordSelected: null,   // word string currently selected for morp guess
};

export function send(msg) { state.ws.send(JSON.stringify(msg)); }
