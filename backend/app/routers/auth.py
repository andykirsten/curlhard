from fastapi import APIRouter, Depends, Request, Response
from sqlmodel import select

from app.deps import AppSettings, CurrentUser, DbSession, rate_limited
from app.errors import ApiError
from app.models import User
from app.schemas.auth import (
    ChangePasswordCreate,
    LoginCreate,
    RegisterCreate,
    UserRead,
    UserUpdate,
)
from app.services import auth as auth_service
from app.services import invites

router = APIRouter(prefix="/auth", tags=["auth"])

_DUMMY_HASH = auth_service.hash_password("dummy-password-for-timing")


def _set_cookie(response: Response, settings, token: str) -> None:
    response.set_cookie(
        settings.cookie_name,
        token,
        max_age=settings.session_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


@router.post(
    "/register",
    status_code=201,
    response_model=UserRead,
    dependencies=[Depends(rate_limited)],
)
def register(body: RegisterCreate, response: Response, db: DbSession, settings: AppSettings):
    email = body.email.lower()
    if db.exec(select(User).where(User.email == email)).first():
        raise ApiError(409, "email_taken", "E-Mail ist bereits registriert")
    user = User(
        email=email,
        password_hash=auth_service.hash_password(body.password),
        display_name=body.display_name,
    )
    db.add(user)
    db.flush()
    if not invites.consume_invite(db, body.invite_code, user.id):  # type: ignore[arg-type]
        db.rollback()
        raise ApiError(400, "invalid_invite", "Einladungscode ungültig oder abgelaufen")
    db.commit()
    db.refresh(user)
    _set_cookie(response, settings, auth_service.create_session(db, user, settings.session_days))
    return user


@router.post("/login", response_model=UserRead, dependencies=[Depends(rate_limited)])
def login(body: LoginCreate, response: Response, db: DbSession, settings: AppSettings):
    user = db.exec(select(User).where(User.email == body.email.lower())).first()
    ok = auth_service.verify_password(body.password, user.password_hash if user else _DUMMY_HASH)
    if not user or not ok or not user.is_active:
        raise ApiError(401, "unauthorized", "E-Mail oder Passwort falsch")
    _set_cookie(response, settings, auth_service.create_session(db, user, settings.session_days))
    return user


@router.post("/logout", status_code=204)
def logout(request: Request, db: DbSession, settings: AppSettings):
    token = request.cookies.get(settings.cookie_name)
    if token:
        auth_service.revoke_token(db, token)
    response = Response(status_code=204)
    response.delete_cookie(settings.cookie_name, path="/")
    return response


@router.get("/me", response_model=UserRead)
def me(user: CurrentUser):
    return user


@router.patch("/me", response_model=UserRead)
def update_me(body: UserUpdate, user: CurrentUser, db: DbSession):
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/change-password", status_code=204)
def change_password(
    body: ChangePasswordCreate, user: CurrentUser, db: DbSession, settings: AppSettings
):
    if not auth_service.verify_password(body.current_password, user.password_hash):
        raise ApiError(400, "wrong_password", "Aktuelles Passwort ist falsch")
    user.password_hash = auth_service.hash_password(body.new_password)
    db.add(user)
    db.commit()
    auth_service.revoke_all(db, user.id)  # type: ignore[arg-type]
    response = Response(status_code=204)
    _set_cookie(response, settings, auth_service.create_session(db, user, settings.session_days))
    return response
