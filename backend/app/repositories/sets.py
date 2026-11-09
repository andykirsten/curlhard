from datetime import datetime

from sqlmodel import Session, select

from app.models import Exercise, SessionExercise, SetLog
from app.services.stats import SetData


def load_all_sets(
    db: Session, user_id: int, since: datetime | None = None
) -> dict[int, tuple[str, str, list[SetData]]]:
    """Alle Sätze des Users, gruppiert nach Übung: ID → (Name, Lasttyp, Sätze)."""
    stmt = (
        select(SetLog, SessionExercise.session_id, Exercise)
        .join(SessionExercise, SessionExercise.id == SetLog.session_exercise_id)  # type: ignore[arg-type]
        .join(Exercise, Exercise.id == SetLog.exercise_id)  # type: ignore[arg-type]
        .where(SetLog.user_id == user_id)
        .order_by(SetLog.completed_at)  # type: ignore[arg-type]
    )
    if since is not None:
        stmt = stmt.where(SetLog.completed_at >= since)  # type: ignore[arg-type]
    out: dict[int, tuple[str, str, list[SetData]]] = {}
    for s, session_id, ex in db.exec(stmt).all():
        out.setdefault(ex.id, (ex.name, ex.load_type, []))[2].append(  # type: ignore[arg-type]
            SetData(
                session_id=session_id,
                date=s.completed_at,
                reps=s.reps,
                weight_kg=s.weight_kg,
                is_warmup=s.is_warmup,
                rpe=s.rpe,
                set_id=s.id,  # type: ignore[arg-type]
                set_number=s.set_number,
                set_type=s.set_type,
            )
        )
    return out


def load_sets(
    db: Session,
    user_id: int,
    exercise_id: int,
    start: datetime | None = None,
    end: datetime | None = None,
    exclude_set_id: int | None = None,
) -> list[SetData]:
    stmt = (
        select(SetLog, SessionExercise.session_id)
        .join(SessionExercise, SessionExercise.id == SetLog.session_exercise_id)  # type: ignore[arg-type]
        .where(SetLog.user_id == user_id, SetLog.exercise_id == exercise_id)
        .order_by(SetLog.completed_at)  # type: ignore[arg-type]
    )
    if start is not None:
        stmt = stmt.where(SetLog.completed_at >= start)  # type: ignore[arg-type]
    if end is not None:
        stmt = stmt.where(SetLog.completed_at <= end)  # type: ignore[arg-type]
    if exclude_set_id is not None:
        stmt = stmt.where(SetLog.id != exclude_set_id)
    return [
        SetData(
            session_id=session_id,
            date=s.completed_at,
            reps=s.reps,
            weight_kg=s.weight_kg,
            is_warmup=s.is_warmup,
            rpe=s.rpe,
            set_id=s.id,  # type: ignore[arg-type]
            set_number=s.set_number,
            set_type=s.set_type,
        )
        for s, session_id in db.exec(stmt).all()
    ]
