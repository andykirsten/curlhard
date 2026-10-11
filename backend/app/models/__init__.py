from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import Index, UniqueConstraint
from sqlmodel import Field, SQLModel

Role = Literal["user", "admin"]
LoadType = Literal["weight", "bodyweight", "assisted", "time"]


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(SQLModel):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow, sa_column_kwargs={"onupdate": utcnow})


class User(Base, table=True):
    __tablename__ = "user"
    email: str = Field(unique=True, index=True)
    password_hash: str
    display_name: str
    role: str = "user"
    is_active: bool = True
    body_weight_kg: float | None = None


class AuthSession(Base, table=True):
    __tablename__ = "auth_session"
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE", index=True)
    token_hash: str = Field(unique=True, index=True)
    expires_at: datetime


class MuscleGroup(Base, table=True):
    __tablename__ = "muscle_group"
    name: str = Field(unique=True)


class Equipment(Base, table=True):
    __tablename__ = "equipment"
    name: str = Field(unique=True)


class Exercise(Base, table=True):
    __tablename__ = "exercise"
    __table_args__ = (UniqueConstraint("owner_user_id", "name"),)
    name: str
    description: str = ""
    owner_user_id: int | None = Field(default=None, foreign_key="user.id", index=True)
    primary_muscle_group_id: int | None = Field(default=None, foreign_key="muscle_group.id")
    equipment_id: int | None = Field(default=None, foreign_key="equipment.id")
    load_type: str = "weight"
    is_active: bool = True


class ExerciseSecondaryMuscle(Base, table=True):
    __tablename__ = "exercise_secondary_muscle"
    exercise_id: int = Field(foreign_key="exercise.id", ondelete="CASCADE", index=True)
    muscle_group_id: int = Field(foreign_key="muscle_group.id")


class InviteCode(Base, table=True):
    __tablename__ = "invite_code"
    code_hash: str = Field(unique=True, index=True)
    created_by_user_id: int = Field(foreign_key="user.id", ondelete="CASCADE")
    expires_at: datetime
    used_by_user_id: int | None = Field(default=None, foreign_key="user.id", ondelete="SET NULL")
    used_at: datetime | None = None


class Plan(Base, table=True):
    __tablename__ = "plan"
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE", index=True)
    name: str
    description: str = ""
    is_active: bool = False


class PlanDay(Base, table=True):
    __tablename__ = "plan_day"
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE", index=True)
    plan_id: int = Field(foreign_key="plan.id", ondelete="CASCADE", index=True)
    name: str
    weekday: int | None = None
    position: int = 0


class PlanExercise(Base, table=True):
    __tablename__ = "plan_exercise"
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE", index=True)
    plan_day_id: int = Field(foreign_key="plan_day.id", ondelete="CASCADE", index=True)
    exercise_id: int = Field(foreign_key="exercise.id", ondelete="RESTRICT")
    position: int = 0
    target_sets: int = 3
    target_reps_min: int = 8
    target_reps_max: int = 12
    target_rest_sec: int = 90
    note: str = ""


class WorkoutSession(Base, table=True):
    __tablename__ = "workout_session"
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE", index=True)
    plan_day_id: int | None = Field(default=None, foreign_key="plan_day.id", ondelete="SET NULL")
    started_at: datetime = Field(default_factory=utcnow, index=True)
    finished_at: datetime | None = None
    note: str = ""


class SessionExercise(Base, table=True):
    __tablename__ = "session_exercise"
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE", index=True)
    session_id: int = Field(foreign_key="workout_session.id", ondelete="CASCADE", index=True)
    exercise_id: int = Field(foreign_key="exercise.id", ondelete="RESTRICT")
    position: int = 0
    note: str = ""


class SetLog(Base, table=True):
    __tablename__ = "set_log"
    __table_args__ = (
        Index("ix_set_log_user_exercise_completed", "user_id", "exercise_id", "completed_at"),
    )
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE")
    exercise_id: int = Field(foreign_key="exercise.id", ondelete="RESTRICT")
    session_exercise_id: int = Field(
        foreign_key="session_exercise.id", ondelete="CASCADE", index=True
    )
    set_number: int = 1
    reps: int = 0
    weight_kg: float = 0.0
    rest_sec: int | None = None
    rpe: float | None = None
    is_warmup: bool = False
    completed_at: datetime = Field(default_factory=utcnow)


class ExerciseNote(Base, table=True):
    __tablename__ = "exercise_note"
    __table_args__ = (UniqueConstraint("user_id", "exercise_id"),)
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE")
    exercise_id: int = Field(foreign_key="exercise.id", ondelete="CASCADE")
    note: str = ""
