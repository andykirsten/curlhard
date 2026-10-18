from typing import Literal

from pydantic import BaseModel, Field

LoadTypeLit = Literal["weight", "bodyweight", "assisted", "time"]


class NamedCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class NamedUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)


class NamedRead(BaseModel):
    id: int
    name: str


class ExerciseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    primary_muscle_group_id: int | None = None
    secondary_muscle_group_ids: list[int] = []
    equipment_id: int | None = None
    load_type: LoadTypeLit = "weight"
    is_global: bool = False


class ExerciseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    primary_muscle_group_id: int | None = None
    secondary_muscle_group_ids: list[int] | None = None
    equipment_id: int | None = None
    load_type: LoadTypeLit | None = None
    is_active: bool | None = None


class ExerciseRead(BaseModel):
    id: int
    name: str
    description: str
    owner_user_id: int | None
    is_global: bool
    primary_muscle_group_id: int | None
    secondary_muscle_group_ids: list[int]
    equipment_id: int | None
    load_type: str
    is_active: bool


class NoteUpdate(BaseModel):
    note: str = Field(max_length=4000)


class NoteRead(BaseModel):
    exercise_id: int
    note: str


class ExerciseSettingUpdate(BaseModel):
    #: None setzt auf den Standard des Equipments zurück
    bar_weight_kg: float | None = Field(default=None, ge=0, le=100)


class ExerciseSettingRead(BaseModel):
    exercise_id: int
    #: Eigener Wert des Users, None = nicht gesetzt
    bar_weight_kg: float | None
    #: Standard aus dem Equipment (Langhantel 20 kg, SZ-Stange 10 kg), sonst None
    default_bar_weight_kg: float | None
