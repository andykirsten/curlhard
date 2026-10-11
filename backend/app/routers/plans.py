from fastapi import APIRouter, Response
from sqlalchemy import func, update
from sqlmodel import Session, col, select

from app.deps import CurrentUser, DbSession
from app.errors import ApiError
from app.models import Plan, PlanDay, PlanExercise
from app.repositories.common import get_owned, get_visible_exercise
from app.schemas.plans import (
    OrderUpdate,
    PlanCreate,
    PlanDayCreate,
    PlanDayRead,
    PlanDayUpdate,
    PlanExerciseCreate,
    PlanExerciseRead,
    PlanExerciseUpdate,
    PlanRead,
    PlanUpdate,
)

router = APIRouter(tags=["plans"])


def _day_reads(db: Session, user_id: int, days: list[PlanDay]) -> list[PlanDayRead]:
    ids = [d.id for d in days]
    exercises = db.exec(
        select(PlanExercise)
        .where(PlanExercise.user_id == user_id, col(PlanExercise.plan_day_id).in_(ids))
        .order_by(PlanExercise.position, PlanExercise.id)
    ).all()
    by_day: dict[int, list[PlanExerciseRead]] = {i: [] for i in ids}  # type: ignore[misc]
    for pe in exercises:
        by_day[pe.plan_day_id].append(PlanExerciseRead.model_validate(pe, from_attributes=True))
    return [
        PlanDayRead(
            id=d.id,  # type: ignore[arg-type]
            plan_id=d.plan_id,
            name=d.name,
            weekday=d.weekday,
            position=d.position,
            exercises=by_day[d.id],  # type: ignore[index]
        )
        for d in days
    ]


def plan_read(db: Session, user_id: int, plan: Plan) -> PlanRead:
    days = db.exec(
        select(PlanDay)
        .where(PlanDay.user_id == user_id, PlanDay.plan_id == plan.id)
        .order_by(PlanDay.position, PlanDay.id)
    ).all()
    return PlanRead(
        id=plan.id,  # type: ignore[arg-type]
        name=plan.name,
        description=plan.description,
        is_active=plan.is_active,
        days=_day_reads(db, user_id, list(days)),
    )


def _next_position(db: Session, model, user_id: int, **filters) -> int:
    stmt = select(func.coalesce(func.max(model.position), -1)).where(model.user_id == user_id)
    for k, v in filters.items():
        stmt = stmt.where(getattr(model, k) == v)
    return db.exec(stmt).one() + 1


def _check_reps(lo: int, hi: int) -> None:
    if lo > hi:
        raise ApiError(422, "validation_error", "Wiederholungen: Minimum größer als Maximum")


def _apply_order(db: Session, items: list, ids: list[int]) -> None:
    if sorted(ids) != sorted(i.id for i in items) or len(set(ids)) != len(ids):
        raise ApiError(
            422, "validation_error", "Reihenfolge muss alle Einträge genau einmal enthalten"
        )
    by_id = {i.id: i for i in items}
    for pos, item_id in enumerate(ids):
        by_id[item_id].position = pos
        db.add(by_id[item_id])
    db.commit()


# ---- Pläne ---------------------------------------------------------------------------------


@router.get("/plans", response_model=list[PlanRead])
def list_plans(user: CurrentUser, db: DbSession, limit: int = 50, offset: int = 0):
    plans = db.exec(
        select(Plan)
        .where(Plan.user_id == user.id)
        .order_by(col(Plan.is_active).desc(), Plan.id)
        .limit(limit)
        .offset(offset)
    ).all()
    return [plan_read(db, user.id, p) for p in plans]  # type: ignore[arg-type]


@router.post("/plans", status_code=201, response_model=PlanRead)
def create_plan(body: PlanCreate, user: CurrentUser, db: DbSession):
    has_plan = db.exec(select(Plan.id).where(Plan.user_id == user.id)).first() is not None
    plan = Plan(
        user_id=user.id, name=body.name, description=body.description, is_active=not has_plan
    )  # type: ignore[arg-type]
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan_read(db, user.id, plan)  # type: ignore[arg-type]


