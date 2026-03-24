from pydantic import BaseModel, Field
from .player import Player


class LobbyConfig(BaseModel):
    num_morps: int = 1
    max_players: int = 10
    timers_enabled: bool = True
    drawing_hints: bool = False
    hint_timer_duration: int = 60


class Lobby(BaseModel):
    id: str
    host_id: str
    players: dict[str, Player] = Field(default_factory=dict)
    config: LobbyConfig = Field(default_factory=LobbyConfig)
    started: bool = False

    def active_players(self) -> list[Player]:
        return [p for p in self.players.values() if p.is_active()]

    def ghost_players(self) -> list[Player]:
        return [p for p in self.players.values() if p.is_ghost]

    def can_start(self) -> bool:
        return len(self.players) >= 3 and not self.started
