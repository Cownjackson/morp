"""Integration tests for the WebSocket + REST API layer.

Uses Starlette's synchronous TestClient which supports both HTTP and WebSocket.
"""
import json
import pytest
from starlette.testclient import TestClient

from backend.main import app, _engines, _timer_tasks
import backend.main as _main_module


@pytest.fixture(autouse=True)
def reset_global_state():
    """Clear module-level game state before each test to prevent cross-test pollution."""
    _engines.clear()
    _timer_tasks.clear()
    _main_module.manager._connections.clear()
    yield


@pytest.fixture
def client():
    return TestClient(app)


def drain_until(ws, target_type: str) -> dict:
    """Read messages from ws, discarding any that aren't target_type, return the first match."""
    for _ in range(20):
        msg = ws.receive_json()
        if msg["type"] == target_type:
            return msg
    raise AssertionError(f"Never received a '{target_type}' message within 20 reads")


def collect_until(ws, target_type: str, limit: int = 20) -> list[dict]:
    """Return all messages up to and including the first occurrence of target_type."""
    msgs = []
    for _ in range(limit):
        msg = ws.receive_json()
        msgs.append(msg)
        if msg["type"] == target_type:
            return msgs
    raise AssertionError(f"Never received '{target_type}' within {limit} reads")


# --- REST: lobby lifecycle ---

def test_create_lobby_returns_lobby_id(client):
    resp = client.post("/lobby/create")
    assert resp.status_code == 200
    data = resp.json()
    assert "lobby_id" in data
    assert isinstance(data["lobby_id"], str)


def test_join_lobby_returns_player_id(client):
    lobby_id = client.post("/lobby/create").json()["lobby_id"]
    resp = client.post(f"/lobby/{lobby_id}/join", json={"name": "Alice"})
    assert resp.status_code == 200
    data = resp.json()
    assert "player_id" in data


def test_join_nonexistent_lobby_returns_404(client):
    resp = client.post("/lobby/ZZZZZZ/join", json={"name": "Alice"})
    assert resp.status_code == 404


def test_multiple_players_get_unique_ids(client):
    lobby_id = client.post("/lobby/create").json()["lobby_id"]
    id_a = client.post(f"/lobby/{lobby_id}/join", json={"name": "Alice"}).json()["player_id"]
    id_b = client.post(f"/lobby/{lobby_id}/join", json={"name": "Bob"}).json()["player_id"]
    assert id_a != id_b


# --- REST: lobby state ---

def test_get_lobby_state(client):
    lobby_id = client.post("/lobby/create").json()["lobby_id"]
    client.post(f"/lobby/{lobby_id}/join", json={"name": "Alice"})
    resp = client.get(f"/lobby/{lobby_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert "players" in data
    assert len(data["players"]) == 1


# --- WebSocket: connection ---

def test_player_can_connect_via_websocket(client):
    lobby_id = client.post("/lobby/create").json()["lobby_id"]
    player_id = client.post(f"/lobby/{lobby_id}/join", json={"name": "Alice"}).json()["player_id"]
    with client.websocket_connect(f"/ws/{lobby_id}/{player_id}") as ws:
        msg = drain_until(ws, "lobby_update")
        assert msg["type"] == "lobby_update"


def test_unknown_player_websocket_rejected(client):
    lobby_id = client.post("/lobby/create").json()["lobby_id"]
    with pytest.raises(Exception):
        with client.websocket_connect(f"/ws/{lobby_id}/not-a-real-id") as ws:
            ws.receive_json()


# --- WebSocket: full round flow ---

def _setup_lobby(client, num_players=3):
    """Create a lobby, join num_players, return (lobby_id, player_ids, websockets)."""
    lobby_id = client.post("/lobby/create").json()["lobby_id"]
    player_ids = []
    for i in range(num_players):
        pid = client.post(f"/lobby/{lobby_id}/join", json={"name": f"P{i}"}).json()["player_id"]
        player_ids.append(pid)
    return lobby_id, player_ids


def test_start_game_broadcasts_round_start(client):
    lobby_id, player_ids = _setup_lobby(client, num_players=3)
    host_id = player_ids[0]

    with client.websocket_connect(f"/ws/{lobby_id}/{player_ids[0]}") as ws0, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[1]}") as ws1, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[2]}") as ws2:

        # Drain lobby_updates from sequential connects
        for ws in (ws0, ws1, ws2):
            drain_until(ws, "lobby_update")

        # Host starts game
        ws0.send_json({"type": "start_game"})

        # Each player receives role_assigned then round_start
        for ws in (ws0, ws1, ws2):
            role_msg = drain_until(ws, "role_assigned")
            assert role_msg["role"] in ("safe", "morp")

        for ws in (ws0, ws1, ws2):
            round_msg = drain_until(ws, "round_start")
            assert "board_hint" in round_msg
            assert "turn_order" in round_msg