@router.get("/plans/{plan_id}", response_model=PlanRead)
def get_plan(plan_id: int, user: CurrentUser, db: DbSession):
    return plan_read(db, user.id, get_owned(db, Plan, plan_id, user.id, "Plan"))  # type: ignore[arg-type]


@router.patch("/plans/{plan_id}", response_model=PlanRead)
def update_plan(plan_id: int, body: PlanUpdate, user: CurrentUser, db: DbSession):
    plan = get_owned(db, Plan, plan_id, user.id, "Plan")  # type: ignore[arg-type]
    for key, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(plan, key, value)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan_read(db, user.id, plan)  # type: ignore[arg-type]


@router.delete("/plans/{plan_id}", status_code=204)
def delete_plan(plan_id: int, user: CurrentUser, db: DbSession):
    plan = get_owned(db, Plan, plan_id, user.id, "Plan")  # type: ignore[arg-type]
    db.delete(plan)
    db.commit()
    return Response(status_code=204)


@router.post("/plans/{plan_id}/activate", response_model=PlanRead)
def activate_plan(plan_id: int, user: CurrentUser, db: DbSession):
    plan = get_owned(db, Plan, plan_id, user.id, "Plan")  # type: ignore[arg-type]
    db.execute(update(Plan).where(Plan.user_id == user.id).values(is_active=False))  # type: ignore[arg-type]
    plan.is_active = True
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan_read(db, user.id, plan)  # type: ignore[arg-type]


@router.post("/plans/{plan_id}/duplicate", status_code=201, response_model=PlanRead)
def duplicate_plan(plan_id: int, user: CurrentUser, db: DbSession):
    src = get_owned(db, Plan, plan_id, user.id, "Plan")  # type: ignore[arg-type]
    copy = Plan(user_id=user.id, name=f"{src.name} (Kopie)", description=src.description)  # type: ignore[arg-type]
    db.add(copy)
    db.flush()
    days = db.exec(
        select(PlanDay).where(PlanDay.user_id == user.id, PlanDay.plan_id == src.id)
    ).all()
    for day in days:
        new_day = PlanDay(
            user_id=user.id,  # type: ignore[arg-type]
            plan_id=copy.id,  # type: ignore[arg-type]
            name=day.name,
            weekday=day.weekday,
            position=day.position,
        )
        db.add(new_day)
        db.flush()
        for pe in db.exec(
            select(PlanExercise).where(
                PlanExercise.user_id == user.id, PlanExercise.plan_day_id == day.id
            )
        ).all():
            db.add(
                PlanExercise(
                    user_id=user.id,  # type: ignore[arg-type]
                    plan_day_id=new_day.id,  # type: ignore[arg-type]
                    exercise_id=pe.exercise_id,
                    position=pe.position,
                    target_sets=pe.target_sets,
                    target_reps_min=pe.target_reps_min,
                    target_reps_max=pe.target_reps_max,
                    target_rest_sec=pe.target_rest_sec,
                    note=pe.note,
                )
            )
    db.commit()
    db.refresh(copy)
    return plan_read(db, user.id, copy)  # type: ignore[arg-type]


@router.put("/plans/{plan_id}/order", response_model=PlanRead)
def order_days(plan_id: int, body: OrderUpdate, user: CurrentUser, db: DbSession):
    plan = get_owned(db, Plan, plan_id, user.id, "Plan")  # type: ignore[arg-type]
    days = db.exec(
        select(PlanDay).where(PlanDay.user_id == user.id, PlanDay.plan_id == plan.id)
    ).all()
    _apply_order(db, list(days), body.ids)
    return plan_read(db, user.id, plan)  # type: ignore[arg-type]


# ---- Trainingstage -------------------------------------------------------------------------


