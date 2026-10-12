from fastapi import APIRouter, Response
from sqlmodel import select

from app.deps import CurrentUser, DbSession
from app.errors import not_found
from app.models import User, UserAvatar
from app.schemas.auth import avatar_url_for
from app.schemas.users import OnlineUserRead
from app.services.presence import online_users

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/online", response_model=list[OnlineUserRead])
def list_online_users(user: CurrentUser, db: DbSession):
    return [
        OnlineUserRead(
            id=u.id,  # type: ignore[arg-type]
            display_name=u.display_name,
            avatar_url=avatar_url_for(u.id, u.avatar_updated_at),  # type: ignore[arg-type]
            is_training=training,
        )
        for u, training in online_users(db, user.id)  # type: ignore[arg-type]
    ]


@router.get(
    "/{user_id}/avatar",
    response_class=Response,
    responses={200: {"content": {"image/*": {}}, "description": "Avatar-Bild"}},
)
def get_user_avatar(user_id: int, user: CurrentUser, db: DbSession) -> Response:
    """Avatare sind für alle eingeloggten Nutzer sichtbar, außer von deaktivierten Nutzern."""
    owner = db.get(User, user_id)
    if owner is None or not owner.is_active:
        raise not_found("Avatar")
    avatar = db.exec(select(UserAvatar).where(UserAvatar.user_id == user_id)).first()
    if avatar is None:
        raise not_found("Avatar")
    return Response(
        content=avatar.data,
        media_type=avatar.content_type,
        headers={
            "Cache-Control": "private, max-age=86400",
            "X-Content-Type-Options": "nosniff",
        },
    )
