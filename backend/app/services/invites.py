import hashlib
import secrets
from datetime import timedelta

from sqlalchemy import update
from sqlmodel import Session

from app.models import InviteCode, utcnow


def hash_code(code: str) -> str:
    return hashlib.sha256(code.strip().encode()).hexdigest()


def create_invite(db: Session, admin_id: int, days: int) -> tuple[InviteCode, str]:
    code = secrets.token_urlsafe(12)
    invite = InviteCode(
        code_hash=hash_code(code),
        created_by_user_id=admin_id,
        expires_at=utcnow() + timedelta(days=days),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite, code


def consume_invite(db: Session, code: str, user_id: int) -> bool:
    """Markiert den Code atomar als verbraucht; False wenn ungültig, benutzt oder abgelaufen."""
    now = utcnow()
    result = db.execute(
        update(InviteCode)
        .where(
            InviteCode.code_hash == hash_code(code),  # type: ignore[arg-type]
            InviteCode.used_at.is_(None),  # type: ignore[union-attr]
            InviteCode.expires_at > now,  # type: ignore[arg-type]
        )
        .values(used_by_user_id=user_id, used_at=now)
    )
    return result.rowcount == 1  # type: ignore[attr-defined]
