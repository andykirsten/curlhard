from typing import Annotated

from fastapi import APIRouter, Query, Response
from pydantic import AwareDatetime
from sqlalchemy import func
from sqlmodel import Session, col, select

from app.deps import CurrentUser, DbSession
from app.models import (
    Exercise,
    ExerciseNote,
    Plan,
    PlanDay,
    PlanExercise,
    SessionExercise,
    SetLog,
    User,
    WorkoutSession,
    utcnow,
)
from app.repositories.common import get_owned, get_visible_exercise
from app.repositories.sets import load_sets
from app.schemas.sessions import (
    SessionCreate,
    SessionExerciseCreate,
    SessionExerciseRead,
    SessionExerciseUpdate,
    SessionRead,
    SessionSummary,
    SessionUpdate,
    SetCreate,
    SetRead,
    SetUpdate,
)
from app.schemas.stats import TodayRead
from app.services import stats

router = APIRouter(tags=["sessions"])


def _set_read(s: SetLog, records: list[int] | None = None) -> SetRead:
    read = SetRead.model_validate(s, from_attributes=True)
    read.records = records or []
    return read


def session_read(db: Session, user_id: int, ws: WorkoutSession) -> SessionRead:
    exercises = db.exec(
        select(SessionExercise)
        .where(SessionExercise.user_id == user_id, SessionExercise.session_id == ws.id)
        .order_by(SessionExercise.position, SessionExercise.id)
    ).all()
    ids = [e.id for e in exercises]
    sets = db.exec(
        select(SetLog)
        .where(SetLog.user_id == user_id, col(SetLog.session_exercise_id).in_(ids))
        .order_by(SetLog.set_number, SetLog.id)
    ).all()
    by_ex: dict[int, list[SetRead]] = {i: [] for i in ids}  # type: ignore[misc]
    for s in sets:
        by_ex[s.session_exercise_id].append(_set_read(s))
    return SessionRead(
        id=ws.id,  # type: ignore[arg-type]
        plan_day_id=ws.plan_day_id,
        started_at=ws.started_at,
        finished_at=ws.finished_at,
        note=ws.note,
        exercises=[
            SessionExerciseRead(
                id=e.id,  # type: ignore[arg-type]
                session_id=e.session_id,
                exercise_id=e.exercise_id,
                position=e.position,
                note=e.note,
                sets=by_ex[e.id],  # type: ignore[index]
            )
            for e in exercises
        ],
    )


# ---- Heute ---------------------------------------------------------------------------------


@router.get("/today", response_model=TodayRead)
def today(user: CurrentUser, db: DbSession, weekday: int | None = None):
    wd = weekday if weekday is not None else utcnow().weekday()
    plan = db.exec(select(Plan).where(Plan.user_id == user.id, Plan.is_active)).first()
    if plan is None:
        return {"plan": None, "day": None, "other_days": []}
    days = db.exec(
        select(PlanDay)
        .where(PlanDay.user_id == user.id, PlanDay.plan_id == plan.id)
        .order_by(PlanDay.position, PlanDay.id)
    ).all()
    day = next((d for d in days if d.weekday == wd), None)

    def day_payload(d: PlanDay) -> dict:
        items = db.exec(
            select(PlanExercise)
            .where(PlanExercise.user_id == user.id, PlanExercise.plan_day_id == d.id)
            .order_by(PlanExercise.position, PlanExercise.id)
        ).all()
        exercises = []
        for pe in items:
            ex = db.get(Exercise, pe.exercise_id)
            note = db.exec(
                select(ExerciseNote).where(
                    ExerciseNote.user_id == user.id, ExerciseNote.exercise_id == pe.exercise_id
                )
            ).first()
            last = _last_sets(db, user.id, pe.exercise_id)  # type: ignore[arg-type]
            exercises.append(
                {
                    "plan_exercise_id": pe.id,
                    "exercise_id": pe.exercise_id,
                    "name": ex.name if ex else "",
                    "load_type": ex.load_type if ex else "weight",
                    "target_sets": pe.target_sets,
                    "target_reps_min": pe.target_reps_min,
                    "target_reps_max": pe.target_reps_max,
                    "target_rest_sec": pe.target_rest_sec,
                    "note": pe.note,
                    "permanent_note": note.note if note else "",
                    "last_sets": last,
                }
            )
        return {"id": d.id, "name": d.name, "weekday": d.weekday, "exercises": exercises}

    return {
        "plan": {"id": plan.id, "name": plan.name},
        "day": day_payload(day) if day else None,
        "other_days": [
            {"id": d.id, "name": d.name, "weekday": d.weekday} for d in days if d is not day
        ],
    }