def test_morp_does_not_receive_target_word_in_round_start(client):
    lobby_id, player_ids = _setup_lobby(client, num_players=3)

    with client.websocket_connect(f"/ws/{lobby_id}/{player_ids[0]}") as ws0, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[1]}") as ws1, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[2]}") as ws2:

        for ws in (ws0, ws1, ws2):
            drain_until(ws, "lobby_update")
        ws0.send_json({"type": "start_game"})

        wss = [ws0, ws1, ws2]
        role_msgs = [drain_until(ws, "role_assigned") for ws in wss]
        round_msgs = [drain_until(ws, "round_start") for ws in wss]

        for role_msg, round_msg in zip(role_msgs, round_msgs):
            if role_msg["role"] == "morp":
                assert round_msg.get("target_word") is None
            else:
                assert round_msg.get("target_word") is not None


def test_only_host_can_start_game(client):
    lobby_id, player_ids = _setup_lobby(client, num_players=3)

    with client.websocket_connect(f"/ws/{lobby_id}/{player_ids[0]}") as ws0, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[1]}") as ws1, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[2]}") as ws2:

        for ws in (ws0, ws1, ws2):
            drain_until(ws, "lobby_update")

        # Non-host tries to start
        ws1.send_json({"type": "start_game"})
        error_msg = drain_until(ws1, "error")
        assert error_msg["type"] == "error"


def test_hint_phase_enforces_turn_order(client):
    lobby_id, player_ids = _setup_lobby(client, num_players=3)

    with client.websocket_connect(f"/ws/{lobby_id}/{player_ids[0]}") as ws0, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[1]}") as ws1, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[2]}") as ws2:

        wss = {player_ids[0]: ws0, player_ids[1]: ws1, player_ids[2]: ws2}

        for ws in (ws0, ws1, ws2):
            drain_until(ws, "lobby_update")
        ws0.send_json({"type": "start_game"})

        for ws in (ws0, ws1, ws2):
            drain_until(ws, "role_assigned")
        round_msgs = {pid: drain_until(wss[pid], "round_start") for pid in player_ids}

        turn_order = round_msgs[player_ids[0]]["turn_order"]
        first_pid = turn_order[0]
        second_pid = turn_order[1]

        # Second player tries to hint first — should get error
        wss[second_pid].send_json({"type": "submit_hint", "text": "sneaky"})
        err = drain_until(wss[second_pid], "error")
        assert err["type"] == "error"

        # First player hints correctly
        wss[first_pid].send_json({"type": "submit_hint", "text": "valid hint"})
        for ws in (ws0, ws1, ws2):
            hint_msg = drain_until(ws, "hint_received")
            assert hint_msg["type"] == "hint_received"


def test_voting_opens_after_all_hints(client):
    lobby_id, player_ids = _setup_lobby(client, num_players=3)

    with client.websocket_connect(f"/ws/{lobby_id}/{player_ids[0]}") as ws0, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[1]}") as ws1, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[2]}") as ws2:

        wss = {player_ids[0]: ws0, player_ids[1]: ws1, player_ids[2]: ws2}

        for ws in (ws0, ws1, ws2):
            drain_until(ws, "lobby_update")
        ws0.send_json({"type": "start_game"})

        for ws in (ws0, ws1, ws2):
            drain_until(ws, "role_assigned")

        round_msg = drain_until(ws0, "round_start")
        drain_until(ws1, "round_start"); drain_until(ws2, "round_start")
        turn_order = round_msg["turn_order"]

        for pid in turn_order:
            wss[pid].send_json({"type": "submit_hint", "text": "hint"})
            for ws in (ws0, ws1, ws2):
                drain_until(ws, "hint_received")

        for ws in (ws0, ws1, ws2):
            voting_msg = drain_until(ws, "voting_open")
            assert voting_msg["type"] == "voting_open"


