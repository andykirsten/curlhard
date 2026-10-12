from fastapi import APIRouter, Query
from sqlmodel import Session, col, func, select

from app.deps import CurrentUser, DbSession
from app.errors import not_found
from app.models import Exercise, Plan, PlanDay, PlanExercise, User
from app.routers.plans import plan_read
from app.schemas.auth import avatar_url_for
from app.schemas.plans import (
    AuthorRead,
    PlanRead,
    PublicPlanDaySummary,
    PublicPlanRead,
    PublicPlanSummary,
)
from app.services.plan_copy import clone_plan, private_exercise_map

router = APIRouter(prefix="/public-plans", tags=["public-plans"])


def _author(author: User) -> AuthorRead:
    return AuthorRead(
        id=author.id,  # type: ignore[arg-type]
        display_name=author.display_name,
        avatar_url=avatar_url_for(author.id, author.avatar_updated_at),  # type: ignore[arg-type]
    )


def _visible_public_plan(db: Session, plan_id: int, user_id: int) -> Plan:
    """Öffentliche Pläne anderer Nutzer; alles andere ist 'nicht gefunden'."""
    plan = db.get(Plan, plan_id)
    if plan is None or not plan.is_public or plan.user_id == user_id:
        raise not_found("Plan")
    _author_of(db, plan)  # deaktivierte Autoren: Plan ist nicht sichtbar
    return plan


def _author_of(db: Session, plan: Plan) -> User:
    author = db.get(User, plan.user_id)
    if author is None or not author.is_active:
        raise not_found("Plan")
    return author


def _day_summaries(db: Session, plan: Plan) -> list[PublicPlanDaySummary]:
    days = db.exec(
        select(PlanDay)
        .where(PlanDay.user_id == plan.user_id, PlanDay.plan_id == plan.id)
        .order_by(PlanDay.position, PlanDay.id)
    ).all()
    day_ids = [d.id for d in days]
    if not day_ids:
        return []
    # nur die Übungen dieses Plans zählen, nicht alle Übungen des Autors
    counts = dict(
        db.exec(
            select(PlanExercise.plan_day_id, func.count())
            .where(
                PlanExercise.user_id == plan.user_id,
                col(PlanExercise.plan_day_id).in_(day_ids),
            )
            .group_by(col(PlanExercise.plan_day_id))
        ).all()
    )
    return [
        PublicPlanDaySummary(
            name=d.name,
            weekday=d.weekday,
            exercise_count=counts.get(d.id, 0),  # type: ignore[arg-type]
        )
        for d in days
    ]


@router.get("", response_model=list[PublicPlanSummary])
def list_public_plans(
    user: CurrentUser,
    db: DbSession,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    plans = db.exec(
        select(Plan)
        .join(User, User.id == Plan.user_id)  # type: ignore[arg-type]
        .where(
            col(Plan.is_public).is_(True),
            col(User.is_active).is_(True),
            Plan.user_id != user.id,
        )
        .order_by(col(Plan.updated_at).desc(), col(Plan.id).desc())
        .limit(limit)
        .offset(offset)
    ).all()
    out: list[PublicPlanSummary] = []
    for plan in plans:
        days = _day_summaries(db, plan)
        author = _author_of(db, plan)
        out.append(
            PublicPlanSummary(
                id=plan.id,  # type: ignore[arg-type]
                name=plan.name,
                description=plan.description,
                author=_author(author),
                day_count=len(days),
                exercise_count=sum(d.exercise_count for d in days),
                days=days,
            )
        )
    return out


@router.get("/{plan_id}", response_model=PublicPlanRead)
def get_public_plan(plan_id: int, user: CurrentUser, db: DbSession):
    plan = _visible_public_plan(db, plan_id, user.id)  # type: ignore[arg-type]
    base: PlanRead = plan_read(db, plan.user_id, plan)  # type: ignore[arg-type]
    ids = {pe.exercise_id for day in base.days for pe in day.exercises}
    names = db.exec(select(Exercise.id, Exercise.name).where(col(Exercise.id).in_(ids))).all()
    return PublicPlanRead(
        **base.model_dump(),
        author=_author(_author_of(db, plan)),
        exercise_names={str(ex_id): name for ex_id, name in names},
    )


@router.post("/{plan_id}/copy", status_code=201, response_model=PlanRead)
def copy_public_plan(plan_id: int, user: CurrentUser, db: DbSession):
    """Übernimmt einen öffentlichen Plan als unabhängige Kopie.

    Private Übungen des Autors werden als eigene private Übungen übernommen; gibt es bereits
    eine eigene Übung gleichen Namens, wird diese wiederverwendet.
    """
    src = _visible_public_plan(db, plan_id, user.id)  # type: ignore[arg-type]
    mapping = private_exercise_map(db, src, user.id)  # type: ignore[arg-type]
    copy = clone_plan(db, src, user.id, src.name, mapping)  # type: ignore[arg-type]
    db.commit()
    db.refresh(copy)
    return plan_read(db, user.id, copy)  # type: ignore[arg-type]
