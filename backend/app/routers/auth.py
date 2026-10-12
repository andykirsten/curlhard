from typing import Annotated

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from sqlalchemy import delete
from sqlmodel import select

from app.deps import AppSettings, CurrentUser, DbSession, rate_limited
from app.errors import ApiError
from app.models import User, UserAvatar, utcnow
from app.schemas.auth import (
    ChangePasswordCreate,
    LoginCreate,
    RegisterCreate,
    UserRead,
    UserUpdate,
)
from app.services import auth as auth_service
from app.services import invites
from app.services.avatar import MAX_AVATAR_BYTES, detect_image_type

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
    return UserRead.from_user(user)


@router.post("/login", response_model=UserRead, dependencies=[Depends(rate_limited)])
def login(body: LoginCreate, response: Response, db: DbSession, settings: AppSettings):
    user = db.exec(select(User).where(User.email == body.email.lower())).first()
    ok = auth_service.verify_password(body.password, user.password_hash if user else _DUMMY_HASH)
    if not user or not ok or not user.is_active:
        raise ApiError(401, "unauthorized", "E-Mail oder Passwort falsch")
    _set_cookie(response, settings, auth_service.create_session(db, user, settings.session_days))
    return UserRead.from_user(user)


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
    return UserRead.from_user(user)


@router.patch("/me", response_model=UserRead)
def update_me(body: UserUpdate, user: CurrentUser, db: DbSession):
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserRead.from_user(user)


@router.put("/me/avatar", response_model=UserRead)
def upload_avatar(
    user: CurrentUser,
    db: DbSession,
    file: Annotated[UploadFile, File(...)],
):
    data = file.file.read(MAX_AVATAR_BYTES + 1)
    if len(data) > MAX_AVATAR_BYTES:
        raise ApiError(422, "image_too_large", "Bild ist zu groß (max. 512 KB)")
    content_type = detect_image_type(data)
    if content_type is None:
        raise ApiError(422, "invalid_image", "Ungültiges Bild")
    avatar = db.exec(select(UserAvatar).where(UserAvatar.user_id == user.id)).first()
    if avatar is None:
        avatar = UserAvatar(user_id=user.id, content_type=content_type, data=data)  # type: ignore[arg-type]
    else:
        avatar.content_type = content_type
        avatar.data = data
    user.avatar_updated_at = utcnow()
    db.add(avatar)
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserRead.from_user(user)


@router.delete("/me/avatar", status_code=204)
def delete_avatar(user: CurrentUser, db: DbSession):
    db.execute(delete(UserAvatar).where(UserAvatar.user_id == user.id))  # type: ignore[arg-type]
    user.avatar_updated_at = None
    db.add(user)
    db.commit()
    return Response(status_code=204)


@router.post("/change-password", status_code=204)
def change_password(
    body: ChangePasswordCreate, user: CurrentUser, db: DbSession, settings: AppSettings
):
    if not auth_service.verify_password(body.current_password, user.password_hash):
        raise ApiError(400, "wrong_password", "Aktuelles Passwort ist falsch")
    user.password_hash = auth_service.hash_password(body.new_password)
    db.add(user)
    # Passwort, Sitzungswiderruf und neue Sitzung in einer Transaktion: kein Zwischenzustand
    auth_service.revoke_all(db, user.id, commit=False)  # type: ignore[arg-type]
    token = auth_service.create_session(db, user, settings.session_days, commit=False)
    db.commit()
    response = Response(status_code=204)
    _set_cookie(response, settings, token)
    return response
