"""Trainingszyklen: Aktivierung und Wochenberechnung."""

from sqlalchemy import update
from sqlmodel import Session, col, select

from app.models import Plan, TrainingCycle


def get_active_cycle(db: Session, user_id: int) -> TrainingCycle | None:
    return db.exec(
        select(TrainingCycle).where(
            TrainingCycle.user_id == user_id, col(TrainingCycle.is_active).is_(True)
        )
    ).first()


def activate_cycle(db: Session, user_id: int, cycle: TrainingCycle) -> None:
    """Genau ein Zyklus ist aktiv; der verknüpfte Plan wird ebenfalls aktiviert.

    Der Aufrufer committet.
    """
    db.execute(
        update(TrainingCycle)  # type: ignore[arg-type]
        .where(TrainingCycle.user_id == user_id)
        .values(is_active=False)
    )
    cycle.is_active = True
    db.add(cycle)
    if cycle.plan_id is not None:
        db.execute(update(Plan).where(Plan.user_id == user_id).values(is_active=False))  # type: ignore[arg-type]
        plan = db.get(Plan, cycle.plan_id)
        if plan is not None and plan.user_id == user_id:
            plan.is_active = True
            db.add(plan)
