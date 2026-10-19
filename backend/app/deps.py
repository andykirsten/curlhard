from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import text
from sqlmodel import Session

from app.config import Settings
from app.errors import ApiError
from app.models import User
from app.services import auth as auth_service


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


def get_session(request: Request) -> Iterator[Session]:
    with Session(request.app.state.engine) as session:
        yield session


DbSession = Annotated[Session, Depends(get_session)]
AppSettings = Annotated[Settings, Depends(get_settings_dep)]


WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def current_user(request: Request, db: DbSession, settings: AppSettings) -> User:
    token = request.cookies.get(settings.cookie_name)
    user = auth_service.resolve_session(db, token, settings.session_days) if token else None
    if user is None:
        raise ApiError(401, "unauthorized", "Nicht angemeldet")
    if request.method in WRITE_METHODS:
        # Schreibende Requests eines Nutzers laufen nacheinander: Lesen-dann-Schreiben-Muster
        # (max()+1, get-or-create, "genau ein aktiver Zyklus") bleiben atomar. Die Sperre
        # gilt bis zum Transaktionsende und blockiert andere Nutzer nicht.
        db.connection().execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": user.id})
    return user


def require_admin(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role != "admin":
        raise ApiError(403, "forbidden", "Nur für Administratoren")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
AdminUser = Annotated[User, Depends(require_admin)]


def rate_limited(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    if not request.app.state.limiter.allow(f"{request.url.path}:{ip}"):
        raise ApiError(429, "rate_limited", "Zu viele Versuche, bitte später erneut versuchen")
