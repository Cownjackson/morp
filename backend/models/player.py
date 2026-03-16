from enum import Enum
from pydantic import BaseModel, Field


class Role(str, Enum):
    SAFE = "safe"
    MORP = "morp"


class PlayerCosmetics(BaseModel):
    color: str = "trumskin"
    hat: str = "none"
    eyes: str = "eyes"
    face: str = "none"
    accessory: str = "none"


class Player(BaseModel):
    id: str
    name: str
    hp: int = 3
    role: Role | None = None
    is_ghost: bool = False
    is_connected: bool = True
    cosmetics: PlayerCosmetics = Field(default_factory=PlayerCosmetics)

    def is_active(self) -> bool:
        """Active means alive and in the game."""
        return not self.is_ghost

    def take_damage(self, amount: int = 1) -> None:
        self.hp = max(0, self.hp - amount)
        if self.hp == 0:
            self.is_ghost = True