# --- Game reset ---

def _start_game(wss, ws0):
    """Helper: drain lobby_updates, start game, drain role_assigned + round_start for all."""
    for ws in wss:
        drain_until(ws, "lobby_update")
    ws0.send_json({"type": "start_game"})
    for ws in wss:
        drain_until(ws, "role_assigned")
        drain_until(ws, "round_start")


def test_host_reset_broadcasts_game_reset_and_lobby_update(client):
    lobby_id, player_ids = _setup_lobby(client, num_players=3)

    with client.websocket_connect(f"/ws/{lobby_id}/{player_ids[0]}") as ws0, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[1]}") as ws1, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[2]}") as ws2:

        wss = [ws0, ws1, ws2]
        _start_game(wss, ws0)

        ws0.send_json({"type": "reset_game"})

        for ws in wss:
            drain_until(ws, "game_reset")
            lu = drain_until(ws, "lobby_update")
            assert lu["started"] is False


def test_non_host_cannot_reset_game(client):
    lobby_id, player_ids = _setup_lobby(client, num_players=3)

    with client.websocket_connect(f"/ws/{lobby_id}/{player_ids[0]}") as ws0, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[1]}") as ws1, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[2]}") as ws2:

        _start_game([ws0, ws1, ws2], ws0)

        ws1.send_json({"type": "reset_game"})
        err = drain_until(ws1, "error")
        assert "host" in err["message"].lower()


def test_new_game_starts_successfully_after_reset(client):
    lobby_id, player_ids = _setup_lobby(client, num_players=3)

    with client.websocket_connect(f"/ws/{lobby_id}/{player_ids[0]}") as ws0, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[1]}") as ws1, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[2]}") as ws2:

        wss = [ws0, ws1, ws2]
        _start_game(wss, ws0)

        ws0.send_json({"type": "reset_game"})
        for ws in wss:
            drain_until(ws, "game_reset")
            drain_until(ws, "lobby_update")

        # Second game starts cleanly
        ws0.send_json({"type": "start_game"})
        for ws in wss:
            role_msg = drain_until(ws, "role_assigned")
            assert role_msg["role"] in ("safe", "morp")
        for ws in wss:
            round_msg = drain_until(ws, "round_start")
            assert round_msg["round_number"] == 1


# --- Endgame role assignment ---

def test_finalists_receive_morp_role_on_endgame_start(client):
    """Both finalists must be told they are morp when the 2-player endgame begins.

    Uses a 3-player game: accuse a safe player, morp damages the other safe
    player (who has 1 HP) to trigger endgame_2p, then verifies both finalists
    receive role_assigned: morp.
    """
    from backend.main import _engines
    lobby_id, player_ids = _setup_lobby(client, num_players=3)

    with client.websocket_connect(f"/ws/{lobby_id}/{player_ids[0]}") as ws0, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[1]}") as ws1, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[2]}") as ws2:

        wss = [ws0, ws1, ws2]
        wss_by_id = dict(zip(player_ids, wss))

        for ws in wss:
            drain_until(ws, "lobby_update")
        ws0.send_json({"type": "start_game", "timers_enabled": False})

        role_msgs = {pid: drain_until(wss_by_id[pid], "role_assigned") for pid in player_ids}
        round_msgs = {pid: drain_until(wss_by_id[pid], "round_start") for pid in player_ids}

        morp_id = next(pid for pid, rm in role_msgs.items() if rm["role"] == "morp")
        safe_ids = [pid for pid, rm in role_msgs.items() if rm["role"] == "safe"]
        turn_order = round_msgs[player_ids[0]]["turn_order"]

        # Submit all hints
        for pid in turn_order:
            wss_by_id[pid].send_json({"type": "submit_hint", "text": "hint"})
            for ws in wss:
                drain_until(ws, "hint_received")
        for ws in wss:
            drain_until(ws, "voting_open")

        # All vote for safe_ids[0] to accuse a safe player
        for pid in player_ids:
            target = safe_ids[0] if pid != safe_ids[0] else safe_ids[1]
            wss_by_id[pid].send_json({"type": "submit_votes", "accused_ids": [target]})

        for ws in wss:
            drain_until(ws, "accusation_result")

        # Set the surviving safe player to 1 HP so damage eliminates them
        engine = _engines[lobby_id]
        engine.lobby.players[safe_ids[1]].hp = 1

        # Morp deals damage to the low-HP player, triggering endgame
        wss_by_id[morp_id].send_json({"type": "morp_deal_damage", "target_id": safe_ids[1]})
        for ws in wss:
            drain_until(ws, "damage_dealt")
            drain_until(ws, "lobby_update")

        # Both finalists (morp_id + safe_ids[0]) should receive role_assigned: morp
        finalist_ids = [morp_id, safe_ids[0]]
        for pid in finalist_ids:
            rm = drain_until(wss_by_id[pid], "role_assigned")
            assert rm["role"] == "morp"


