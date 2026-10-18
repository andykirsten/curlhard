from datetime import date, datetime
from typing import Literal

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
    working_sets: int = 0
    max_rpe: float | None = None
    avg_rpe: float | None = None
    max_reps: int | None = None


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
    weekdays: list[int]
    exercises: list[TodayExercise]


class DayRef(BaseModel):
    id: int
    name: str
    weekdays: list[int]


class PlanRef(BaseModel):
    id: int
    name: str


class CycleRef(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: date | None


class TodayRead(BaseModel):
    plan: PlanRef | None
    day: TodayDay | None
    other_days: list[DayRef]
    cycle: CycleRef | None = None


class RepProfilePoint(BaseModel):
    reps: int
    actual_kg: float | None
    actual_date: datetime | None
    estimated_kg: float


class PrEvent(BaseModel):
    date: datetime
    session_id: int
    kind: Literal["e1rm", "nrm", "reps"]
    reps: int | None
    value: float


class RepRanges(BaseModel):
    strength: int
    hypertrophy: int
    endurance: int


class WeeklyPoint(BaseModel):
    week_start: date
    volume: float
    working_sets: int
    sessions: int


class Lifetime(BaseModel):
    total_volume: float | None
    total_sessions: int
    total_working_sets: int
    heaviest_set: BestSet | None
    most_reps: int | None
    best_session_volume: float | None
    avg_sessions_per_week: float | None
    days_since_last: int | None
    longest_hold_sec: int | None
    total_time_sec: int | None


class InsightsRead(BaseModel):
    exercise_id: int
    load_type: str
    rep_profile: list[RepProfilePoint]
    pr_events: list[PrEvent]
    rep_ranges: RepRanges
    weekly: list[WeeklyPoint]
    lifetime: Lifetime
    plateau_weeks: int | None
    training_days: list[date]


class PrMark(BaseModel):
    kind: Literal["e1rm", "nrm", "reps"]
    reps: int | None


class LogSet(BaseModel):
    set_number: int
    reps: int
    weight_kg: float
    rpe: float | None
    is_warmup: bool
    records: list[PrMark]


class LogSession(BaseModel):
    session_id: int
    started_at: datetime
    plan_day_name: str | None
    cycle_name: str | None
    note: str
    sets: list[LogSet]
    metrics: SessionMetrics | None
    e1rm_delta_pct: float | None


class LogRead(BaseModel):
    exercise_id: int
    load_type: str
    items: list[LogSession]
    next_before: datetime | None
