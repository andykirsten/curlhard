from pydantic import BaseModel, ConfigDict, Field


class PlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""


class PlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    is_public: bool | None = None


class PlanDayCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    weekday: int | None = Field(default=None, ge=0, le=6)


class PlanDayUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    weekday: int | None = Field(default=None, ge=0, le=6)


class PlanExerciseCreate(BaseModel):
    exercise_id: int
    target_sets: int = Field(default=3, ge=1, le=20)
    target_reps_min: int = Field(default=8, ge=1, le=100)
    target_reps_max: int = Field(default=12, ge=1, le=100)
    target_rest_sec: int = Field(default=90, ge=0, le=3600)
    note: str = ""


class PlanExerciseUpdate(BaseModel):
    exercise_id: int | None = None
    target_sets: int | None = Field(default=None, ge=1, le=20)
    target_reps_min: int | None = Field(default=None, ge=1, le=100)
    target_reps_max: int | None = Field(default=None, ge=1, le=100)
    target_rest_sec: int | None = Field(default=None, ge=0, le=3600)
    note: str | None = None


class OrderUpdate(BaseModel):
    ids: list[int]


class PlanExerciseRead(BaseModel):
    id: int
    plan_day_id: int
    exercise_id: int
    position: int
    target_sets: int
    target_reps_min: int
    target_reps_max: int
    target_rest_sec: int
    note: str


class PlanDayRead(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)
    id: int
    plan_id: int
    name: str
    weekday: int | None
    position: int
    exercises: list[PlanExerciseRead] = []


class PlanRead(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)
    id: int
    name: str
    description: str
    is_active: bool
    is_public: bool = False
    days: list[PlanDayRead] = []


class AuthorRead(BaseModel):
    id: int
    display_name: str
    avatar_url: str | None


class PublicPlanDaySummary(BaseModel):
    name: str
    weekday: int | None
    exercise_count: int


class PublicPlanSummary(BaseModel):
    id: int
    name: str
    description: str
    author: AuthorRead
    day_count: int
    exercise_count: int
    days: list[PublicPlanDaySummary]


class PublicPlanRead(PlanRead):
    author: AuthorRead
    # Übungsnamen inkl. privater Übungen des Autors (für die Leseansicht)
    exercise_names: dict[str, str]