# --- Name uniqueness / reconnect (REST) ---

def test_lobby_deleted_when_all_players_disconnect(client):
    from backend.main import _engines
    lobby_id = client.post("/lobby/create").json()["lobby_id"]
    pid = client.post(f"/lobby/{lobby_id}/join", json={"name": "Alice"}).json()["player_id"]
    with client.websocket_connect(f"/ws/{lobby_id}/{pid}") as ws:
        drain_until(ws, "lobby_update")
    # All disconnected — engine should be cleaned up
    assert lobby_id not in _engines


def test_hint_truncated_to_max_length(client):
    from backend.game.engine import MAX_HINT_LENGTH
    lobby_id, player_ids = _setup_lobby(client, num_players=3)
    with client.websocket_connect(f"/ws/{lobby_id}/{player_ids[0]}") as ws0, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[1]}") as ws1, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[2]}") as ws2:
        wss = {player_ids[0]: ws0, player_ids[1]: ws1, player_ids[2]: ws2}
        for ws in (ws0, ws1, ws2):
            drain_until(ws, "lobby_update")
        ws0.send_json({"type": "start_game"})
        for ws in (ws0, ws1, ws2):
            drain_until(ws, "role_assigned")
        round_msg = drain_until(ws0, "round_start")
        drain_until(ws1, "round_start"); drain_until(ws2, "round_start")
        first_pid = round_msg["turn_order"][0]
        long_hint = "X" * (MAX_HINT_LENGTH + 20)
        wss[first_pid].send_json({"type": "submit_hint", "text": long_hint})
        for ws in (ws0, ws1, ws2):
            hint_msg = drain_until(ws, "hint_received")
            assert len(hint_msg["text"]) <= MAX_HINT_LENGTH


def test_max_players_enforced(client):
    lobby_id = client.post("/lobby/create").json()["lobby_id"]
    from backend.main import _engines
    # Override max_players to a small number for test speed
    _engines[lobby_id].lobby.config.max_players = 2
    client.post(f"/lobby/{lobby_id}/join", json={"name": "P1"})
    client.post(f"/lobby/{lobby_id}/join", json={"name": "P2"})
    resp = client.post(f"/lobby/{lobby_id}/join", json={"name": "P3"})
    assert resp.status_code == 409


def test_host_reassigned_on_disconnect_broadcast(client):
    lobby_id, player_ids = _setup_lobby(client, num_players=3)
    with client.websocket_connect(f"/ws/{lobby_id}/{player_ids[1]}") as ws1, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[2]}") as ws2:
        drain_until(ws1, "lobby_update"); drain_until(ws2, "lobby_update")
        with client.websocket_connect(f"/ws/{lobby_id}/{player_ids[0]}") as ws0:
            drain_until(ws0, "lobby_update")
            drain_until(ws1, "lobby_update"); drain_until(ws2, "lobby_update")
        # host (player_ids[0]) disconnects
        lu = drain_until(ws1, "lobby_update")
        # New host must be one of the remaining connected players
        assert lu["host_id"] in (player_ids[1], player_ids[2])


def test_duplicate_name_in_lobby_returns_409(client):
    """Joining with a name already held by a connected player must return 409."""
    lobby_id = client.post("/lobby/create").json()["lobby_id"]
    pid = client.post(f"/lobby/{lobby_id}/join", json={"name": "Alice"}).json()["player_id"]
    # Alice must have an active WS for her slot to be truly "connected"
    with client.websocket_connect(f"/ws/{lobby_id}/{pid}") as ws:
        drain_until(ws, "lobby_update")
        resp = client.post(f"/lobby/{lobby_id}/join", json={"name": "Alice"})
        assert resp.status_code == 409


