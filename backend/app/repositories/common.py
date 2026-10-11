"""Zugriffsfunktionen: user_id ist ein Pflichtparameter und steht in jedem WHERE."""

from typing import TypeVar

from sqlmodel import Session, SQLModel, select

from app.errors import not_found
from app.models import Exercise

T = TypeVar("T", bound=SQLModel)


def get_owned(db: Session, model: type[T], obj_id: int, user_id: int, what: str = "Ressource") -> T:
    obj = db.exec(
        select(model).where(model.id == obj_id, model.user_id == user_id)  # type: ignore[attr-defined]
    ).first()
    if obj is None:
        raise not_found(what)
    return obj


def get_visible_exercise(db: Session, exercise_id: int, user_id: int) -> Exercise:
    """Globale oder eigene Übung; fremde private Übungen sind 'nicht gefunden'."""
    ex = db.get(Exercise, exercise_id)
    if ex is None or (ex.owner_user_id is not None and ex.owner_user_id != user_id):
        raise not_found("Übung")
    return ex
