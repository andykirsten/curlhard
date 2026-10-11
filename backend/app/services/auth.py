import hashlib
import secrets
from datetime import timedelta

from pwdlib import PasswordHash
from sqlalchemy import delete
from sqlmodel import Session, select

from app.models import AuthSession, User, utcnow

_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password, password_hash)
    except Exception:
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, user: User, days: int) -> str:
    token = secrets.token_urlsafe(32)
    db.add(
        AuthSession(
            user_id=user.id,  # type: ignore[arg-type]
            token_hash=hash_token(token),
            expires_at=utcnow() + timedelta(days=days),
        )
    )
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
    user = db.get(User, row.user_id)
    if user is None or not user.is_active:
        return None
    # gleitende Laufzeit; Schreibzugriff höchstens einmal pro Stunde
    if row.expires_at - now < timedelta(days=days) - timedelta(hours=1):
        row.expires_at = now + timedelta(days=days)
        db.add(row)
        db.commit()
    return user


def revoke_token(db: Session, token: str) -> None:
    db.execute(delete(AuthSession).where(AuthSession.token_hash == hash_token(token)))  # type: ignore[arg-type]
    db.commit()


def revoke_all(db: Session, user_id: int) -> None:
    db.execute(delete(AuthSession).where(AuthSession.user_id == user_id))  # type: ignore[arg-type]
    db.commit()