def test_join_started_game_as_new_player_returns_403(client):
    lobby_id, player_ids = _setup_lobby(client, num_players=3)
    wss = [client.websocket_connect(f"/ws/{lobby_id}/{pid}") for pid in player_ids]
    opened = [ws.__enter__() for ws in wss]
    try:
        for ws in opened:
            drain_until(ws, "lobby_update")
        opened[0].send_json({"type": "start_game"})
        for ws in opened:
            drain_until(ws, "role_assigned")
            drain_until(ws, "round_start")
        resp = client.post(f"/lobby/{lobby_id}/join", json={"name": "Newcomer"})
        assert resp.status_code == 403
    finally:
        for ws in wss:
            try:
                ws.__exit__(None, None, None)
            except Exception:
                pass


def test_join_allowed_during_game_over(client):
    """New players must be able to join once the game reaches GAME_OVER, before host resets."""
    from backend.main import _engines
    from backend.models.game import GamePhase
    lobby_id, player_ids = _setup_lobby(client, num_players=3)
    with client.websocket_connect(f"/ws/{lobby_id}/{player_ids[0]}") as ws0, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[1]}") as ws1, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[2]}") as ws2:
        for ws in (ws0, ws1, ws2):
            drain_until(ws, "lobby_update")
        ws0.send_json({"type": "start_game"})
        for ws in (ws0, ws1, ws2):
            drain_until(ws, "role_assigned")
            drain_until(ws, "round_start")
        # Force the engine into GAME_OVER without playing through
        _engines[lobby_id].state.phase = GamePhase.GAME_OVER
        resp = client.post(f"/lobby/{lobby_id}/join", json={"name": "Newcomer"})
        assert resp.status_code == 200


def test_reconnect_by_name_returns_original_player_id(client):
    """Rejoining with a disconnected player's name gives back their original player_id."""
    lobby_id = client.post("/lobby/create").json()["lobby_id"]
    p0 = client.post(f"/lobby/{lobby_id}/join", json={"name": "Alice"}).json()["player_id"]
    p1 = client.post(f"/lobby/{lobby_id}/join", json={"name": "Bob"}).json()["player_id"]

    with client.websocket_connect(f"/ws/{lobby_id}/{p0}") as ws0, \
         client.websocket_connect(f"/ws/{lobby_id}/{p1}") as ws1:
        for ws in (ws0, ws1):
            drain_until(ws, "lobby_update")
    # Both WS closed — but lobby survives because both disconnected simultaneously;
    # re-join Bob to keep lobby alive, then check Alice's reconnect
    # Actually: lobby is deleted when all disconnect. Use nested context instead.

    # Re-run: keep Bob's WS open while Alice disconnects and reconnects
    lobby_id = client.post("/lobby/create").json()["lobby_id"]
    p0 = client.post(f"/lobby/{lobby_id}/join", json={"name": "Alice"}).json()["player_id"]
    p1 = client.post(f"/lobby/{lobby_id}/join", json={"name": "Bob"}).json()["player_id"]

    with client.websocket_connect(f"/ws/{lobby_id}/{p1}") as ws_bob:
        drain_until(ws_bob, "lobby_update")
        with client.websocket_connect(f"/ws/{lobby_id}/{p0}") as ws_alice:
            drain_until(ws_alice, "lobby_update")
            drain_until(ws_bob, "lobby_update")
        # Alice's WS closed; Bob still open → lobby alive
        drain_until(ws_bob, "lobby_update")  # disconnect broadcast

        reconnect_id = client.post(f"/lobby/{lobby_id}/join", json={"name": "Alice"}).json()["player_id"]
        assert reconnect_id == p0


def test_reconnect_preserves_player_hp(client):
    """Reconnecting player's HP must survive the disconnect/reconnect cycle."""
    from backend.main import _engines
    lobby_id = client.post("/lobby/create").json()["lobby_id"]
    p0 = client.post(f"/lobby/{lobby_id}/join", json={"name": "Alice"}).json()["player_id"]
    p1 = client.post(f"/lobby/{lobby_id}/join", json={"name": "Bob"}).json()["player_id"]

    with client.websocket_connect(f"/ws/{lobby_id}/{p1}") as ws_bob:
        drain_until(ws_bob, "lobby_update")
        with client.websocket_connect(f"/ws/{lobby_id}/{p0}") as ws_alice:
            drain_until(ws_alice, "lobby_update")
            drain_until(ws_bob, "lobby_update")
            # Damage Alice while she's connected
            _engines[lobby_id].lobby.players[p0].hp = 1
        # Alice disconnects; Bob's WS keeps the lobby alive
        drain_until(ws_bob, "lobby_update")

        reconnect_id = client.post(f"/lobby/{lobby_id}/join", json={"name": "Alice"}).json()["player_id"]
        assert reconnect_id == p0

        with client.websocket_connect(f"/ws/{lobby_id}/{reconnect_id}") as ws_alice2:
            lu = drain_until(ws_alice2, "lobby_update")
            player_data = next(p for p in lu["players"] if p["id"] == reconnect_id)
            assert player_data["hp"] == 1


