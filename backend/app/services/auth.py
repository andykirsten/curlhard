import hashlib
import logging
import secrets
from datetime import timedelta

from pwdlib import PasswordHash
from sqlalchemy import delete
from sqlalchemy.exc import OperationalError
from sqlmodel import Session, select

from app.models import AuthSession, User, utcnow

_hasher = PasswordHash.recommended()
logger = logging.getLogger("curlhard")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password, password_hash)
    except Exception:
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, user: User, days: int, commit: bool = True) -> str:
    token = secrets.token_urlsafe(32)
    db.add(
        AuthSession(
            user_id=user.id,  # type: ignore[arg-type]
            token_hash=hash_token(token),
            expires_at=utcnow() + timedelta(days=days),
        )
    )
    if commit:
        db.commit()
    return token


def resolve_session(db: Session, token: str, days: int) -> User | None:
    row = db.exec(select(AuthSession).where(AuthSession.token_hash == hash_token(token))).first()
    if row is None:
        return None
    now = utcnow()
    if row.expires_at < now:
        db.delete(row)
        db.commit()
        return None
    user_id = row.user_id
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        return None
    changed = False
    # gleitende Laufzeit; Schreibzugriff höchstens einmal pro Stunde
    if row.expires_at - now < timedelta(days=days) - timedelta(hours=1):
        row.expires_at = now + timedelta(days=days)
        db.add(row)
        changed = True
    # Online-Status; Schreibzugriff höchstens einmal pro Minute
    if user.last_seen_at is None or now - user.last_seen_at > timedelta(seconds=60):
        user.last_seen_at = now
        db.add(user)
        changed = True
    if changed:
        # Best-effort: Bookkeeping darf den eigentlichen Request nicht scheitern lassen
        try:
            db.commit()
        except OperationalError:
            logger.warning("Session-Bookkeeping übersprungen (Datenbank ausgelastet)")
            db.rollback()
            user = db.get(User, user_id)
            if user is None or not user.is_active:
                return None
    return user


def revoke_token(db: Session, token: str) -> None:
    db.execute(delete(AuthSession).where(AuthSession.token_hash == hash_token(token)))  # type: ignore[arg-type]
    db.commit()


def revoke_all(db: Session, user_id: int, commit: bool = True) -> None:
    db.execute(delete(AuthSession).where(AuthSession.user_id == user_id))  # type: ignore[arg-type]
    if commit:
        db.commit()
