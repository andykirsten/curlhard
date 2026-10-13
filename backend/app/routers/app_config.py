from fastapi import APIRouter

from app.deps import CurrentUser, DbSession
from app.schemas.app_config import AppConfigRead
from app.services import app_config as app_config_service

router = APIRouter(tags=["app-config"])


@router.get("/app-config", response_model=AppConfigRead)
def get_app_config(user: CurrentUser, db: DbSession):
    return app_config_service.get_app_config(db)