def _last_sets(db: Session, user_id: int, exercise_id: int) -> list[dict]:
    """Arbeitssätze der letzten Session, in der diese Übung geloggt wurde."""
    last_se = db.exec(
        select(SessionExercise.id)
        .join(SetLog, SetLog.session_exercise_id == SessionExercise.id)  # type: ignore[arg-type]
        .where(
            SessionExercise.user_id == user_id,
            SessionExercise.exercise_id == exercise_id,
        )
        .order_by(col(SetLog.completed_at).desc())
        .limit(1)
    ).first()
    if last_se is None:
        return []
    sets = db.exec(
        select(SetLog)
        .where(SetLog.user_id == user_id, SetLog.session_exercise_id == last_se)
        .order_by(SetLog.set_number, SetLog.id)
    ).all()
    return [
        {"reps": s.reps, "weight_kg": s.weight_kg, "is_warmup": s.is_warmup, "rpe": s.rpe}
        for s in sets
    ]


# ---- Sessions ------------------------------------------------------------------------------


@router.post("/sessions", status_code=201, response_model=SessionRead)
def create_session(body: SessionCreate, user: CurrentUser, db: DbSession):
    if body.plan_day_id is not None:
        get_owned(db, PlanDay, body.plan_day_id, user.id, "Trainingstag")  # type: ignore[arg-type]
    ws = WorkoutSession(
        user_id=user.id,  # type: ignore[arg-type]
        plan_day_id=body.plan_day_id,
        started_at=body.started_at or utcnow(),
    )
    db.add(ws)
    db.flush()
    if body.plan_day_id is not None:
        items = db.exec(
            select(PlanExercise)
            .where(PlanExercise.user_id == user.id, PlanExercise.plan_day_id == body.plan_day_id)
            .order_by(PlanExercise.position, PlanExercise.id)
        ).all()
        for pos, pe in enumerate(items):
            db.add(
                SessionExercise(
                    user_id=user.id,  # type: ignore[arg-type]
                    session_id=ws.id,  # type: ignore[arg-type]
                    exercise_id=pe.exercise_id,
                    position=pos,
                )
            )
    db.commit()
    db.refresh(ws)
    return session_read(db, user.id, ws)  # type: ignore[arg-type]


@router.get("/sessions", response_model=list[SessionSummary])
def list_sessions(
    user: CurrentUser,
    db: DbSession,
    from_: Annotated[AwareDatetime | None, Query(alias="from")] = None,
    to: AwareDatetime | None = None,
    limit: int = 50,
    offset: int = 0,
):
    stmt = select(WorkoutSession).where(WorkoutSession.user_id == user.id)
    if from_ is not None:
        stmt = stmt.where(WorkoutSession.started_at >= from_)
    if to is not None:
        stmt = stmt.where(WorkoutSession.started_at <= to)
    rows = db.exec(
        stmt.order_by(col(WorkoutSession.started_at).desc()).limit(limit).offset(offset)
    ).all()
    out = []
    for ws in rows:
        ex_count = db.exec(
            select(func.count())
            .select_from(SessionExercise)
            .where(SessionExercise.user_id == user.id, SessionExercise.session_id == ws.id)
        ).one()
        set_count = db.exec(
            select(func.count())
            .select_from(SetLog)
            .join(SessionExercise, SessionExercise.id == SetLog.session_exercise_id)  # type: ignore[arg-type]
            .where(SetLog.user_id == user.id, SessionExercise.session_id == ws.id)
        ).one()
        out.append(
            SessionSummary(
                id=ws.id,  # type: ignore[arg-type]
                plan_day_id=ws.plan_day_id,
                started_at=ws.started_at,
                finished_at=ws.finished_at,
                note=ws.note,
                exercise_count=ex_count,
                set_count=set_count,
            )
        )
    return out


@router.get("/sessions/{session_id}", response_model=SessionRead)
def get_session_detail(session_id: int, user: CurrentUser, db: DbSession):
    ws = get_owned(db, WorkoutSession, session_id, user.id, "Session")  # type: ignore[arg-type]
    return session_read(db, user.id, ws)  # type: ignore[arg-type]


@router.patch("/sessions/{session_id}", response_model=SessionRead)
def update_session(session_id: int, body: SessionUpdate, user: CurrentUser, db: DbSession):
    ws = get_owned(db, WorkoutSession, session_id, user.id, "Session")  # type: ignore[arg-type]
    for key, value in body.model_dump(exclude_unset=True).items():
        if key == "note" and value is None:
            continue
        if key == "started_at" and value is None:
            continue
        setattr(ws, key, value)
    db.add(ws)
    db.commit()
    db.refresh(ws)
    return session_read(db, user.id, ws)  # type: ignore[arg-type]


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: int, user: CurrentUser, db: DbSession):
    ws = get_owned(db, WorkoutSession, session_id, user.id, "Session")  # type: ignore[arg-type]
    db.delete(ws)
    db.commit()
    return Response(status_code=204)


@router.post("/sessions/{session_id}/finish", response_model=SessionRead)
def finish_session(session_id: int, user: CurrentUser, db: DbSession):
    ws = get_owned(db, WorkoutSession, session_id, user.id, "Session")  # type: ignore[arg-type]
    if ws.finished_at is None:
        ws.finished_at = utcnow()
        db.add(ws)
        db.commit()
        db.refresh(ws)
    return session_read(db, user.id, ws)  # type: ignore[arg-type]


# ---- Session-Übungen -----------------------------------------------------------------------


