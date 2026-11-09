from datetime import date

from sqlmodel import Session, col, select

from app.models import BodyWeightLog, User


def sync_current_weight(db: Session, user: User) -> None:
    """user.body_weight_kg folgt dem jüngsten Eintrag (ohne Einträge bleibt der Wert)."""
    latest = db.exec(
        select(BodyWeightLog)
        .where(BodyWeightLog.user_id == user.id)
        .order_by(col(BodyWeightLog.measured_on).desc())
        .limit(1)
    ).first()
    if latest is not None:
        user.body_weight_kg = latest.weight_kg
        db.add(user)


def set_weight(db: Session, user: User, measured_on: date, weight_kg: float) -> BodyWeightLog:
    """Legt den Eintrag des Tages an oder überschreibt ihn und aktualisiert das aktuelle Gewicht."""
    row = db.exec(
        select(BodyWeightLog).where(
            BodyWeightLog.user_id == user.id, BodyWeightLog.measured_on == measured_on
        )
    ).first()
    if row is None:
        row = BodyWeightLog(
            user_id=user.id,  # type: ignore[arg-type]
            measured_on=measured_on,
            weight_kg=weight_kg,
        )
    else:
        row.weight_kg = weight_kg
    db.add(row)
    db.flush()
    sync_current_weight(db, user)
    db.commit()
    db.refresh(row)
    return row
