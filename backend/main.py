import asyncio
import pathlib
import secrets
import string
import time

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

_FRONTEND = pathlib.Path(__file__).parent.parent / "frontend" / "index.html"

from backend.connection_manager import ConnectionManager
from backend.game.engine import GameEngine
from backend.models.game import GamePhase
from backend.models.player import Role

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()
_engines: dict[str, GameEngine] = {}
_timer_tasks: dict[str, asyncio.Task] = {}  # lobby_id -> active timer task

_TIMER_SECONDS = 30  # duration for morp-guess and endgame-guess timers


# ── Helpers ───────────────────────────────────────────────────────────────────

def _lobby_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(6))


def _new_seed() -> int:
    return secrets.randbits(31)


def _get_engine(lobby_id: str) -> GameEngine:
    engine = _engines.get(lobby_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Lobby not found.")
    return engine


def _cancel_timer(lobby_id: str) -> None:
    task = _timer_tasks.pop(lobby_id, None)
    if task:
        task.cancel()


# ── Frontend ──────────────────────────────────────────────────────────────────

@app.get("/")
async def serve_frontend():
    return FileResponse(_FRONTEND)


# ── REST endpoints ────────────────────────────────────────────────────────────

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
    # Reconnection: find a disconnected player with the same name
    existing = engine.find_disconnected_by_name(body.name)
    if existing:
        # Don't mark connected yet — wait for WebSocket to actually establish
        return {"player_id": existing.id}
    # Block new players from joining an active game, but allow joins after game over
    if engine.lobby.started and engine.state.phase != GamePhase.GAME_OVER:
        raise HTTPException(status_code=403, detail="Game already in progress.")
    # New player — reject if name is already taken
    player_id = secrets.token_hex(8)
    try:
        engine.add_player(player_id, body.name)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    # Mark not connected until the WebSocket handshake completes
    engine.lobby.players[player_id].is_connected = False
    return {"player_id": player_id}


@app.get("/lobby/{lobby_id}")
async def get_lobby(lobby_id: str):
    engine = _get_engine(lobby_id)
    players = [
        {"id": p.id, "name": p.name, "hp": p.hp, "is_ghost": p.is_ghost}
        for p in engine.lobby.players.values()
    ]
    return {"lobby_id": lobby_id, "players": players, "started": engine.lobby.started}


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@app.websocket("/ws/{lobby_id}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, lobby_id: str, player_id: str):
    engine = _engines.get(lobby_id)
    if not engine or player_id not in engine.lobby.players:
        await websocket.close(code=4004)
        return

    await websocket.accept()
    engine.reconnect_player(player_id)   # marks is_connected=True, reassigns host if needed
    manager.connect(lobby_id, player_id, websocket)
    await manager.broadcast(lobby_id, _lobby_update(engine))

    # If a round is in progress, restore enough context for the reconnecting player to act
    _phase = engine.state.phase
    if _phase == GamePhase.HINT:
        await _send_hint_phase_rejoin(lobby_id, player_id, engine)
    elif _phase == GamePhase.VOTING:
        await _send_hint_phase_rejoin(lobby_id, player_id, engine)
        rs = engine.state.round_state
        await manager.send(lobby_id, player_id, {
            "type": "voting_open",
            "hints": [{"player_id": h.player_id, "text": h.text} for h in rs.hints],
            "num_votes": engine.lobby.config.num_morps,
        })
    elif _phase == GamePhase.MORP_GUESS:
        await _send_hint_phase_rejoin(lobby_id, player_id, engine)
        rs = engine.state.round_state
        player_roles = {p.id: p.role.value for p in engine.lobby.players.values() if p.role is not None}
        await manager.send(lobby_id, player_id, {
            "type": "accusation_result",
            "accused_ids": rs.accused_ids,
            "roles_revealed": {pid: player_roles.get(pid, "unknown") for pid in rs.accused_ids},
        })
        accused_morps = [pid for pid in rs.accused_ids if engine.lobby.players[pid].role == Role.MORP]
        await manager.send(lobby_id, player_id, {
            "type": "morp_guess_phase",
            "accused_morp_ids": accused_morps,
            "deadline": engine.state.morp_guess_deadline,
            "timers_enabled": engine.lobby.config.timers_enabled,
        })

    try:
        while True:
            data = await websocket.receive_json()
            await _handle_message(lobby_id, player_id, data, engine)
    except WebSocketDisconnect:
        phase_before = engine.state.phase
        rs = engine.state.round_state
        hints_before = len(rs.hints) if rs and phase_before == GamePhase.HINT else 0

        manager.disconnect(lobby_id, player_id)
        engine.on_player_disconnect(player_id)

        if engine.all_disconnected():
            _cancel_timer(lobby_id)
            _engines.pop(lobby_id, None)
            return

        await manager.broadcast(lobby_id, _lobby_update(engine))
        phase_after = engine.state.phase

        # Broadcast hint_received for every hint that was auto-skipped on disconnect
        if phase_before == GamePhase.HINT and rs:
            for h in rs.hints[hints_before:]:
                await manager.broadcast(lobby_id, {
                    "type": "hint_received",
                    "player_id": h.player_id,
                    "text": h.text,
                })

        if phase_before == GamePhase.HINT and phase_after == GamePhase.VOTING:
            await _broadcast_voting_open(lobby_id, engine)
        elif phase_before == GamePhase.VOTING and phase_after == GamePhase.ACCUSATION:
            await _handle_accusation(lobby_id, engine)


# ── Hint-phase rejoin ─────────────────────────────────────────────────────────

async def _send_hint_phase_rejoin(lobby_id: str, player_id: str, engine: GameEngine):
    """Re-send round context to a player who reconnected during the hint phase."""
    rs = engine.state.round_state
    player = engine.lobby.players[player_id]
    if rs is None or player.role is None:
        return  # not a participant this round — nothing to restore

    seed = engine._round_seed
    role_msg: dict = {"type": "role_assigned", "role": player.role.value}
    if player.role == Role.MORP:
        role_msg["half_board"] = engine.get_half_board_for_morp(seed=seed)
    await manager.send(lobby_id, player_id, role_msg)

    round_msg: dict = {
        "type": "round_start",
        "round_number": rs.round_number,
        "board_hint": rs.board.board_hint,
        "words": rs.board.words,
        "turn_order": rs.turn_order,
    }
    if player.role == Role.SAFE:
        round_msg["target_word"] = rs.target_word
    await manager.send(lobby_id, player_id, round_msg)

    # Replay hints already submitted so speech bubbles are up to date
    for h in rs.hints:
        await manager.send(lobby_id, player_id, {
            "type": "hint_received",
            "player_id": h.player_id,
            "text": h.text,
        })


# ── Message handler ───────────────────────────────────────────────────────────

async def _handle_message(lobby_id: str, player_id: str, data: dict, engine: GameEngine):
    msg_type = data.get("type")

    try:
        if msg_type == "start_game":
            timers = data.get("timers_enabled", True)
            engine.lobby.config.timers_enabled = timers
            await _handle_start_game(lobby_id, player_id, engine)

        elif msg_type == "next_round":
            if player_id != engine.lobby.host_id:
                raise ValueError("Only the host can start the next round.")
            if engine.state.phase == GamePhase.ROUND_END:
                seed = _new_seed()
                engine.start_new_round(seed=seed)
                await manager.broadcast(lobby_id, _lobby_update(engine))
                await _broadcast_round_start(lobby_id, engine, seed)
            elif engine.state.phase == GamePhase.ENDGAME_ROUND_END:
                seed = _new_seed()
                engine.start_next_endgame_round(seed=seed)
                await _broadcast_endgame_round_start(lobby_id, engine)
            else:
                raise ValueError("Not waiting to start a new round.")

        elif msg_type == "submit_hint":
            engine.submit_hint(player_id, data.get("text", ""))
            stored_text = engine.state.round_state.hints[-1].text
            await manager.broadcast(lobby_id, {
                "type": "hint_received",
                "player_id": player_id,
                "text": stored_text,
            })
            if engine.state.phase == GamePhase.VOTING:
                await _broadcast_voting_open(lobby_id, engine)

        elif msg_type == "submit_votes":
            engine.submit_votes(player_id, data.get("accused_ids", []))
            if engine.state.phase == GamePhase.ACCUSATION:
                await _handle_accusation(lobby_id, engine)

        elif msg_type == "submit_morp_guess":
            _cancel_timer(lobby_id)
            rs = engine.state.round_state
            correct = engine.submit_morp_guess(player_id, data.get("guess", ""))
            await manager.broadcast(lobby_id, {
                "type": "morp_guess_result",
                "morp_id": player_id,
                "correct": correct,
                "target_word": rs.target_word,
            })
            await manager.broadcast(lobby_id, _lobby_update(engine))
            await _check_round_end(lobby_id, engine)

        elif msg_type == "morp_deal_damage":
            target_id = data.get("target_id")
            if not target_id:
                raise ValueError("Missing target_id.")
            all_done = engine.morp_deal_damage(player_id, target_id)
            target = engine.lobby.players[data["target_id"]]
            await manager.broadcast(lobby_id, {
                "type": "damage_dealt",
                "from_id": player_id,
                "to_id": data["target_id"],
                "hp_remaining": target.hp,
                "eliminated": target.is_ghost,
            })
            await manager.broadcast(lobby_id, _lobby_update(engine))
            if all_done:
                await _check_round_end(lobby_id, engine)

        elif msg_type == "reset_game":
            if player_id != engine.lobby.host_id:
                raise ValueError("Only the host can reset the game.")
            _cancel_timer(lobby_id)
            engine.reset_game()
            await manager.broadcast(lobby_id, {"type": "game_reset"})
            await manager.broadcast(lobby_id, _lobby_update(engine))

        elif msg_type == "endgame_submit_ghost_hint":
            all_in = engine.endgame_submit_ghost_hint(player_id, data.get("text", ""))
            es = engine.state.endgame_state
            await manager.broadcast(lobby_id, {
                "type": "endgame_hint_received",
                "player_id": player_id,
                "text": data.get("text", ""),
                "all_in": all_in,
            })
            if all_in:
                await _broadcast_endgame_hints_revealed(lobby_id, engine)

        elif msg_type == "endgame_submit_guess":
            _cancel_timer(lobby_id)
            result = engine.endgame_submit_guess(player_id, data.get("guess", ""))
            es = engine.state.endgame_state
            await manager.broadcast(lobby_id, {
                "type": "endgame_guess_result",
                "player_id": player_id,
                "correct": result["correct"],
                "round_over": result["round_over"],
                "target_word": es.target_word if result["round_over"] else None,
                "safe_player_id": es.safe_player_id,
            })
            if result["round_over"]:
                await manager.broadcast(lobby_id, _lobby_update(engine))
                await _check_endgame_round_end(lobby_id, engine)

        else:
            await manager.send(lobby_id, player_id, {
                "type": "error", "message": f"Unknown message type: {msg_type}"
            })

    except ValueError as e:
        await manager.send(lobby_id, player_id, {"type": "error", "message": str(e)})


# ── Game flow helpers ─────────────────────────────────────────────────────────

async def _handle_start_game(lobby_id: str, player_id: str, engine: GameEngine):
    if player_id != engine.lobby.host_id:
        raise ValueError("Only the host can start the game.")
    seed = _new_seed()
    engine.start_game(seed=seed)
    # Broadcast updated player list so any removed (pre-start disconnected) players
    # disappear from clients before they see role assignments.
    await manager.broadcast(lobby_id, _lobby_update(engine))
    await _broadcast_round_start(lobby_id, engine, seed)


async def _broadcast_round_start(lobby_id: str, engine: GameEngine, seed: int):
    rs = engine.state.round_state
    participants = [p for p in engine.lobby.active_players() if p.role is not None]
    for player in participants:
        role_msg: dict = {"type": "role_assigned", "role": player.role.value}
        if player.role == Role.MORP:
            role_msg["half_board"] = engine.get_half_board_for_morp(seed=seed)
        await manager.send(lobby_id, player.id, role_msg)

    for player in participants:
        round_msg: dict = {
            "type": "round_start",
            "round_number": rs.round_number,
            "board_hint": rs.board.board_hint,
            "words": rs.board.words,
            "turn_order": rs.turn_order,
        }
        if player.role == Role.SAFE:
            round_msg["target_word"] = rs.target_word
        await manager.send(lobby_id, player.id, round_msg)


async def _broadcast_voting_open(lobby_id: str, engine: GameEngine):
    rs = engine.state.round_state
    await manager.broadcast(lobby_id, {
        "type": "voting_open",
        "hints": [{"player_id": h.player_id, "text": h.text} for h in rs.hints],
        "num_votes": engine.lobby.config.num_morps,
    })


async def _handle_accusation(lobby_id: str, engine: GameEngine):
    rs = engine.state.round_state
    player_roles = {p.id: p.role.value for p in engine.lobby.players.values() if p.role is not None}

    await manager.broadcast(lobby_id, {
        "type": "accusation_result",
        "accused_ids": rs.accused_ids,
        "roles_revealed": {pid: player_roles.get(pid, "unknown") for pid in rs.accused_ids},
    })

    result = engine.resolve_accusation()

    if result["morp_must_guess"]:
        deadline = time.time() + _TIMER_SECONDS
        engine.state.morp_guess_deadline = deadline
        await manager.broadcast(lobby_id, {
            "type": "morp_guess_phase",
            "accused_morp_ids": result["accused_morps"],
            "deadline": deadline,
            "timers_enabled": engine.lobby.config.timers_enabled,
        })
        if engine.lobby.config.timers_enabled:
            _schedule_morp_guess_timeout(lobby_id, engine, result["accused_morps"], rs.target_word)
    else:
        morp_ids = [p.id for p in engine.lobby.active_players() if p.role == Role.MORP]
        await manager.broadcast(lobby_id, {
            "type": "damage_phase",
            "morp_ids": morp_ids,
        })


async def _check_round_end(lobby_id: str, engine: GameEngine):
    phase = engine.state.phase
    if phase == GamePhase.GAME_OVER:
        await _broadcast_game_over(lobby_id, engine)
    elif phase == GamePhase.ENDGAME_2P:
        seed = _new_seed()
        engine.start_endgame_round(seed=seed)
        await _broadcast_endgame_round_start(lobby_id, engine)
    elif phase == GamePhase.ROUND_END:
        await manager.broadcast(lobby_id, {
            "type": "round_end",
            "host_id": engine.lobby.host_id,
        })


async def _broadcast_endgame_round_start(lobby_id: str, engine: GameEngine):
    es = engine.state.endgame_state
    active = engine.lobby.active_players()
    ghosts = engine.lobby.ghost_players()

    # Tell finalists their role has changed to morp for the endgame
    for player in active:
        await manager.send(lobby_id, player.id, {"type": "role_assigned", "role": "morp"})

    base_msg = {
        "type": "endgame_round_start",
        "board_hint": es.board.board_hint,
        "words": es.board.words,
        "finalist_ids": [p.id for p in active],
        "ghost_ids": [p.id for p in ghosts],
    }

    for player in engine.lobby.players.values():
        msg = dict(base_msg)
        if player.is_ghost:
            msg["target_word"] = es.target_word  # ghosts need this to give useful hints
        await manager.send(lobby_id, player.id, msg)


async def _broadcast_endgame_hints_revealed(lobby_id: str, engine: GameEngine):
    es = engine.state.endgame_state
    deadline = time.time() + _TIMER_SECONDS
    await manager.broadcast(lobby_id, {
        "type": "endgame_hints_revealed",
        "hints": [{"player_id": h.player_id, "text": h.text} for h in es.ghost_hints],
        "deadline": deadline,
        "timers_enabled": engine.lobby.config.timers_enabled,
    })
    if engine.lobby.config.timers_enabled:
        _schedule_endgame_timeout(lobby_id, engine, deadline)


async def _check_endgame_round_end(lobby_id: str, engine: GameEngine):
    phase = engine.state.phase
    if phase == GamePhase.GAME_OVER:
        await _broadcast_game_over(lobby_id, engine)
    elif phase == GamePhase.ENDGAME_ROUND_END:
        es = engine.state.endgame_state
        await manager.broadcast(lobby_id, {
            "type": "endgame_round_end",
            "safe_player_id": es.safe_player_id,
            "target_word": es.target_word,
            "host_id": engine.lobby.host_id,
        })


async def _broadcast_game_over(lobby_id: str, engine: GameEngine):
    winner = next((p for p in engine.lobby.players.values() if p.is_active()), None)
    await manager.broadcast(lobby_id, {
        "type": "game_over",
        "winner_id": winner.id if winner else None,
        "winner_name": winner.name if winner else None,
    })


# ── Timer enforcement ─────────────────────────────────────────────────────────

def _schedule_morp_guess_timeout(
    lobby_id: str, engine: GameEngine, accused_morp_ids: list[str], target_word: str
):
    async def _run():
        await asyncio.sleep(_TIMER_SECONDS)
        if engine.state.phase != GamePhase.MORP_GUESS:
            return
        # Auto-submit empty guess for any morp who hasn't guessed
        rs = engine.state.round_state
        if rs is None:
            return
        for morp_id in accused_morp_ids:
            try:
                correct = engine.submit_morp_guess(morp_id, "")
                await manager.broadcast(lobby_id, {
                    "type": "morp_guess_result",
                    "morp_id": morp_id,
                    "correct": correct,
                    "target_word": target_word,
                    "timed_out": True,
                })
            except ValueError:
                pass
        await manager.broadcast(lobby_id, _lobby_update(engine))
        await _check_round_end(lobby_id, engine)

    _cancel_timer(lobby_id)
    _timer_tasks[lobby_id] = asyncio.create_task(_run())


def _schedule_endgame_timeout(lobby_id: str, engine: GameEngine, deadline: float):
    async def _run():
        await asyncio.sleep(max(0, deadline - time.time()))
        if engine.state.phase != GamePhase.ENDGAME_GUESSING:
            return
        engine.endgame_timeout()
        es = engine.state.endgame_state
        await manager.broadcast(lobby_id, {
            "type": "endgame_timeout",
            "target_word": es.target_word if es else None,
        })
        await manager.broadcast(lobby_id, _lobby_update(engine))
        await _check_endgame_round_end(lobby_id, engine)

    _cancel_timer(lobby_id)
    _timer_tasks[lobby_id] = asyncio.create_task(_run())


# ── Broadcast helpers ─────────────────────────────────────────────────────────

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
