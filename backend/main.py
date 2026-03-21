import asyncio
import os
import pathlib
import secrets
import signal
import string
import time

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

_FRONTEND = pathlib.Path(__file__).parent.parent / "frontend" / "index.html"
_ASSETS     = pathlib.Path(__file__).parent.parent / "frontend" / "assets"
_COSMETICS  = pathlib.Path(__file__).parent.parent / "frontend" / "cosmetics"
_STYLES     = pathlib.Path(__file__).parent.parent / "frontend" / "styles"
_SCRIPTS    = pathlib.Path(__file__).parent.parent / "frontend" / "scripts"
_MUSIC      = pathlib.Path(__file__).parent.parent / "frontend" / "music"

from backend.connection_manager import ConnectionManager
from backend.game.board import validate_custom_board
from backend.game.engine import GameEngine
from backend.models.game import GamePhase
from backend.models.player import Role

app = FastAPI()

app.mount("/cosmetics", StaticFiles(directory=_COSMETICS), name="cosmetics")
app.mount("/assets", StaticFiles(directory=_ASSETS), name="assets")
app.mount("/styles", StaticFiles(directory=_STYLES), name="styles")
app.mount("/scripts", StaticFiles(directory=_SCRIPTS), name="scripts")
app.mount("/music", StaticFiles(directory=_MUSIC), name="music")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()
_engines: dict[str, GameEngine] = {}
_timer_tasks: dict[str, asyncio.Task] = {}  # lobby_id -> active timer task
_interaction_times: dict[str, float] = {}   # "lobby_id:player_id" -> last interaction timestamp

_INTERACTION_COOLDOWN = 1.5

_TIMER_SECONDS = 30  # duration for morp-guess and endgame-guess timers
_TIMER_GRACE_SECONDS = 2  # extra buffer before server auto-submits, gives client time to submit first


@app.on_event("startup")
async def _setup_shutdown_handler():
    loop = asyncio.get_running_loop()

    def _make_handler(signum: int):
        async def _graceful_shutdown():
            await manager.broadcast_all({"type": "maintenance_shutdown"})
            await asyncio.sleep(0.75)
            loop.remove_signal_handler(signal.SIGTERM)
            loop.remove_signal_handler(signal.SIGINT)
            os.kill(os.getpid(), signum)

        def _handler():
            loop.create_task(_graceful_shutdown())

        return _handler

    try:
        loop.add_signal_handler(signal.SIGTERM, _make_handler(signal.SIGTERM))
        loop.add_signal_handler(signal.SIGINT, _make_handler(signal.SIGINT))
    except NotImplementedError:
        pass  # Windows does not support add_signal_handler; graceful shutdown is Linux/Docker only


# ── Helpers ───────────────────────────────────────────────────────────────────

def _lobby_code() -> str:
    chars = string.ascii_uppercase# + string.digits
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
    cosmetics: dict | None = None


class KickRequest(BaseModel):
    player_id: str
    target_id: str


class CustomBoardEntry(BaseModel):
    board_hint: str
    words: list[str]


class SetBoardsRequest(BaseModel):
    player_id: str
    boards: list[CustomBoardEntry]


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
        if body.cosmetics:
            from backend.models.player import PlayerCosmetics
            existing.cosmetics = PlayerCosmetics(**body.cosmetics)
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
    if body.cosmetics:
        from backend.models.player import PlayerCosmetics
        engine.lobby.players[player_id].cosmetics = PlayerCosmetics(**body.cosmetics)
    return {"player_id": player_id}


