import asyncio
from fastapi import WebSocket


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
            except Exception:
                pass

    async def broadcast(self, lobby_id: str, message: dict) -> None:
        tasks = [
            ws.send_json(message)
            for ws in self._connections.get(lobby_id, {}).values()
        ]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