def test_new_player_appears_disconnected_until_ws_connects(client):
    """Player added via REST must be is_connected=False until WS handshake completes."""
    lobby_id = client.post("/lobby/create").json()["lobby_id"]
    p0 = client.post(f"/lobby/{lobby_id}/join", json={"name": "Alice"}).json()["player_id"]
    p1 = client.post(f"/lobby/{lobby_id}/join", json={"name": "Bob"}).json()["player_id"]

    with client.websocket_connect(f"/ws/{lobby_id}/{p0}") as ws0:
        # First lobby_update: p0 just connected; p1 has not connected WS yet
        lu = drain_until(ws0, "lobby_update")
        bob = next(p for p in lu["players"] if p["id"] == p1)
        assert bob["is_connected"] is False

        # Bob connects WS — new broadcast shows him as connected
        with client.websocket_connect(f"/ws/{lobby_id}/{p1}") as ws1:
            lu2 = drain_until(ws0, "lobby_update")
            bob2 = next(p for p in lu2["players"] if p["id"] == p1)
            assert bob2["is_connected"] is True


# --- Disconnect / hint skipping ---

def test_skipped_hint_broadcast_on_disconnect(client):
    """When the active hint player disconnects, all others receive hint_received for them."""
    from backend.main import _engines
    lobby_id, player_ids = _setup_lobby(client, num_players=3)

    wss = [client.websocket_connect(f"/ws/{lobby_id}/{pid}") for pid in player_ids]
    opened = [ws.__enter__() for ws in wss]
    wss_by_id = dict(zip(player_ids, opened))

    try:
        for ws in opened:
            drain_until(ws, "lobby_update")
        opened[0].send_json({"type": "start_game"})
        for ws in opened:
            drain_until(ws, "role_assigned")
            drain_until(ws, "round_start")

        engine = _engines[lobby_id]
        first_pid = engine.state.round_state.turn_order[0]
        others = [pid for pid in player_ids if pid != first_pid]

        # Disconnect the first-turn player by closing their WS
        wss_by_id[first_pid].__exit__(None, None, None)

        # Remaining players should each receive a hint_received for the disconnected player
        for pid in others:
            hint_msg = drain_until(wss_by_id[pid], "hint_received")
            assert hint_msg["player_id"] == first_pid
            assert hint_msg["text"] == ""
    finally:
        for pid, ws in list(wss_by_id.items()):
            if pid != first_pid:
                try:
                    ws.__exit__(None, None, None)
                except Exception:
                    pass


def test_turn_advances_after_disconnect_skip(client):
    """After a disconnected player's hint is skipped, the next player's turn is active."""
    from backend.main import _engines
    lobby_id, player_ids = _setup_lobby(client, num_players=3)

    wss = [client.websocket_connect(f"/ws/{lobby_id}/{pid}") for pid in player_ids]
    opened = [ws.__enter__() for ws in wss]
    wss_by_id = dict(zip(player_ids, opened))

    try:
        for ws in opened:
            drain_until(ws, "lobby_update")
        opened[0].send_json({"type": "start_game"})
        for ws in opened:
            drain_until(ws, "role_assigned")
            drain_until(ws, "round_start")

        engine = _engines[lobby_id]
        turn_order = engine.state.round_state.turn_order
        first_pid  = turn_order[0]
        second_pid = turn_order[1]

        # Disconnect the first player
        wss_by_id[first_pid].__exit__(None, None, None)

        # Drain the skip broadcast on one of the remaining clients
        remaining_pid = next(pid for pid in player_ids if pid != first_pid)
        drain_until(wss_by_id[remaining_pid], "hint_received")

        # It should now be the second player's turn in the engine
        assert engine.state.round_state.current_player_id() == second_pid
    finally:
        for pid, ws in list(wss_by_id.items()):
            if pid != first_pid:
                try:
                    ws.__exit__(None, None, None)
                except Exception:
                    pass


