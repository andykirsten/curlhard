from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class BestSet(BaseModel):
    reps: int
    weight_kg: float


class SessionMetrics(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)
    session_id: int
    date: datetime
    volume: float | None
    best_set: BestSet
    e1rm: float | None
    nrm: dict[int, float]
    duration_sec: int | None = None


class HistoryPoint(SessionMetrics):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)
    value: float | None = None


class SummaryRead(BaseModel):
    exercise_id: int
    load_type: str
    e1rm: float | None
    nrm: dict[int, float]
    change_4w_pct: float | None
    change_12w_pct: float | None
    session_count: int
    last_session: SessionMetrics | None


class HistoryRead(BaseModel):
    exercise_id: int
    metric: str
    points: list[HistoryPoint]


class RecordRow(BaseModel):
    reps: int
    weight_kg: float | None
    achieved_reps: int | None
    date: datetime | None


class RecordsRead(BaseModel):
    exercise_id: int
    records: list[RecordRow]


class WeekOverview(BaseModel):
    week_start: date
    volume: float
    sessions: int
    by_muscle_group: dict[int, float]


class OverviewRead(BaseModel):
    weeks: list[WeekOverview]


class LastSet(BaseModel):
    reps: int
    weight_kg: float
    is_warmup: bool
    rpe: float | None


class TodayExercise(BaseModel):
    plan_exercise_id: int
    exercise_id: int
    name: str
    load_type: str
    target_sets: int
    target_reps_min: int
    target_reps_max: int
    target_rest_sec: int
    note: str
    permanent_note: str
    last_sets: list[LastSet]


class TodayDay(BaseModel):
    id: int
    name: str
    weekday: int | None
    exercises: list[TodayExercise]


class DayRef(BaseModel):
    id: int
    name: str
    weekday: int | None


class PlanRef(BaseModel):
    id: int
    name: str


class TodayRead(BaseModel):
    plan: PlanRef | None
    day: TodayDay | None
    other_days: list[DayRef]
