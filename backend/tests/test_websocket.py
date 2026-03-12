"""Integration tests for the WebSocket + REST API layer.

Uses Starlette's synchronous TestClient which supports both HTTP and WebSocket.
"""
import json
import pytest
from starlette.testclient import TestClient

from backend.main import app


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