def test_ghost_does_not_receive_role_assigned_on_endgame_start(client):
    """Ghost players must NOT receive role_assigned when the endgame begins.

    The frontend relies on this: if a ghost was previously a morp who went first
    (and therefore has halfBoard state), role_assigned would clear it automatically.
    Since ghosts don't get that message, the frontend must clear halfBoard itself
    when it receives endgame_round_start. This test documents that invariant so
    any future backend change that accidentally sends role_assigned to ghosts is caught.
    """
    from backend.main import _engines
    lobby_id, player_ids = _setup_lobby(client, num_players=3)

    with client.websocket_connect(f"/ws/{lobby_id}/{player_ids[0]}") as ws0, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[1]}") as ws1, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[2]}") as ws2:

        wss = [ws0, ws1, ws2]
        wss_by_id = dict(zip(player_ids, wss))

        for ws in wss:
            drain_until(ws, "lobby_update")
        ws0.send_json({"type": "start_game", "timers_enabled": False})

        role_msgs = {pid: drain_until(wss_by_id[pid], "role_assigned") for pid in player_ids}
        for pid in player_ids:
            drain_until(wss_by_id[pid], "round_start")

        morp_id  = next(pid for pid, rm in role_msgs.items() if rm["role"] == "morp")
        safe_ids = [pid for pid, rm in role_msgs.items() if rm["role"] == "safe"]

        engine = _engines[lobby_id]
        for pid in engine.state.round_state.turn_order:
            wss_by_id[pid].send_json({"type": "submit_hint", "text": "hint"})
            for ws in wss:
                drain_until(ws, "hint_received")
        for ws in wss:
            drain_until(ws, "voting_open")

        # Vote to accuse a safe player
        for pid in player_ids:
            target = safe_ids[0] if pid != safe_ids[0] else safe_ids[1]
            wss_by_id[pid].send_json({"type": "submit_votes", "accused_ids": [target]})
        for ws in wss:
            drain_until(ws, "accusation_result")

        # Set surviving safe player to 1 HP so damage eliminates them → endgame
        engine.lobby.players[safe_ids[1]].hp = 1
        wss_by_id[morp_id].send_json({"type": "morp_deal_damage", "target_id": safe_ids[1]})
        for ws in wss:
            drain_until(ws, "damage_dealt")
            drain_until(ws, "lobby_update")

        # The eliminated player (safe_ids[1]) is now a ghost.
        # Collect every message from their websocket up to and including endgame_round_start.
        ghost_ws = wss_by_id[safe_ids[1]]
        msgs_before_endgame = collect_until(ghost_ws, "endgame_round_start")
        msg_types = [m["type"] for m in msgs_before_endgame]

        # The ghost must NOT receive role_assigned — the frontend must clear halfBoard itself.
        assert "role_assigned" not in msg_types
        assert msg_types[-1] == "endgame_round_start"


def test_game_starts_cleanly_with_pre_start_disconnect(client):
    """Game must start without crashing when a lobby player never connected (role=None).

    Regression test for: _broadcast_round_start iterating active_players() and calling
    player.role.value on a disconnected player whose role was cleared to None.
    """
    lobby_id, player_ids = _setup_lobby(client, num_players=4)
    # player_ids[3] joins via REST but never connects a WebSocket → is_connected=False, role=None
    with client.websocket_connect(f"/ws/{lobby_id}/{player_ids[0]}") as ws0, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[1]}") as ws1, \
         client.websocket_connect(f"/ws/{lobby_id}/{player_ids[2]}") as ws2:

        wss = [ws0, ws1, ws2]
        for ws in wss:
            drain_until(ws, "lobby_update")

        ws0.send_json({"type": "start_game"})

        # All three connected players must receive role_assigned and round_start
        for ws in wss:
            role_msg = drain_until(ws, "role_assigned")
            assert role_msg["role"] in ("safe", "morp")

        for ws in wss:
            round_msg = drain_until(ws, "round_start")
            # Disconnected player must be excluded from the turn order
            assert player_ids[3] not in round_msg["turn_order"]
