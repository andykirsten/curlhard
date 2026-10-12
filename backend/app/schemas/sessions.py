from datetime import datetime

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.schemas.stats import LastSet


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
    cycle_id: int | None = None
    cycle_name: str | None = None
    exercises: list[SessionExerciseRead] = []


class PreviousExercise(BaseModel):
    """Vergleichswerte einer Übung der Session aus dem vorherigen Training."""

    model_config = ConfigDict(json_schema_serialization_defaults_required=True)
    exercise_id: int
    #: Ziele aus dem Plantag der Session; None ohne Plantag oder für außerplanmäßige Übungen
    target_sets: int | None = None
    target_rest_sec: int | None = None
    source_session_id: int | None = None
    source_started_at: datetime | None = None
    #: False = Rückgriff auf eine beliebige Session (kein früheres Training dieses Plantags)
    same_plan_day: bool = False
    sets: list[LastSet] = []


class SessionPrevious(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)
    plan_day_name: str | None = None
    exercises: list[PreviousExercise] = []


class SessionSummary(BaseModel):
    id: int
    plan_day_id: int | None
    started_at: datetime
    finished_at: datetime | None
    note: str
    cycle_id: int | None = None
    cycle_name: str | None = None
    exercise_count: int
    set_count: int
