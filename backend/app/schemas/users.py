from pydantic import BaseModel


class OnlineUserRead(BaseModel):
    id: int
    display_name: str
    avatar_url: str | None
    is_training: bool
