from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from pydantic import AwareDatetime
from sqlmodel import select

from app.deps import CurrentUser, DbSession
from app.models import Exercise, SessionExercise, SetLog, utcnow
from app.repositories.common import get_visible_exercise
from app.repositories.sets import load_sets
from app.schemas.stats import HistoryRead, OverviewRead, RecordsRead, SummaryRead
from app.services import stats

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/exercises/{exercise_id}/summary", response_model=SummaryRead)
def exercise_summary(exercise_id: int, user: CurrentUser, db: DbSession):
    ex = get_visible_exercise(db, exercise_id, user.id)  # type: ignore[arg-type]
    rows = stats.history(load_sets(db, user.id, exercise_id), ex.load_type, user.body_weight_kg)  # type: ignore[arg-type]
    result = stats.summary(rows, utcnow())
    result["exercise_id"] = exercise_id
    result["load_type"] = ex.load_type
    result["session_count"] = len(rows)
    result["last_session"] = rows[-1] if rows else None
    return result


@router.get("/exercises/{exercise_id}/history", response_model=HistoryRead)
def exercise_history(
    exercise_id: int,
    user: CurrentUser,
    db: DbSession,
    from_: Annotated[AwareDatetime | None, Query(alias="from")] = None,
    to: AwareDatetime | None = None,
    metric: Literal["e1rm", "volume", "best_set"] = "e1rm",
):
    ex = get_visible_exercise(db, exercise_id, user.id)  # type: ignore[arg-type]
    rows = stats.history(
        load_sets(db, user.id, exercise_id, from_, to),  # type: ignore[arg-type]
        ex.load_type,
        user.body_weight_kg,
    )
    for r in rows:
        if metric == "best_set":
            r["value"] = r["best_set"]["weight_kg"]
        else:
            r["value"] = r[metric]
    return {"exercise_id": exercise_id, "metric": metric, "points": rows}


@router.get("/exercises/{exercise_id}/records", response_model=RecordsRead)
def exercise_records(exercise_id: int, user: CurrentUser, db: DbSession):
    ex = get_visible_exercise(db, exercise_id, user.id)  # type: ignore[arg-type]
    sets = load_sets(db, user.id, exercise_id)  # type: ignore[arg-type]
    return {
        "exercise_id": exercise_id,
        "records": stats.records(sets, ex.load_type, user.body_weight_kg),
    }


@router.get("/overview", response_model=OverviewRead)
def overview(user: CurrentUser, db: DbSession, weeks: Annotated[int, Query(ge=1, le=104)] = 12):
    now = utcnow()
    start = datetime.combine(
        stats.week_start(now) - timedelta(weeks=weeks - 1),
        datetime.min.time(),
        tzinfo=UTC,
    )
    rows = db.exec(
        select(SetLog, SessionExercise.session_id, Exercise)
        .join(SessionExercise, SessionExercise.id == SetLog.session_exercise_id)  # type: ignore[arg-type]
        .join(Exercise, Exercise.id == SetLog.exercise_id)  # type: ignore[arg-type]
        .where(
            SetLog.user_id == user.id,
            SetLog.completed_at >= start,  # type: ignore[arg-type]
            SetLog.is_warmup == False,  # noqa: E712
        )
    ).all()
    entries = []
    for s, session_id, ex in rows:
        load = stats.effective_load(ex.load_type, s.weight_kg, user.body_weight_kg)
        volume = s.reps * load if load is not None else 0.0
        entries.append((session_id, s.completed_at, volume, ex.primary_muscle_group_id))
    return {"weeks": stats.overview(entries, weeks, now)}