@app.post("/lobby/{lobby_id}/kick")
async def kick_player(lobby_id: str, body: KickRequest):
    engine = _get_engine(lobby_id)
    try:
        phase_before = engine.state.phase
        rs = engine.state.round_state
        hints_before = len(rs.hints) if rs and phase_before == GamePhase.HINT else 0

        # Mutate engine state first so the disconnect handler sees correct state
        engine.kick_player(body.player_id, body.target_id)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    # Close the target's WebSocket after state is updated
    ws = manager._connections.get(lobby_id, {}).get(body.target_id)
    if ws:
        await ws.send_json({"type": "kicked"})
        await ws.close(code=4403)
        manager.disconnect(lobby_id, body.target_id)

    await manager.broadcast(lobby_id, _lobby_update(engine))
    phase_after = engine.state.phase

    if phase_before == GamePhase.HINT and rs:
        for h in rs.hints[hints_before:]:
            await manager.broadcast(lobby_id, {"type": "hint_received", **_hint_payload(h)})

    if phase_before == GamePhase.HINT and phase_after == GamePhase.VOTING:
        await _broadcast_voting_open(lobby_id, engine)
    elif phase_before == GamePhase.VOTING and phase_after == GamePhase.ACCUSATION:
        await _handle_accusation(lobby_id, engine)

    return {"ok": True}


@app.post("/lobby/{lobby_id}/boards")
async def set_custom_boards(lobby_id: str, body: SetBoardsRequest):
    engine = _get_engine(lobby_id)
    if body.player_id != engine.lobby.host_id:
        raise HTTPException(status_code=403, detail="Only the host can set custom boards.")
    if engine.lobby.started:
        raise HTTPException(status_code=409, detail="Cannot change boards after the game has started.")
    if not body.boards:
        raise HTTPException(status_code=422, detail="Must provide at least one board.")
    validated = []
    for i, b in enumerate(body.boards):
        try:
            validated.append(validate_custom_board(b.model_dump()))
        except ValueError as e:
            raise HTTPException(status_code=422, detail=f"Board {i + 1}: {e}")
    engine.board_manager.set_custom_boards(validated)
    return {"boards_set": len(validated)}


