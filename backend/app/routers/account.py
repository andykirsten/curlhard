from datetime import date

from fastapi import APIRouter, Response
from sqlalchemy import delete, or_, update
from sqlmodel import SQLModel, select

from app.deps import AppSettings, CurrentUser, DbSession
from app.errors import ApiError
from app.models import (
    Exercise,
    ExerciseNote,
    ExerciseSecondaryMuscle,
    ExerciseSetting,
    InviteCode,
    Plan,
    PlanDay,
    PlanExercise,
    SessionExercise,
    SetLog,
    TrainingCycle,
    User,
    UserAvatar,
    WorkoutSession,
)
from app.schemas.auth import AccountDelete
from app.services import auth as auth_service

router = APIRouter(prefix="/account", tags=["account"])


def _rows(db, model: type[SQLModel], **where) -> list[dict]:
    stmt = select(model)
    for key, value in where.items():
        stmt = stmt.where(getattr(model, key) == value)
    return [_jsonable(r.model_dump()) for r in db.exec(stmt).all()]


def _jsonable(d: dict) -> dict:
    return {k: (v.isoformat() if isinstance(v, date) else v) for k, v in d.items()}


@router.get("/export")
def export_data(user: CurrentUser, db: DbSession):
    """DSGVO-Datenexport: alle Daten des Users als JSON."""
    uid = user.id
    profile = {
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
        "body_weight_kg": user.body_weight_kg,
        "created_at": user.created_at.isoformat(),
    }
    return {
        "profile": profile,
        "private_exercises": _rows(db, Exercise, owner_user_id=uid),
        "plans": _rows(db, Plan, user_id=uid),
        "plan_days": _rows(db, PlanDay, user_id=uid),
        "plan_exercises": _rows(db, PlanExercise, user_id=uid),
        "sessions": _rows(db, WorkoutSession, user_id=uid),
        "session_exercises": _rows(db, SessionExercise, user_id=uid),
        "sets": _rows(db, SetLog, user_id=uid),
        "exercise_notes": _rows(db, ExerciseNote, user_id=uid),
        "exercise_settings": _rows(db, ExerciseSetting, user_id=uid),
        "training_cycles": _rows(db, TrainingCycle, user_id=uid),
        # Avatar-Bytes bewusst nicht im Export, nur das Vorhandensein
        "has_avatar": db.exec(select(UserAvatar.id).where(UserAvatar.user_id == uid)).first()  # type: ignore[arg-type]
        is not None,
    }


@router.post("/delete", status_code=204)
def delete_account(body: AccountDelete, user: CurrentUser, db: DbSession, settings: AppSettings):
    """Löscht den Account mit allen Daten."""
    if not auth_service.verify_password(body.password, user.password_hash):
        raise ApiError(400, "wrong_password", "Passwort ist falsch")
    uid = user.id
    private_ids = select(Exercise.id).where(Exercise.owner_user_id == uid)
    db.execute(delete(SetLog).where(SetLog.user_id == uid))  # type: ignore[arg-type]
    db.execute(delete(SessionExercise).where(SessionExercise.user_id == uid))  # type: ignore[arg-type]
    db.execute(delete(WorkoutSession).where(WorkoutSession.user_id == uid))  # type: ignore[arg-type]
    db.execute(delete(TrainingCycle).where(TrainingCycle.user_id == uid))  # type: ignore[arg-type]
    db.execute(delete(UserAvatar).where(UserAvatar.user_id == uid))  # type: ignore[arg-type]
    db.execute(delete(ExerciseNote).where(ExerciseNote.user_id == uid))  # type: ignore[arg-type]
    db.execute(delete(ExerciseSetting).where(ExerciseSetting.user_id == uid))  # type: ignore[arg-type]
    db.execute(delete(PlanExercise).where(PlanExercise.user_id == uid))  # type: ignore[arg-type]
    db.execute(delete(PlanDay).where(PlanDay.user_id == uid))  # type: ignore[arg-type]
    db.execute(delete(Plan).where(Plan.user_id == uid))  # type: ignore[arg-type]
    db.execute(
        delete(ExerciseSecondaryMuscle).where(
            ExerciseSecondaryMuscle.exercise_id.in_(private_ids)  # type: ignore[attr-defined]
        )
    )
    db.execute(delete(Exercise).where(Exercise.owner_user_id == uid))  # type: ignore[arg-type]
    db.execute(
        update(InviteCode)
        .where(InviteCode.used_by_user_id == uid)  # type: ignore[arg-type]
        .values(used_by_user_id=None)
    )
    db.execute(
        delete(InviteCode).where(
            or_(InviteCode.created_by_user_id == uid)  # type: ignore[arg-type]
        )
    )
    auth_service.revoke_all(db, uid, commit=False)  # type: ignore[arg-type]
    db.execute(delete(User).where(User.id == uid))  # type: ignore[arg-type]
    db.commit()
    response = Response(status_code=204)
    response.delete_cookie(settings.cookie_name, path="/")
    return response
