from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlmodel import Session

from app.config import Settings
from app.errors import ApiError
from app.models import User
from app.services import auth as auth_service


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def get_session(request: Request) -> Iterator[Session]:
    engine = request.app.state.engine
    if request.method in WRITE_METHODS:
        # Schreibende Requests starten mit BEGIN IMMEDIATE (siehe app/db.py)
        engine = engine.execution_options(sqlite_immediate=True)
    with Session(engine) as session:
        yield session


DbSession = Annotated[Session, Depends(get_session)]
AppSettings = Annotated[Settings, Depends(get_settings_dep)]


def current_user(request: Request, db: DbSession, settings: AppSettings) -> User:
    token = request.cookies.get(settings.cookie_name)
    user = auth_service.resolve_session(db, token, settings.session_days) if token else None
    if user is None:
        raise ApiError(401, "unauthorized", "Nicht angemeldet")
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
