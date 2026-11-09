from bisect import bisect_right
from collections.abc import Callable
from datetime import datetime

from sqlmodel import Session, select

from app.models import BodyWeightLog


def body_weight_at(db: Session, user_id: int) -> Callable[[datetime], float | None]:
    """Körpergewicht zum Zeitpunkt eines Satzes: letzter Eintrag am oder vor dem Tag, davor der
    früheste Eintrag. Ohne Einträge None (der Aufrufer nimmt dann user.body_weight_kg)."""
    rows = db.exec(
        select(BodyWeightLog.measured_on, BodyWeightLog.weight_kg)
        .where(BodyWeightLog.user_id == user_id)
        .order_by(BodyWeightLog.measured_on)  # type: ignore[arg-type]
    ).all()
    if not rows:
        return lambda _when: None
    days = [r[0] for r in rows]

    def at(when: datetime) -> float | None:
        return rows[max(bisect_right(days, when.date()) - 1, 0)][1]

    return at
