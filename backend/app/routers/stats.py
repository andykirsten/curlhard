from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from pydantic import AwareDatetime
from sqlmodel import select

from app.deps import CurrentUser, DbSession
from app.models import (
    Exercise,
    PlanDay,
    SessionExercise,
    SetLog,
    WorkoutSession,
    utcnow,
)
from app.repositories.common import get_visible_exercise
from app.repositories.sets import load_sets
from app.schemas.stats import (
    HistoryRead,
    InsightsRead,
    LogRead,
    OverviewRead,
    RecordsRead,
    SummaryRead,
)
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


@router.get("/exercises/{exercise_id}/insights", response_model=InsightsRead)
def exercise_insights(
    exercise_id: int,
    user: CurrentUser,
    db: DbSession,
    from_: Annotated[AwareDatetime | None, Query(alias="from")] = None,
    to: AwareDatetime | None = None,
):
    """Auswertungen zu einer Übung. `from`/`to` begrenzen nur Wochenverlauf und
    Wiederholungsbereiche; Rekorde, Profil, Lebenszeit-Werte und Trainingstage gelten immer
    für die gesamte Historie."""
    ex = get_visible_exercise(db, exercise_id, user.id)  # type: ignore[arg-type]
    bw = user.body_weight_kg
    now = utcnow()
    sets = load_sets(db, user.id, exercise_id)  # type: ignore[arg-type]
    rows = stats.history(sets, ex.load_type, bw)
    best_e1 = max((r["e1rm"] for r in rows if r["e1rm"] is not None), default=None)
    if from_ is None and to is None:
        ranged, ranged_rows = sets, rows
    else:
        ranged = load_sets(db, user.id, exercise_id, from_, to)  # type: ignore[arg-type]
        ranged_rows = stats.history(ranged, ex.load_type, bw)
    working = [s for s in sets if not s.is_warmup and s.reps > 0]
    return {
        "exercise_id": exercise_id,
        "load_type": ex.load_type,
        "rep_profile": stats.rep_profile(sets, ex.load_type, bw, best_e1),
        "pr_events": stats.pr_timeline(stats.pr_events(sets, ex.load_type, bw)),
        "rep_ranges": stats.rep_ranges(ranged),
        "weekly": stats.weekly(ranged_rows),
        "lifetime": stats.lifetime(sets, rows, ex.load_type, bw, now),
        "plateau_weeks": stats.plateau_weeks(rows, now),
        "training_days": sorted({s.date.date() for s in working}),
    }


@router.get("/exercises/{exercise_id}/log", response_model=LogRead)
def exercise_log(
    exercise_id: int,
    user: CurrentUser,
    db: DbSession,
    before: AwareDatetime | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Historie seitenweise: Sessions mit Sätzen, neueste zuerst; Cursor ist `started_at`."""
    ex = get_visible_exercise(db, exercise_id, user.id)  # type: ignore[arg-type]
    bw = user.body_weight_kg
    stmt = (
        select(WorkoutSession, PlanDay.name)
        .outerjoin(PlanDay, PlanDay.id == WorkoutSession.plan_day_id)  # type: ignore[arg-type]
        .where(
            WorkoutSession.user_id == user.id,
            WorkoutSession.id.in_(  # type: ignore[union-attr]
                select(SessionExercise.session_id).where(
                    SessionExercise.user_id == user.id,
                    SessionExercise.exercise_id == exercise_id,
                )
            ),
        )
        .order_by(WorkoutSession.started_at.desc(), WorkoutSession.id.desc())  # type: ignore[attr-defined]
        .limit(limit + 1)
    )
    if before is not None:
        stmt = stmt.where(WorkoutSession.started_at < before)
    found = db.exec(stmt).all()
    has_more = len(found) > limit
    page = found[:limit]

    # Rekord-Markierungen und Deltas aus der gesamten Historie (keine N+1-Abfragen)
    all_sets = load_sets(db, user.id, exercise_id)  # type: ignore[arg-type]
    rows = stats.history(all_sets, ex.load_type, bw)
    by_session = {r["session_id"]: r for r in rows}
    previous: dict[int, dict | None] = {}
    for i, r in enumerate(rows):
        previous[r["session_id"]] = rows[i - 1] if i else None
    marks: dict[int, list[dict]] = {}
    for e in stats.pr_events(all_sets, ex.load_type, bw):
        marks.setdefault(e["set_id"], []).append({"kind": e["kind"], "reps": e["reps"]})

    session_ids = [ws.id for ws, _ in page]
    set_rows = (
        db.exec(
            select(SetLog, SessionExercise.session_id)
            .join(SessionExercise, SessionExercise.id == SetLog.session_exercise_id)  # type: ignore[arg-type]
            .where(
                SetLog.user_id == user.id,
                SetLog.exercise_id == exercise_id,
                SessionExercise.session_id.in_(session_ids),  # type: ignore[attr-defined]
            )
            .order_by(SetLog.completed_at, SetLog.set_number, SetLog.id)  # type: ignore[arg-type]
        ).all()
        if session_ids
        else []
    )
    sets_by_session: dict[int, list[dict]] = {}
    for s, session_id in set_rows:
        sets_by_session.setdefault(session_id, []).append(
            {
                "set_number": s.set_number,
                "reps": s.reps,
                "weight_kg": s.weight_kg,
                "rpe": s.rpe,
                "is_warmup": s.is_warmup,
                "records": marks.get(s.id, []),  # type: ignore[arg-type]
            }
        )
    items = []
    for ws, plan_day_name in page:
        metrics = by_session.get(ws.id)  # type: ignore[arg-type]
        prev = previous.get(ws.id)  # type: ignore[arg-type]
        delta = (
            stats.pct(metrics["e1rm"], prev["e1rm"])
            if metrics is not None and prev is not None
            else None
        )
        items.append(
            {
                "session_id": ws.id,
                "started_at": ws.started_at,
                "plan_day_name": plan_day_name,
                "cycle_name": ws.cycle_name,
                "note": ws.note,
                "sets": sets_by_session.get(ws.id, []),  # type: ignore[arg-type]
                "metrics": metrics,
                "e1rm_delta_pct": delta,
            }
        )
    return {
        "exercise_id": exercise_id,
        "load_type": ex.load_type,
        "items": items,
        "next_before": page[-1][0].started_at if has_more else None,
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
