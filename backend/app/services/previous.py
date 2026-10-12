"""Vergleichswerte „Letztes Mal“: Sätze einer Übung aus dem vorherigen Training."""

from dataclasses import dataclass, field
from datetime import datetime

from sqlmodel import Session, col, select

from app.models import SessionExercise, SetLog, WorkoutSession


@dataclass
class PreviousSets:
    session_id: int | None = None
    started_at: datetime | None = None
    #: True, wenn die Sätze aus einer Session desselben Plantags stammen
    same_plan_day: bool = False
    sets: list[SetLog] = field(default_factory=list)


def _latest_session_exercise(
    db: Session,
    user_id: int,
    exercise_id: int,
    *,
    before: datetime | None,
    exclude_session_id: int | None,
    plan_day_id: int | None,
) -> tuple[int, int, datetime] | None:
    """Neueste Session-Übung mit mindestens einem Satz: (se_id, session_id, started_at)."""
    stmt = (
        select(SessionExercise.id, WorkoutSession.id, WorkoutSession.started_at)
        .join(WorkoutSession, WorkoutSession.id == SessionExercise.session_id)  # type: ignore[arg-type]
        .where(
            SessionExercise.user_id == user_id,
            WorkoutSession.user_id == user_id,
            SessionExercise.exercise_id == exercise_id,
            col(SessionExercise.id).in_(
                select(SetLog.session_exercise_id).where(SetLog.user_id == user_id)
            ),
        )
    )
    if before is not None:
        stmt = stmt.where(WorkoutSession.started_at < before)
    if exclude_session_id is not None:
        stmt = stmt.where(WorkoutSession.id != exclude_session_id)
    if plan_day_id is not None:
        stmt = stmt.where(WorkoutSession.plan_day_id == plan_day_id)
    row = db.exec(
        stmt.order_by(
            col(WorkoutSession.started_at).desc(),
            col(WorkoutSession.id).desc(),
            col(SessionExercise.position),
        ).limit(1)
    ).first()
    return (row[0], row[1], row[2]) if row else None  # type: ignore[return-value]


def last_sets_for(
    db: Session,
    user_id: int,
    exercise_id: int,
    *,
    before: datetime | None = None,
    exclude_session_id: int | None = None,
    plan_day_id: int | None = None,
) -> PreviousSets:
    """Sätze des letzten Trainings dieser Übung.

    Bevorzugt das letzte Training desselben Plantags; gibt es dort keine Sätze (oder keinen
    Plantag), wird auf die letzte beliebige Session mit dieser Übung zurückgegriffen.
    """
    hit = None
    same_day = False
    if plan_day_id is not None:
        hit = _latest_session_exercise(
            db,
            user_id,
            exercise_id,
            before=before,
            exclude_session_id=exclude_session_id,
            plan_day_id=plan_day_id,
        )
        same_day = hit is not None
    if hit is None:
        hit = _latest_session_exercise(
            db,
            user_id,
            exercise_id,
            before=before,
            exclude_session_id=exclude_session_id,
            plan_day_id=None,
        )
    if hit is None:
        return PreviousSets()
    se_id, session_id, started_at = hit
    sets = db.exec(
        select(SetLog)
        .where(SetLog.user_id == user_id, SetLog.session_exercise_id == se_id)
        .order_by(SetLog.set_number, SetLog.id)
    ).all()
    return PreviousSets(
        session_id=session_id, started_at=started_at, same_plan_day=same_day, sets=list(sets)
    )
