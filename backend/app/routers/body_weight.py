from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Response
from sqlmodel import select

from app.deps import CurrentUser, DbSession
from app.errors import ApiError
from app.models import BodyWeightLog
from app.repositories.common import get_owned
from app.schemas.body_weight import BodyWeightCreate, BodyWeightRead
from app.services import body_weight as body_weight_service

router = APIRouter(prefix="/body-weight", tags=["body-weight"])


@router.get("", response_model=list[BodyWeightRead])
def list_body_weight(
    user: CurrentUser,
    db: DbSession,
    from_: Annotated[date | None, Query(alias="from")] = None,
    to: date | None = None,
):
    stmt = select(BodyWeightLog).where(BodyWeightLog.user_id == user.id)
    if from_ is not None:
        stmt = stmt.where(BodyWeightLog.measured_on >= from_)
    if to is not None:
        stmt = stmt.where(BodyWeightLog.measured_on <= to)
    return db.exec(stmt.order_by(BodyWeightLog.measured_on)).all()  # type: ignore[arg-type]


@router.post("", response_model=BodyWeightRead)
def save_body_weight(body: BodyWeightCreate, user: CurrentUser, db: DbSession):
    """Trägt das Körpergewicht eines Tages ein (Upsert pro Tag)."""
    today = date.today()
    measured_on = body.measured_on or today
    if measured_on > today:
        raise ApiError(422, "future_date", "Das Datum liegt in der Zukunft")
    return body_weight_service.set_weight(db, user, measured_on, body.weight_kg)


@router.delete("/{entry_id}", status_code=204)
def delete_body_weight(entry_id: int, user: CurrentUser, db: DbSession):
    row = get_owned(db, BodyWeightLog, entry_id, user.id, "Eintrag")  # type: ignore[arg-type]
    db.delete(row)
    db.flush()
    body_weight_service.sync_current_weight(db, user)
    db.commit()
    return Response(status_code=204)
