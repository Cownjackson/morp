import asyncio
import logging
from fastapi import WebSocket

log = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # lobby_id -> {player_id -> WebSocket}
        self._connections: dict[str, dict[str, WebSocket]] = {}

    def connect(self, lobby_id: str, player_id: str, websocket: WebSocket) -> None:
        self._connections.setdefault(lobby_id, {})[player_id] = websocket

    def disconnect(self, lobby_id: str, player_id: str) -> None:
        lobby = self._connections.get(lobby_id, {})
        lobby.pop(player_id, None)
        if not lobby:
            self._connections.pop(lobby_id, None)

    async def send(self, lobby_id: str, player_id: str, message: dict) -> None:
        ws = self._connections.get(lobby_id, {}).get(player_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception as exc:
                log.warning("send failed lobby=%s player=%s: %s", lobby_id, player_id, exc)

    async def broadcast(self, lobby_id: str, message: dict) -> None:
        tasks = [
            ws.send_json(message)
            for ws in self._connections.get(lobby_id, {}).values()
        ]
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for exc in results:
                if isinstance(exc, Exception):
                    log.warning("broadcast failed lobby=%s: %s", lobby_id, exc)

    async def broadcast_all(self, message: dict) -> None:
        for lobby_id in list(self._connections.keys()):
            await self.broadcast(lobby_id, message)
