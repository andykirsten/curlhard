from fastapi import APIRouter, Response
from sqlalchemy import func
from sqlmodel import col, select

from app.deps import CurrentUser, DbSession
from app.errors import ApiError
from app.models import Plan, TrainingCycle, WorkoutSession, utcnow
from app.repositories.common import get_owned
from app.schemas.cycles import CycleCreate, CycleEnd, CycleRead, CycleUpdate
from app.services import cycles as cycle_service

router = APIRouter(prefix="/cycles", tags=["cycles"])


def _cycle_read(db, user_id: int, cycle: TrainingCycle) -> CycleRead:
    plan_name = None
    if cycle.plan_id is not None:
        plan = db.get(Plan, cycle.plan_id)
        plan_name = plan.name if plan is not None and plan.user_id == user_id else None
    session_count = db.exec(
        select(func.count())
        .select_from(WorkoutSession)
        .where(WorkoutSession.user_id == user_id, WorkoutSession.cycle_id == cycle.id)
    ).one()
    return CycleRead(
        id=cycle.id,  # type: ignore[arg-type]
        name=cycle.name,
        note=cycle.note,
        start_date=cycle.start_date,
        end_date=cycle.end_date,
        plan_id=cycle.plan_id,
        plan_name=plan_name,
        is_active=cycle.is_active,
        session_count=session_count,
    )


def _check_dates(start, end) -> None:
    if end is not None and end < start:
        raise ApiError(422, "validation_error", "Enddatum liegt vor dem Startdatum")


def _check_plan(db, user_id: int, plan_id: int | None) -> None:
    if plan_id is not None:
        get_owned(db, Plan, plan_id, user_id, "Plan")  # type: ignore[arg-type]


@router.get("", response_model=list[CycleRead])
def list_cycles(user: CurrentUser, db: DbSession):
    cycles = db.exec(
        select(TrainingCycle)
        .where(TrainingCycle.user_id == user.id)
        .order_by(col(TrainingCycle.start_date).desc(), col(TrainingCycle.id).desc())
    ).all()
    return [_cycle_read(db, user.id, c) for c in cycles]  # type: ignore[arg-type]


@router.post("", status_code=201, response_model=CycleRead)
def create_cycle(body: CycleCreate, user: CurrentUser, db: DbSession):
    _check_dates(body.start_date, body.end_date)
    _check_plan(db, user.id, body.plan_id)  # type: ignore[arg-type]
    cycle = TrainingCycle(
        user_id=user.id,  # type: ignore[arg-type]
        name=body.name,
        note=body.note,
        start_date=body.start_date,
        end_date=body.end_date,
        plan_id=body.plan_id,
    )
    db.add(cycle)
    db.flush()
    if body.activate:
        cycle_service.activate_cycle(db, user.id, cycle)  # type: ignore[arg-type]
    db.commit()
    db.refresh(cycle)
    return _cycle_read(db, user.id, cycle)  # type: ignore[arg-type]


@router.patch("/{cycle_id}", response_model=CycleRead)
def update_cycle(cycle_id: int, body: CycleUpdate, user: CurrentUser, db: DbSession):
    cycle = get_owned(db, TrainingCycle, cycle_id, user.id, "Zyklus")  # type: ignore[arg-type]
    data = body.model_dump(exclude_unset=True)
    for key in ("name", "note", "start_date"):
        if key in data and data[key] is None:
            del data[key]
    if "plan_id" in data:
        _check_plan(db, user.id, data["plan_id"])  # type: ignore[arg-type]
    _check_dates(data.get("start_date", cycle.start_date), data.get("end_date", cycle.end_date))
    for key, value in data.items():
        setattr(cycle, key, value)
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return _cycle_read(db, user.id, cycle)  # type: ignore[arg-type]


@router.delete("/{cycle_id}", status_code=204)
def delete_cycle(cycle_id: int, user: CurrentUser, db: DbSession):
    """Sessions behalten ihren cycle_name-Snapshot; cycle_id wird per FK auf NULL gesetzt."""
    cycle = get_owned(db, TrainingCycle, cycle_id, user.id, "Zyklus")  # type: ignore[arg-type]
    db.delete(cycle)
    db.commit()
    return Response(status_code=204)


@router.post("/{cycle_id}/activate", response_model=CycleRead)
def activate_cycle(cycle_id: int, user: CurrentUser, db: DbSession):
    cycle = get_owned(db, TrainingCycle, cycle_id, user.id, "Zyklus")  # type: ignore[arg-type]
    cycle_service.activate_cycle(db, user.id, cycle)  # type: ignore[arg-type]
    # Ein wieder aktivierter Zyklus läuft weiter; ein vergangenes Enddatum wird gelöscht
    if cycle.end_date is not None and cycle.end_date < utcnow().date():
        cycle.end_date = None
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return _cycle_read(db, user.id, cycle)  # type: ignore[arg-type]


@router.post("/{cycle_id}/end", response_model=CycleRead)
def end_cycle(
    cycle_id: int,
    user: CurrentUser,
    db: DbSession,
    body: CycleEnd | None = None,
):
    cycle = get_owned(db, TrainingCycle, cycle_id, user.id, "Zyklus")  # type: ignore[arg-type]
    cycle.is_active = False
    end = (body.end_date if body is not None and body.end_date else None) or utcnow().date()
    # Ende nie vor dem Start (z. B. bei Zeitzonenunterschied zwischen Client und Server)
    cycle.end_date = max(end, cycle.start_date)
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return _cycle_read(db, user.id, cycle)  # type: ignore[arg-type]