@router.post("/plans/{plan_id}/days", status_code=201, response_model=PlanDayRead)
def create_day(plan_id: int, body: PlanDayCreate, user: CurrentUser, db: DbSession):
    plan = get_owned(db, Plan, plan_id, user.id, "Plan")  # type: ignore[arg-type]
    day = PlanDay(
        user_id=user.id,  # type: ignore[arg-type]
        plan_id=plan.id,  # type: ignore[arg-type]
        name=body.name,
        weekday=body.weekday,
        position=_next_position(db, PlanDay, user.id, plan_id=plan.id),  # type: ignore[arg-type]
    )
    db.add(day)
    db.commit()
    db.refresh(day)
    return _day_reads(db, user.id, [day])[0]  # type: ignore[arg-type]


@router.patch("/plan-days/{day_id}", response_model=PlanDayRead)
def update_day(day_id: int, body: PlanDayUpdate, user: CurrentUser, db: DbSession):
    day = get_owned(db, PlanDay, day_id, user.id, "Trainingstag")  # type: ignore[arg-type]
    data = body.model_dump(exclude_unset=True)
    if data.get("name") is not None:
        day.name = data["name"]
    if "weekday" in data:
        day.weekday = data["weekday"]
    db.add(day)
    db.commit()
    db.refresh(day)
    return _day_reads(db, user.id, [day])[0]  # type: ignore[arg-type]


@router.delete("/plan-days/{day_id}", status_code=204)
def delete_day(day_id: int, user: CurrentUser, db: DbSession):
    day = get_owned(db, PlanDay, day_id, user.id, "Trainingstag")  # type: ignore[arg-type]
    db.delete(day)
    db.commit()
    return Response(status_code=204)


@router.put("/plan-days/{day_id}/order", response_model=PlanDayRead)
def order_exercises(day_id: int, body: OrderUpdate, user: CurrentUser, db: DbSession):
    day = get_owned(db, PlanDay, day_id, user.id, "Trainingstag")  # type: ignore[arg-type]
    items = db.exec(
        select(PlanExercise).where(
            PlanExercise.user_id == user.id, PlanExercise.plan_day_id == day.id
        )
    ).all()
    _apply_order(db, list(items), body.ids)
    return _day_reads(db, user.id, [day])[0]  # type: ignore[arg-type]


# ---- Plan-Übungen --------------------------------------------------------------------------


@router.post("/plan-days/{day_id}/exercises", status_code=201, response_model=PlanExerciseRead)
def add_plan_exercise(day_id: int, body: PlanExerciseCreate, user: CurrentUser, db: DbSession):
    day = get_owned(db, PlanDay, day_id, user.id, "Trainingstag")  # type: ignore[arg-type]
    get_visible_exercise(db, body.exercise_id, user.id)  # type: ignore[arg-type]
    _check_reps(body.target_reps_min, body.target_reps_max)
    pe = PlanExercise(
        user_id=user.id,  # type: ignore[arg-type]
        plan_day_id=day.id,  # type: ignore[arg-type]
        position=_next_position(db, PlanExercise, user.id, plan_day_id=day.id),  # type: ignore[arg-type]
        **body.model_dump(),
    )
    db.add(pe)
    db.commit()
    db.refresh(pe)
    return pe


@router.patch("/plan-exercises/{pe_id}", response_model=PlanExerciseRead)
def update_plan_exercise(pe_id: int, body: PlanExerciseUpdate, user: CurrentUser, db: DbSession):
    pe = get_owned(db, PlanExercise, pe_id, user.id, "Plan-Übung")  # type: ignore[arg-type]
    data = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "exercise_id" in data:
        get_visible_exercise(db, data["exercise_id"], user.id)  # type: ignore[arg-type]
    _check_reps(
        data.get("target_reps_min", pe.target_reps_min),
        data.get("target_reps_max", pe.target_reps_max),
    )
    for key, value in data.items():
        setattr(pe, key, value)
    db.add(pe)
    db.commit()
    db.refresh(pe)
    return pe


@router.delete("/plan-exercises/{pe_id}", status_code=204)
def delete_plan_exercise(pe_id: int, user: CurrentUser, db: DbSession):
    pe = get_owned(db, PlanExercise, pe_id, user.id, "Plan-Übung")  # type: ignore[arg-type]
    db.delete(pe)
    db.commit()
    return Response(status_code=204)
