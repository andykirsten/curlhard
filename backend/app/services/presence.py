"""Wer ist gerade online / trainiert gerade."""

from datetime import timedelta

from sqlmodel import Session, col, select

from app.models import User, WorkoutSession, utcnow

ONLINE_WINDOW = timedelta(minutes=5)
TRAINING_WINDOW = timedelta(hours=4)


def online_users(db: Session, exclude_id: int) -> list[tuple[User, bool]]:
    """Aktive Nutzer mit Aktivität in den letzten 5 Minuten, ohne den Anfragenden.

    Liefert Paare (Nutzer, trainiert_gerade).
    """
    now = utcnow()
    users = list(
        db.exec(
            select(User)
            .where(
                col(User.is_active).is_(True),
                col(User.last_seen_at) >= now - ONLINE_WINDOW,
                col(User.id) != exclude_id,
            )
            .order_by(col(User.display_name), col(User.id))
        ).all()
    )
    if not users:
        return []
    user_ids = [u.id for u in users]
    training_ids = set(
        db.exec(
            select(WorkoutSession.user_id).where(
                col(WorkoutSession.user_id).in_(user_ids),
                col(WorkoutSession.finished_at).is_(None),
                col(WorkoutSession.started_at) >= now - TRAINING_WINDOW,
            )
        ).all()
    )
    return [(u, u.id in training_ids) for u in users]