@router.post(
    "/sessions/{session_id}/exercises", status_code=201, response_model=SessionExerciseRead
)
def add_session_exercise(
    session_id: int, body: SessionExerciseCreate, user: CurrentUser, db: DbSession
):
    ws = get_owned(db, WorkoutSession, session_id, user.id, "Session")  # type: ignore[arg-type]
    get_visible_exercise(db, body.exercise_id, user.id)  # type: ignore[arg-type]
    pos = (
        db.exec(
            select(func.coalesce(func.max(SessionExercise.position), -1)).where(
                SessionExercise.user_id == user.id, SessionExercise.session_id == ws.id
            )
        ).one()
        + 1
    )
    se = SessionExercise(
        user_id=user.id,  # type: ignore[arg-type]
        session_id=ws.id,  # type: ignore[arg-type]
        exercise_id=body.exercise_id,
        position=pos,
    )
    db.add(se)
    db.commit()
    db.refresh(se)
    return SessionExerciseRead(
        id=se.id,  # type: ignore[arg-type]
        session_id=se.session_id,
        exercise_id=se.exercise_id,
        position=se.position,
        note=se.note,
    )


@router.patch("/session-exercises/{se_id}", response_model=SessionExerciseRead)
def update_session_exercise(
    se_id: int, body: SessionExerciseUpdate, user: CurrentUser, db: DbSession
):
    se = get_owned(db, SessionExercise, se_id, user.id, "Session-Übung")  # type: ignore[arg-type]
    for key, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(se, key, value)
    db.add(se)
    db.commit()
    db.refresh(se)
    sets = db.exec(
        select(SetLog)
        .where(SetLog.user_id == user.id, SetLog.session_exercise_id == se.id)
        .order_by(SetLog.set_number, SetLog.id)
    ).all()
    return SessionExerciseRead(
        id=se.id,  # type: ignore[arg-type]
        session_id=se.session_id,
        exercise_id=se.exercise_id,
        position=se.position,
        note=se.note,
        sets=[_set_read(s) for s in sets],
    )


@router.delete("/session-exercises/{se_id}", status_code=204)
def delete_session_exercise(se_id: int, user: CurrentUser, db: DbSession):
    se = get_owned(db, SessionExercise, se_id, user.id, "Session-Übung")  # type: ignore[arg-type]
    db.delete(se)
    db.commit()
    return Response(status_code=204)


# ---- Sätze ---------------------------------------------------------------------------------


def _records_for(db: Session, user: User, s: SetLog, exercise: Exercise) -> list[int]:
    if s.is_warmup:
        return []
    previous = load_sets(db, user.id, s.exercise_id, exclude_set_id=s.id)  # type: ignore[arg-type]
    return stats.new_records(previous, s.reps, s.weight_kg, exercise.load_type, user.body_weight_kg)


@router.post("/session-exercises/{se_id}/sets", status_code=201, response_model=SetRead)
def add_set(se_id: int, body: SetCreate, user: CurrentUser, db: DbSession):
    se = get_owned(db, SessionExercise, se_id, user.id, "Session-Übung")  # type: ignore[arg-type]
    number = body.set_number
    if number is None:
        number = (
            db.exec(
                select(func.coalesce(func.max(SetLog.set_number), 0)).where(
                    SetLog.user_id == user.id, SetLog.session_exercise_id == se.id
                )
            ).one()
            + 1
        )
    s = SetLog(
        user_id=user.id,  # type: ignore[arg-type]
        exercise_id=se.exercise_id,
        session_exercise_id=se.id,  # type: ignore[arg-type]
        set_number=number,
        reps=body.reps,
        weight_kg=body.weight_kg,
        rest_sec=body.rest_sec,
        rpe=body.rpe,
        is_warmup=body.is_warmup,
        completed_at=body.completed_at or utcnow(),
    )
    exercise = db.get(Exercise, se.exercise_id)
    assert exercise is not None
    # Rekorde gegen die Vorgeschichte prüfen, bevor der Satz gespeichert wird
    previous = load_sets(db, user.id, se.exercise_id)  # type: ignore[arg-type]
    records = (
        []
        if s.is_warmup
        else stats.new_records(
            previous, s.reps, s.weight_kg, exercise.load_type, user.body_weight_kg
        )
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _set_read(s, records)


@router.patch("/sets/{set_id}", response_model=SetRead)
def update_set(set_id: int, body: SetUpdate, user: CurrentUser, db: DbSession):
    s = get_owned(db, SetLog, set_id, user.id, "Satz")  # type: ignore[arg-type]
    for key, value in body.model_dump(exclude_unset=True).items():
        if value is None and key not in ("rest_sec", "rpe"):
            continue
        setattr(s, key, value)
    db.add(s)
    db.commit()
    db.refresh(s)
    exercise = db.get(Exercise, s.exercise_id)
    assert exercise is not None
    return _set_read(s, _records_for(db, user, s, exercise))


@router.delete("/sets/{set_id}", status_code=204)
def delete_set(set_id: int, user: CurrentUser, db: DbSession):
    s = get_owned(db, SetLog, set_id, user.id, "Satz")  # type: ignore[arg-type]
    db.delete(s)
    db.commit()
    return Response(status_code=204)
