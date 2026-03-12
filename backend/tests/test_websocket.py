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