@app.get("/lobby/{lobby_id}")
async def get_lobby(lobby_id: str):
    engine = _get_engine(lobby_id)
    players = [
        {"id": p.id, "name": p.name, "hp": p.hp, "is_ghost": p.is_ghost, "cosmetics": p.cosmetics.model_dump()}
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
            "hints": [_hint_payload(h) for h in rs.hints],
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
    elif _phase == GamePhase.ENDGAME_GHOST_HINTS:
        es = engine.state.endgame_state
        active = engine.lobby.active_players()
        ghosts = engine.lobby.ghost_players()
        msg: dict = {
            "type": "endgame_round_start",
            "board_hint": es.board.board_hint,
            "words": es.board.words,
            "finalist_ids": [p.id for p in active],
            "ghost_ids": [p.id for p in ghosts],
        }
        player = engine.lobby.players[player_id]
        if player.is_ghost:
            msg["target_word"] = es.target_word
        await manager.send(lobby_id, player_id, msg)
        # Replay hints already submitted so the ghost sees what others have given
        for h in es.ghost_hints:
            await manager.send(lobby_id, player_id, {
                "type": "endgame_hint_received",
                "all_in": False,
                **_hint_payload(h),
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
            for k in [k for k in _interaction_times if k.startswith(f"{lobby_id}:")]:
                del _interaction_times[k]
            return

        await manager.broadcast(lobby_id, _lobby_update(engine))
        phase_after = engine.state.phase

        # Broadcast hint_received for every hint that was auto-skipped on disconnect
        if phase_before == GamePhase.HINT and rs:
            for h in rs.hints[hints_before:]:
                await manager.broadcast(lobby_id, {"type": "hint_received", **_hint_payload(h)})

        if phase_before == GamePhase.HINT and phase_after == GamePhase.VOTING:
            await _broadcast_voting_open(lobby_id, engine)
        elif phase_before == GamePhase.VOTING and phase_after == GamePhase.ACCUSATION:
            await _handle_accusation(lobby_id, engine)
        elif phase_before == GamePhase.ENDGAME_GHOST_HINTS and phase_after == GamePhase.ENDGAME_GUESSING:
            await _broadcast_endgame_hints_revealed(lobby_id, engine)


# ── Hint-phase rejoin ─────────────────────────────────────────────────────────

async def _send_hint_phase_rejoin(lobby_id: str, player_id: str, engine: GameEngine):
    """Re-send round context to a player who reconnected during the hint phase."""
    rs = engine.state.round_state
    player = engine.lobby.players[player_id]
    if rs is None:
        return

    if player.role is None:
        # Ghost spectator — send board with target word so they can follow along
        if not player.is_ghost:
            return
        round_msg: dict = {
            "type": "round_start",
            "round_number": rs.round_number,
            "board_hint": rs.board.board_hint,
            "words": rs.board.words,
            "turn_order": rs.turn_order,
            "target_word": rs.target_word,
        }
        await manager.send(lobby_id, player_id, round_msg)
        for h in rs.hints:
            await manager.send(lobby_id, player_id, {"type": "hint_received", **_hint_payload(h)})
        return

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
        await manager.send(lobby_id, player_id, {"type": "hint_received", **_hint_payload(h)})


# ── Message handler ───────────────────────────────────────────────────────────

async def _handle_message(lobby_id: str, player_id: str, data: dict, engine: GameEngine):
    msg_type = data.get("type")

    try:
        if msg_type == "start_game":
            engine.lobby.config.timers_enabled = data.get("timers_enabled", True)
            engine.lobby.config.drawing_hints = data.get("drawing_hints", False)
            await _handle_start_game(lobby_id, player_id, engine)

        elif msg_type == "next_round":
            if player_id != engine.lobby.host_id:
                raise ValueError("Only the host can start the next round.")
            if engine.state.phase == GamePhase.ROUND_END:
                seed = _new_seed()
                engine.start_new_round(seed=seed)
                await manager.broadcast(lobby_id, _lobby_update(engine))
                await _broadcast_round_start(lobby_id, engine, seed)
            elif engine.state.phase == GamePhase.ENDGAME_2P:
                seed = _new_seed()
                engine.start_endgame_round(seed=seed)
                await manager.broadcast(lobby_id, _lobby_update(engine))
                await _broadcast_endgame_round_start(lobby_id, engine)
            elif engine.state.phase == GamePhase.ENDGAME_ROUND_END:
                seed = _new_seed()
                engine.start_next_endgame_round(seed=seed)
                await manager.broadcast(lobby_id, _lobby_update(engine))
                await _broadcast_endgame_round_start(lobby_id, engine)
            else:
                raise ValueError("Not waiting to start a new round.")

        elif msg_type == "submit_hint":
            engine.submit_hint(
                player_id,
                text=data.get("text", ""),
                drawing_data=data.get("drawing_data"),
            )
            stored = engine.state.round_state.hints[-1]
            await manager.broadcast(lobby_id, {"type": "hint_received", **_hint_payload(stored)})
            if engine.state.phase == GamePhase.VOTING:
                await _broadcast_voting_open(lobby_id, engine)

        elif msg_type == "submit_votes":
            engine.submit_votes(player_id, data.get("accused_ids", []))
            if engine.state.phase == GamePhase.ACCUSATION:
                await _handle_accusation(lobby_id, engine)

        elif msg_type == "submit_morp_guess":
            _cancel_timer(lobby_id)
            rs = engine.state.round_state
            guess = data.get("guess", "")
            correct = engine.submit_morp_guess(player_id, guess)
            await manager.broadcast(lobby_id, {
                "type": "morp_guess_result",
                "morp_id": player_id,
                "correct": correct,
                "target_word": rs.target_word,
                "guess": guess,
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

        elif msg_type == "interaction":
            _key = f"{lobby_id}:{player_id}"
            if time.time() - _interaction_times.get(_key, 0) < _INTERACTION_COOLDOWN:
                return
            interaction = data.get("interaction", "").strip()[:32]
            target_id = data.get("target_id")
            if not interaction:
                raise ValueError("Missing interaction.")
            if target_id:
                target = engine.lobby.players.get(target_id)
                if not target or not target.is_connected or target.is_ghost:
                    raise ValueError("Target is not available.")
            _interaction_times[_key] = time.time()
            await manager.broadcast(lobby_id, {
                "type": "interaction",
                "player_id": player_id,
                "interaction": interaction,
                "target_id": target_id,
            })

        elif msg_type == "chat":
            text = data.get("text", "").strip()[:150]
            if text:
                player = engine.lobby.players[player_id]
                await manager.broadcast(lobby_id, {
                    "type": "chat",
                    "player_id": player_id,
                    "name": player.name,
                    "text": text,
                })

        elif msg_type == "reset_game":
            if player_id != engine.lobby.host_id:
                raise ValueError("Only the host can reset the game.")
            _cancel_timer(lobby_id)
            engine.reset_game()
            await manager.broadcast(lobby_id, {"type": "game_reset"})
            await manager.broadcast(lobby_id, _lobby_update(engine))

        elif msg_type == "endgame_submit_ghost_hint":
            all_in = engine.endgame_submit_ghost_hint(
                player_id,
                text=data.get("text", ""),
                drawing_data=data.get("drawing_data"),
            )
            es = engine.state.endgame_state
            stored = next(h for h in es.ghost_hints if h.player_id == player_id)
            await manager.broadcast(lobby_id, {
                "type": "endgame_hint_received",
                **_hint_payload(stored),
            })
            if all_in and engine.state.phase == GamePhase.ENDGAME_GHOST_HINTS:
                await _start_endgame_guess_phase(lobby_id, engine)

        elif msg_type == "endgame_submit_guess":
            guess = data.get("guess", "")
            auto_submitted = bool(data.get("auto_submitted", False))
            result = engine.endgame_submit_guess(player_id, guess, auto_submitted=auto_submitted)
            if result["all_in"]:
                _cancel_timer(lobby_id)
                await _broadcast_endgame_guesses_revealed(lobby_id, engine)

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

    # Send board info to ghost spectators so they see each new round and hints clear
    ghost_round_msg: dict = {
        "type": "round_start",
        "round_number": rs.round_number,
        "board_hint": rs.board.board_hint,
        "words": rs.board.words,
        "turn_order": rs.turn_order,
        "target_word": rs.target_word,
    }
    for player in engine.lobby.ghost_players():
        if player.is_connected:
            await manager.send(lobby_id, player.id, ghost_round_msg)


async def _broadcast_voting_open(lobby_id: str, engine: GameEngine):
    rs = engine.state.round_state
    await manager.broadcast(lobby_id, {
        "type": "voting_open",
        "hints": [_hint_payload(h) for h in rs.hints],
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
        await manager.broadcast(lobby_id, {
            "type": "round_end",
            "host_id": engine.lobby.host_id,
            "endgame_transition": True,
        })
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

    hint_deadline = time.time() + _TIMER_SECONDS
    base_msg = {
        "type": "endgame_round_start",
        "board_hint": es.board.board_hint,
        "words": es.board.words,
        "finalist_ids": [p.id for p in active],
        "ghost_ids": [p.id for p in ghosts],
        "hint_deadline": hint_deadline,
        "timers_enabled": engine.lobby.config.timers_enabled,
    }

    for player in engine.lobby.players.values():
        msg = dict(base_msg)
        if player.is_ghost:
            msg["target_word"] = es.target_word  # ghosts need this to give useful hints
        await manager.send(lobby_id, player.id, msg)

    if engine.lobby.config.timers_enabled:
        _schedule_endgame_hint_timeout(lobby_id, engine, hint_deadline)


async def _broadcast_endgame_hints_revealed(lobby_id: str, engine: GameEngine):
    es = engine.state.endgame_state
    deadline = time.time() + _TIMER_SECONDS
    await manager.broadcast(lobby_id, {
        "type": "endgame_hints_revealed",
        "hints": [_hint_payload(h) for h in es.ghost_hints],
        "deadline": deadline,
        "timers_enabled": engine.lobby.config.timers_enabled,
    })
    if engine.lobby.config.timers_enabled:
        _schedule_endgame_timeout(lobby_id, engine, deadline)


async def _broadcast_endgame_guesses_revealed(
    lobby_id: str, engine: GameEngine, timed_out: bool = False
):
    resolution = engine.endgame_resolve_guesses()
    await manager.broadcast(lobby_id, {
        "type": "endgame_guesses_revealed",
        "results": resolution["results"],
        "safe_player_id": resolution["safe_player_id"],
        "target_word": resolution["target_word"],
        "timed_out": timed_out,
        "draw": resolution.get("draw", False),
    })
    await manager.broadcast(lobby_id, _lobby_update(engine))
    await _check_endgame_round_end(lobby_id, engine, draw=resolution.get("draw", False))


async def _check_endgame_round_end(lobby_id: str, engine: GameEngine, draw: bool = False):
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
            "draw": draw,
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
        await asyncio.sleep(_TIMER_SECONDS + _TIMER_GRACE_SECONDS)
        if engine.state.phase != GamePhase.MORP_GUESS:
            return
        # Auto-submit empty guess for any morp who hasn't guessed
        rs = engine.state.round_state
        if rs is None:
            return
        # Pre-pop self from registry so that _check_round_end → _broadcast_endgame_round_start
        # → _schedule_endgame_hint_timeout → _cancel_timer doesn't cancel this task.
        _timer_tasks.pop(lobby_id, None)
        for morp_id in accused_morp_ids:
            try:
                correct = engine.submit_morp_guess(morp_id, "")
                await manager.broadcast(lobby_id, {
                    "type": "morp_guess_result",
                    "morp_id": morp_id,
                    "correct": correct,
                    "target_word": target_word,
                    "guess": "",
                    "timed_out": True,
                })
            except ValueError:
                pass
        await manager.broadcast(lobby_id, _lobby_update(engine))
        await _check_round_end(lobby_id, engine)

    _cancel_timer(lobby_id)
    _timer_tasks[lobby_id] = asyncio.create_task(_run())


async def _start_endgame_guess_phase(lobby_id: str, engine: GameEngine):
    """Cancel the hint timer, transition engine to guess phase, and start guess timer."""
    _cancel_timer(lobby_id)
    engine.endgame_end_hint_phase()
    guess_deadline = time.time() + _TIMER_SECONDS
    await manager.broadcast(lobby_id, {
        "type": "endgame_hint_phase_over",
        "guess_deadline": guess_deadline,
        "timers_enabled": engine.lobby.config.timers_enabled,
    })
    if engine.lobby.config.timers_enabled:
        _schedule_endgame_timeout(lobby_id, engine, guess_deadline)


def _schedule_endgame_hint_timeout(lobby_id: str, engine: GameEngine, deadline: float):
    async def _run():
        await asyncio.sleep(max(0, deadline - time.time()))
        if engine.state.phase != GamePhase.ENDGAME_GHOST_HINTS:
            return  # round ended early (correct guess during hint phase)
        # Remove self from registry before calling _start_endgame_guess_phase so that
        # its internal _cancel_timer call is a no-op and doesn't cancel this task.
        _timer_tasks.pop(lobby_id, None)
        await _start_endgame_guess_phase(lobby_id, engine)

    _cancel_timer(lobby_id)
    _timer_tasks[lobby_id] = asyncio.create_task(_run())


def _schedule_endgame_timeout(lobby_id: str, engine: GameEngine, deadline: float):
    async def _run():
        await asyncio.sleep(max(0, deadline - time.time()) + _TIMER_GRACE_SECONDS)
        if engine.state.phase != GamePhase.ENDGAME_GUESSING:
            return
        _timer_tasks.pop(lobby_id, None)
        await _broadcast_endgame_guesses_revealed(lobby_id, engine, timed_out=True)

    _cancel_timer(lobby_id)
    _timer_tasks[lobby_id] = asyncio.create_task(_run())


# ── Broadcast helpers ─────────────────────────────────────────────────────────

def _hint_payload(h) -> dict:
    """Serialize a Hint for WebSocket broadcast — handles both text and drawing hints."""
    if h.is_drawing:
        return {"player_id": h.player_id, "is_drawing": True, "drawing_data": h.drawing_data}
    return {"player_id": h.player_id, "is_drawing": False, "text": h.text}


def _lobby_update(engine: GameEngine) -> dict:
    return {
        "type": "lobby_update",
        "host_id": engine.lobby.host_id,
        "started": engine.lobby.started,
        "drawing_hints": engine.lobby.config.drawing_hints,
        "players": [
            {
                "id": p.id,
                "name": p.name,
                "hp": p.hp,
                "is_ghost": p.is_ghost,
                "is_connected": p.is_connected,
                "cosmetics": p.cosmetics.model_dump(),
            }
            for p in engine.lobby.players.values()
        ],
    }
