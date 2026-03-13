"""Unit tests for ConnectionManager send/broadcast error handling."""
import asyncio
import logging
from unittest.mock import AsyncMock, patch

import pytest

from backend.connection_manager import ConnectionManager


def _run(coro):
    return asyncio.run(coro)


# ── send ──────────────────────────────────────────────────────────────────────

def test_send_to_missing_player_does_nothing():
    """send() with no registered socket should silently no-op."""
    cm = ConnectionManager()
    _run(cm.send("lobby1", "p0", {"type": "test"}))  # no exception


def test_send_logs_warning_on_failure(caplog):
    """send() should log a warning when the underlying WebSocket raises."""
    cm = ConnectionManager()
    bad_ws = AsyncMock()
    bad_ws.send_json.side_effect = RuntimeError("connection lost")
    cm._connections["lobby1"] = {"p0": bad_ws}

    with caplog.at_level(logging.WARNING, logger="backend.connection_manager"):
        _run(cm.send("lobby1", "p0", {"type": "test"}))

    assert any("connection lost" in r.message for r in caplog.records)


def test_send_does_not_raise_on_failure():
    """send() must swallow the exception so callers stay unaffected."""
    cm = ConnectionManager()
    bad_ws = AsyncMock()
    bad_ws.send_json.side_effect = RuntimeError("connection lost")
    cm._connections["lobby1"] = {"p0": bad_ws}

    _run(cm.send("lobby1", "p0", {"type": "test"}))  # no exception raised


# ── broadcast ─────────────────────────────────────────────────────────────────

def test_broadcast_logs_warning_for_failed_socket(caplog):
    """broadcast() should log a warning for each socket that raises."""
    cm = ConnectionManager()
    good_ws = AsyncMock()
    bad_ws = AsyncMock()
    bad_ws.send_json.side_effect = RuntimeError("broken pipe")
    cm._connections["lobby1"] = {"p0": good_ws, "p1": bad_ws}

    with caplog.at_level(logging.WARNING, logger="backend.connection_manager"):
        _run(cm.broadcast("lobby1", {"type": "test"}))

    assert any("broken pipe" in r.message for r in caplog.records)


def test_broadcast_delivers_to_healthy_sockets_despite_failure():
    """A broken socket must not prevent delivery to other connected players."""
    cm = ConnectionManager()
    good_ws = AsyncMock()
    bad_ws = AsyncMock()
    bad_ws.send_json.side_effect = RuntimeError("broken pipe")
    cm._connections["lobby1"] = {"p0": good_ws, "p1": bad_ws}

    _run(cm.broadcast("lobby1", {"type": "test"}))

    good_ws.send_json.assert_called_once_with({"type": "test"})
