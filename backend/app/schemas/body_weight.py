from datetime import date

from pydantic import BaseModel, Field


class BodyWeightCreate(BaseModel):
    #: Standard: heute; Einträge in der Zukunft sind nicht erlaubt
    measured_on: date | None = None
    weight_kg: float = Field(gt=0, le=700)


class BodyWeightRead(BaseModel):
    id: int
    measured_on: date
    weight_kg: float
