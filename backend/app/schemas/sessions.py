from datetime import datetime

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


class SessionCreate(BaseModel):
    plan_day_id: int | None = None
    started_at: AwareDatetime | None = None


class SessionUpdate(BaseModel):
    note: str | None = None
    started_at: AwareDatetime | None = None
    finished_at: AwareDatetime | None = None


class SessionExerciseCreate(BaseModel):
    exercise_id: int


class SessionExerciseUpdate(BaseModel):
    note: str | None = None
    position: int | None = Field(default=None, ge=0)


class SetCreate(BaseModel):
    reps: int = Field(ge=0, le=1000)
    weight_kg: float = Field(default=0, ge=0, le=2000)
    set_number: int | None = Field(default=None, ge=1)
    rest_sec: int | None = Field(default=None, ge=0, le=7200)
    rpe: float | None = Field(default=None, ge=1, le=10)
    is_warmup: bool = False
    completed_at: AwareDatetime | None = None


class SetUpdate(BaseModel):
    reps: int | None = Field(default=None, ge=0, le=1000)
    weight_kg: float | None = Field(default=None, ge=0, le=2000)
    set_number: int | None = Field(default=None, ge=1)
    rest_sec: int | None = Field(default=None, ge=0, le=7200)
    rpe: float | None = Field(default=None, ge=1, le=10)
    is_warmup: bool | None = None
    completed_at: AwareDatetime | None = None


class SetRead(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)
    id: int
    session_exercise_id: int
    exercise_id: int
    set_number: int
    reps: int
    weight_kg: float
    rest_sec: int | None
    rpe: float | None
    is_warmup: bool
    completed_at: datetime
    records: list[int] = []


class SessionExerciseRead(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)
    id: int
    session_id: int
    exercise_id: int
    position: int
    note: str
    sets: list[SetRead] = []


class SessionRead(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)
    id: int
    plan_day_id: int | None
    started_at: datetime
    finished_at: datetime | None
    note: str
    exercises: list[SessionExerciseRead] = []


class SessionSummary(BaseModel):
    id: int
    plan_day_id: int | None
    started_at: datetime
    finished_at: datetime | None
    note: str
    exercise_count: int
    set_count: int
