from typing import Literal

from pydantic import BaseModel

KlimentIntensity = Literal["selten", "normal", "oft"]


class AppConfigRead(BaseModel):
    kliment_mode: bool
    kliment_intensity: KlimentIntensity


class AppConfigUpdate(BaseModel):
    """Nicht gesetzte Felder bleiben unverändert."""

    kliment_mode: bool | None = None
    kliment_intensity: KlimentIntensity | None = None
