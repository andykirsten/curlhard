from datetime import date

from pydantic import BaseModel, Field


class CycleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    note: str = Field(default="", max_length=2000)
    start_date: date
    end_date: date | None = None
    plan_id: int | None = None
    activate: bool = True


class CycleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    note: str | None = Field(default=None, max_length=2000)
    start_date: date | None = None
    end_date: date | None = None
    plan_id: int | None = None


class CycleEnd(BaseModel):
    end_date: date | None = None


class CycleRead(BaseModel):
    id: int
    name: str
    note: str
    start_date: date
    end_date: date | None
    plan_id: int | None
    plan_name: str | None
    is_active: bool
    session_count: int
