from fastapi import APIRouter, Response
from sqlmodel import select

from app.deps import AdminUser, DbSession
from app.errors import not_found
from app.models import InviteCode
from app.schemas.app_config import AppConfigRead, AppConfigUpdate
from app.schemas.auth import InviteCreate, InviteCreated, InviteRead
from app.services import invites
from app.services.app_config import get_app_config as load_app_config

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/invites", response_model=list[InviteRead])
def list_invites(admin: AdminUser, db: DbSession, limit: int = 50, offset: int = 0):
    stmt = select(InviteCode).order_by(InviteCode.id.desc()).limit(limit).offset(offset)  # type: ignore[attr-defined]
    return db.exec(stmt).all()


@router.post("/invites", status_code=201, response_model=InviteCreated)
def create_invite(body: InviteCreate, admin: AdminUser, db: DbSession):
    invite, code = invites.create_invite(db, admin.id, body.expires_in_days)  # type: ignore[arg-type]
    return InviteCreated(
        id=invite.id,  # type: ignore[arg-type]
        expires_at=invite.expires_at,
        used_at=invite.used_at,
        created_at=invite.created_at,
        code=code,
    )


@router.delete("/invites/{invite_id}", status_code=204)
def delete_invite(invite_id: int, admin: AdminUser, db: DbSession):
    invite = db.get(InviteCode, invite_id)
    if invite is None:
        raise not_found("Einladung")
    db.delete(invite)
    db.commit()
    return Response(status_code=204)


@router.put("/app-config", response_model=AppConfigRead)
def update_app_config(body: AppConfigUpdate, admin: AdminUser, db: DbSession):
    config = load_app_config(db)
    config.kliment_mode = body.kliment_mode
    db.add(config)
    db.commit()
    db.refresh(config)
    return config
