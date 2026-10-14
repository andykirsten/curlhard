from pydantic import BaseModel


class AppConfigRead(BaseModel):
    kliment_mode: bool


class AppConfigUpdate(BaseModel):
    kliment_mode: bool
