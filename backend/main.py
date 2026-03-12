import secrets
import string

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.connection_manager import ConnectionManager
from backend.game.engine import GameEngine
from backend.models.game import GamePhase
from backend.models.player import Role

app = FastAPI()

# Allow requests from any origin during development (file://, localhost variants, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
manager = ConnectionManager()

# In-memory store: lobby_id -> GameEngine
_engines: dict[str, GameEngine] = {}


# --- Helpers ---

def _lobby_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(6))


def _round_seed() -> int:
    return secrets.randbits(31)


def _get_engine(lobby_id: str) -> GameEngine:
    engine = _engines.get(lobby_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Lobby not found.")
    return engine


# --- REST endpoints ---

class JoinRequest(BaseModel):
    name: str


@app.post("/lobby/create")
async def create_lobby():
    lobby_id = _lobby_code()
    while lobby_id in _engines:
        lobby_id = _lobby_code()
    _engines[lobby_id] = GameEngine(lobby_id=lobby_id)
    return {"lobby_id": lobby_id}


@app.post("/lobby/{lobby_id}/join")
async def join_lobby(lobby_id: str, body: JoinRequest):
    engine = _get_engine(lobby_id)
    player_id = secrets.token_hex(8)
    engine.add_player(player_id, body.name)
    return {"player_id": player_id}


@app.get("/lobby/{lobby_id}")
async def get_lobby(lobby_id: str):
    engine = _get_engine(lobby_id)
    players = [
        {"id": p.id, "name": p.name, "hp": p.hp, "is_ghost": p.is_ghost}
        for p in engine.lobby.players.values()
    ]
    return {"lobby_id": lobby_id, "players": players, "started": engine.lobby.started}


# --- WebSocket endpoint ---

@app.websocket("/ws/{lobby_id}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, lobby_id: str, player_id: str):
    engine = _engines.get(lobby_id)
    if not engine or player_id not in engine.lobby.players:
        await websocket.close(code=4004)
        return

    await websocket.accept()
    manager.connect(lobby_id, player_id, websocket)

    await manager.broadcast(lobby_id, _lobby_update(engine))

    try:
        while True:
            data = await websocket.receive_json()
            await _handle_message(lobby_id, player_id, data, engine)
    except WebSocketDisconnect:
        phase_before = engine.state.phase
        manager.disconnect(lobby_id, player_id)
        engine.on_player_disconnect(player_id)

        if engine.all_disconnected():
            _engines.pop(lobby_id, None)
            return

        await manager.broadcast(lobby_id, _lobby_update(engine))
        phase_after = engine.state.phase

        # Broadcast any phase transitions that the disconnect triggered
        if phase_before == GamePhase.HINT and phase_after == GamePhase.VOTING:
            rs = engine.state.round_state
            await manager.broadcast(lobby_id, {
                "type": "voting_open",
                "hints": [{"player_id": h.player_id, "text": h.text} for h in rs.hints],
                "num_votes": engine.lobby.config.num_morps,
            })
        elif phase_before == GamePhase.VOTING and phase_after == GamePhase.ACCUSATION:
            await _handle_accusation(lobby_id, engine)


# --- Message handler ---

async def _handle_message(lobby_id: str, player_id: str, data: dict, engine: GameEngine):
    msg_type = data.get("type")

    try:
        if msg_type == "start_game":
            await _handle_start_game(lobby_id, player_id, engine)

        elif msg_type == "submit_hint":
            engine.submit_hint(player_id, data.get("text", ""))
            await manager.broadcast(lobby_id, {
                "type": "hint_received",
                "player_id": player_id,
                "text": data.get("text", ""),
            })
            if engine.state.phase == GamePhase.VOTING:
                rs = engine.state.round_state
                await manager.broadcast(lobby_id, {
                    "type": "voting_open",
                    "hints": [{"player_id": h.player_id, "text": h.text} for h in rs.hints],
                    "num_votes": engine.lobby.config.num_morps,
                })

        elif msg_type == "submit_votes":
            engine.submit_votes(player_id, data.get("accused_ids", []))
            if engine.state.phase == GamePhase.ACCUSATION:
                await _handle_accusation(lobby_id, engine)

        elif msg_type == "submit_morp_guess":
            rs = engine.state.round_state
            correct = engine.submit_morp_guess(player_id, data.get("guess", ""))
            await manager.broadcast(lobby_id, {
                "type": "morp_guess_result",
                "morp_id": player_id,
                "correct": correct,
                "target_word": rs.target_word,
            })
            await _check_postgame(lobby_id, engine)

        elif msg_type == "morp_deal_damage":
            engine.morp_deal_damage(player_id, data["target_id"])
            target = engine.lobby.players[data["target_id"]]
            await manager.broadcast(lobby_id, {
                "type": "damage_dealt",
                "from_id": player_id,
                "to_id": data["target_id"],
                "hp_remaining": target.hp,
                "eliminated": target.is_ghost,
            })
            await _check_postgame(lobby_id, engine)

        else:
            await manager.send(lobby_id, player_id, {"type": "error", "message": f"Unknown message type: {msg_type}"})

    except ValueError as e:
        await manager.send(lobby_id, player_id, {"type": "error", "message": str(e)})


async def _handle_start_game(lobby_id: str, player_id: str, engine: GameEngine):
    if player_id != engine.lobby.host_id:
        raise ValueError("Only the host can start the game.")
    seed = _round_seed()
    engine.start_game(seed=seed)
    await _broadcast_round_start(lobby_id, engine, seed)


async def _broadcast_round_start(lobby_id: str, engine: GameEngine, seed: int):
    rs = engine.state.round_state

    # Send each player their role privately (morp gets half-board if going first)
    for player in engine.lobby.active_players():
        role_msg: dict = {"type": "role_assigned", "role": player.role.value}
        if player.role == Role.MORP:
            half = engine.get_half_board_for_morp(seed=seed)
            role_msg["half_board"] = half  # None if not first
        await manager.send(lobby_id, player.id, role_msg)

    # Broadcast round_start — target_word omitted for all (sent privately above),
    # but safe players need it to highlight the board
    for player in engine.lobby.active_players():
        round_msg = {
            "type": "round_start",
            "round_number": rs.round_number,
            "board_hint": rs.board.board_hint,
            "words": rs.board.words,
            "turn_order": rs.turn_order,
        }
        if player.role == Role.SAFE:
            round_msg["target_word"] = rs.target_word
        await manager.send(lobby_id, player.id, round_msg)


async def _handle_accusation(lobby_id: str, engine: GameEngine):
    rs = engine.state.round_state
    player_roles = {p.id: p.role.value for p in engine.lobby.players.values()}

    await manager.broadcast(lobby_id, {
        "type": "accusation_result",
        "accused_ids": rs.accused_ids,
        "roles_revealed": {pid: player_roles[pid] for pid in rs.accused_ids},
    })

    result = engine.resolve_accusation()

    if result["morp_must_guess"]:
        import time
        deadline = time.time() + 30
        engine.state.morp_guess_deadline = deadline
        await manager.broadcast(lobby_id, {
            "type": "morp_guess_phase",
            "accused_morp_ids": result["accused_morps"],
            "deadline": deadline,
        })
    else:
        morp_ids = [p.id for p in engine.lobby.players.values() if p.role == Role.MORP]
        await manager.broadcast(lobby_id, {
            "type": "damage_phase",
            "morp_ids": morp_ids,
        })


async def _check_postgame(lobby_id: str, engine: GameEngine):
    phase = engine.state.phase
    if phase == GamePhase.GAME_OVER:
        winner = next(
            (p for p in engine.lobby.players.values() if p.is_active()), None
        )
        await manager.broadcast(lobby_id, {
            "type": "game_over",
            "winner_id": winner.id if winner else None,
            "winner_name": winner.name if winner else None,
        })
    elif phase == GamePhase.ENDGAME_2P:
        await manager.broadcast(lobby_id, {
            "type": "endgame_2p",
            "active_player_ids": [p.id for p in engine.lobby.active_players()],
        })


# --- Broadcast helpers ---

def _lobby_update(engine: GameEngine) -> dict:
    return {
        "type": "lobby_update",
        "host_id": engine.lobby.host_id,
        "started": engine.lobby.started,
        "players": [
            {
                "id": p.id,
                "name": p.name,
                "hp": p.hp,
                "is_ghost": p.is_ghost,
                "is_connected": p.is_connected,
            }
            for p in engine.lobby.players.values()
        ],
    }
