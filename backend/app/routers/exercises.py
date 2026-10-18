from fastapi import APIRouter
from sqlalchemy import or_
from sqlmodel import Session, col, select

from app.deps import AdminUser, CurrentUser, DbSession
from app.errors import ApiError, not_found
from app.models import (
    Equipment,
    Exercise,
    ExerciseNote,
    ExerciseSecondaryMuscle,
    ExerciseSetting,
    MuscleGroup,
)
from app.repositories.common import get_visible_exercise
from app.schemas.exercises import (
    ExerciseCreate,
    ExerciseRead,
    ExerciseSettingRead,
    ExerciseSettingUpdate,
    ExerciseUpdate,
    NamedCreate,
    NamedRead,
    NamedUpdate,
    NoteRead,
    NoteUpdate,
)

router = APIRouter(tags=["exercises"])


# ---- Muskelgruppen & Equipment -------------------------------------------------------------


def _named_routes(
    path: str, model: type[MuscleGroup] | type[Equipment], label: str, slug: str
) -> None:
    @router.get(f"/{path}", response_model=list[NamedRead], name=f"list_{slug}")
    def list_items(user: CurrentUser, db: DbSession):
        return db.exec(select(model).order_by(model.name)).all()

    @router.post(f"/{path}", status_code=201, response_model=NamedRead, name=f"create_{slug}")
    def create_item(body: NamedCreate, admin: AdminUser, db: DbSession):
        if db.exec(select(model).where(model.name == body.name)).first():
            raise ApiError(409, "conflict", f"{label} existiert bereits")
        item = model(name=body.name)
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @router.patch(f"/{path}/{{item_id}}", response_model=NamedRead, name=f"update_{slug}")
    def update_item(item_id: int, body: NamedUpdate, admin: AdminUser, db: DbSession):
        item = db.get(model, item_id)
        if item is None:
            raise not_found(label)
        if body.name is not None:
            clash = db.exec(
                select(model).where(model.name == body.name, model.id != item_id)
            ).first()
            if clash:
                raise ApiError(409, "conflict", f"{label} existiert bereits")
            item.name = body.name
        db.add(item)
        db.commit()
        db.refresh(item)
        return item


_named_routes("muscle-groups", MuscleGroup, "Muskelgruppe", "muscle_groups")
_named_routes("equipment", Equipment, "Equipment", "equipment")


# ---- Übungen -------------------------------------------------------------------------------


def _secondary_map(db: Session, ids: list[int]) -> dict[int, list[int]]:
    result: dict[int, list[int]] = {i: [] for i in ids}
    if not ids:
        return result
    rows = db.exec(
        select(ExerciseSecondaryMuscle).where(col(ExerciseSecondaryMuscle.exercise_id).in_(ids))
    ).all()
    for row in rows:
        result[row.exercise_id].append(row.muscle_group_id)
    return result


def _to_read(ex: Exercise, secondary: list[int]) -> ExerciseRead:
    return ExerciseRead(
        id=ex.id,  # type: ignore[arg-type]
        name=ex.name,
        description=ex.description,
        owner_user_id=ex.owner_user_id,
        is_global=ex.owner_user_id is None,
        primary_muscle_group_id=ex.primary_muscle_group_id,
        secondary_muscle_group_ids=sorted(secondary),
        equipment_id=ex.equipment_id,
        load_type=ex.load_type,
        is_active=ex.is_active,
    )


def _read_one(db: Session, ex: Exercise) -> ExerciseRead:
    return _to_read(ex, _secondary_map(db, [ex.id])[ex.id])  # type: ignore[index,list-item]


def _check_refs(
    db: Session, primary: int | None, equipment: int | None, secondary: list[int] | None
) -> None:
    if primary is not None and db.get(MuscleGroup, primary) is None:
        raise ApiError(422, "invalid_reference", "Muskelgruppe unbekannt")
    if equipment is not None and db.get(Equipment, equipment) is None:
        raise ApiError(422, "invalid_reference", "Equipment unbekannt")
    for mg in secondary or []:
        if db.get(MuscleGroup, mg) is None:
            raise ApiError(422, "invalid_reference", "Muskelgruppe unbekannt")


def _check_unique_name(db: Session, name: str, owner: int | None, exclude: int | None = None):
    stmt = select(Exercise).where(Exercise.name == name)
    stmt = stmt.where(
        Exercise.owner_user_id.is_(None)  # type: ignore[union-attr]
        if owner is None
        else Exercise.owner_user_id == owner
    )
    if exclude is not None:
        stmt = stmt.where(Exercise.id != exclude)
    if db.exec(stmt).first():
        raise ApiError(409, "conflict", "Eine Übung mit diesem Namen existiert bereits")


def _set_secondary(db: Session, exercise_id: int, ids: list[int]) -> None:
    for row in db.exec(
        select(ExerciseSecondaryMuscle).where(ExerciseSecondaryMuscle.exercise_id == exercise_id)
    ).all():
        db.delete(row)
    db.flush()
    for mg in set(ids):
        db.add(ExerciseSecondaryMuscle(exercise_id=exercise_id, muscle_group_id=mg))


@router.get("/exercises", response_model=list[ExerciseRead])
def list_exercises(
    user: CurrentUser,
    db: DbSession,
    search: str | None = None,
    muscle_group: int | None = None,
    equipment: int | None = None,
    include_inactive: bool = False,
    limit: int = 200,
    offset: int = 0,
):
    stmt = select(Exercise).where(
        or_(
            Exercise.owner_user_id.is_(None),  # type: ignore[union-attr]
            Exercise.owner_user_id == user.id,
        )
    )
    if not include_inactive:
        stmt = stmt.where(Exercise.is_active)
    if search:
        stmt = stmt.where(col(Exercise.name).ilike(f"%{search}%"))
    if equipment is not None:
        stmt = stmt.where(Exercise.equipment_id == equipment)
    if muscle_group is not None:
        secondary = select(ExerciseSecondaryMuscle.exercise_id).where(
            ExerciseSecondaryMuscle.muscle_group_id == muscle_group
        )
        stmt = stmt.where(
            or_(
                Exercise.primary_muscle_group_id == muscle_group,
                col(Exercise.id).in_(secondary),
            )
        )
    rows = db.exec(stmt.order_by(col(Exercise.name)).limit(limit).offset(offset)).all()
    sec = _secondary_map(db, [r.id for r in rows])  # type: ignore[misc]
    return [_to_read(r, sec[r.id]) for r in rows]  # type: ignore[index]


@router.get("/exercises/{exercise_id}", response_model=ExerciseRead)
def get_exercise(exercise_id: int, user: CurrentUser, db: DbSession):
    return _read_one(db, get_visible_exercise(db, exercise_id, user.id))  # type: ignore[arg-type]


@router.post("/exercises", status_code=201, response_model=ExerciseRead)
def create_exercise(body: ExerciseCreate, user: CurrentUser, db: DbSession):
    if body.is_global and user.role != "admin":
        raise ApiError(403, "forbidden", "Globale Übungen darf nur ein Admin anlegen")
    owner = None if body.is_global else user.id
    _check_refs(
        db, body.primary_muscle_group_id, body.equipment_id, body.secondary_muscle_group_ids
    )
    _check_unique_name(db, body.name, owner)
    ex = Exercise(
        name=body.name,
        description=body.description,
        owner_user_id=owner,
        primary_muscle_group_id=body.primary_muscle_group_id,
        equipment_id=body.equipment_id,
        load_type=body.load_type,
    )
    db.add(ex)
    db.flush()
    _set_secondary(db, ex.id, body.secondary_muscle_group_ids)  # type: ignore[arg-type]
    db.commit()
    db.refresh(ex)
    return _read_one(db, ex)


@router.patch("/exercises/{exercise_id}", response_model=ExerciseRead)
def update_exercise(exercise_id: int, body: ExerciseUpdate, user: CurrentUser, db: DbSession):
    ex = get_visible_exercise(db, exercise_id, user.id)  # type: ignore[arg-type]
    if ex.owner_user_id is None and user.role != "admin":
        raise ApiError(403, "forbidden", "Globale Übungen darf nur ein Admin ändern")
    data = body.model_dump(exclude_unset=True)
    _check_refs(
        db,
        data.get("primary_muscle_group_id"),
        data.get("equipment_id"),
        data.get("secondary_muscle_group_ids"),
    )
    if data.get("name") is not None:
        _check_unique_name(db, data["name"], ex.owner_user_id, exclude=ex.id)
    secondary = data.pop("secondary_muscle_group_ids", None)
    for key, value in data.items():
        if key in ("name", "load_type", "is_active", "description") and value is None:
            continue
        setattr(ex, key, value)
    if secondary is not None:
        _set_secondary(db, ex.id, secondary)  # type: ignore[arg-type]
    db.add(ex)
    db.commit()
    db.refresh(ex)
    return _read_one(db, ex)


# ---- Dauerhaftes Memo ----------------------------------------------------------------------


@router.get("/exercises/{exercise_id}/note", response_model=NoteRead)
def get_note(exercise_id: int, user: CurrentUser, db: DbSession):
    get_visible_exercise(db, exercise_id, user.id)  # type: ignore[arg-type]
    note = db.exec(
        select(ExerciseNote).where(
            ExerciseNote.user_id == user.id, ExerciseNote.exercise_id == exercise_id
        )
    ).first()
    return NoteRead(exercise_id=exercise_id, note=note.note if note else "")


@router.put("/exercises/{exercise_id}/note", response_model=NoteRead)
def put_note(exercise_id: int, body: NoteUpdate, user: CurrentUser, db: DbSession):
    get_visible_exercise(db, exercise_id, user.id)  # type: ignore[arg-type]
    note = db.exec(
        select(ExerciseNote).where(
            ExerciseNote.user_id == user.id, ExerciseNote.exercise_id == exercise_id
        )
    ).first()
    if note is None:
        note = ExerciseNote(user_id=user.id, exercise_id=exercise_id, note=body.note)  # type: ignore[arg-type]
    else:
        note.note = body.note
    db.add(note)
    db.commit()
    return NoteRead(exercise_id=exercise_id, note=body.note)


# ---- Persönliche Übungs-Einstellungen ------------------------------------------------------

# Standard-Stangengewicht nach Equipment; andere Equipments haben keinen Scheibenrechner
DEFAULT_BAR_WEIGHT_KG = {"Langhantel": 20.0, "SZ-Stange": 10.0}


def _default_bar_weight(db: Session, ex: Exercise) -> float | None:
    if ex.equipment_id is None:
        return None
    equipment = db.get(Equipment, ex.equipment_id)
    return DEFAULT_BAR_WEIGHT_KG.get(equipment.name) if equipment else None


def _get_setting(db: Session, user_id: int, exercise_id: int) -> ExerciseSetting | None:
    return db.exec(
        select(ExerciseSetting).where(
            ExerciseSetting.user_id == user_id, ExerciseSetting.exercise_id == exercise_id
        )
    ).first()


@router.get("/exercises/{exercise_id}/setting", response_model=ExerciseSettingRead)
def get_exercise_setting(exercise_id: int, user: CurrentUser, db: DbSession):
    ex = get_visible_exercise(db, exercise_id, user.id)  # type: ignore[arg-type]
    setting = _get_setting(db, user.id, exercise_id)  # type: ignore[arg-type]
    return ExerciseSettingRead(
        exercise_id=exercise_id,
        bar_weight_kg=setting.bar_weight_kg if setting else None,
        default_bar_weight_kg=_default_bar_weight(db, ex),
    )


@router.put("/exercises/{exercise_id}/setting", response_model=ExerciseSettingRead)
def put_exercise_setting(
    exercise_id: int, body: ExerciseSettingUpdate, user: CurrentUser, db: DbSession
):
    ex = get_visible_exercise(db, exercise_id, user.id)  # type: ignore[arg-type]
    setting = _get_setting(db, user.id, exercise_id)  # type: ignore[arg-type]
    if setting is None:
        setting = ExerciseSetting(user_id=user.id, exercise_id=exercise_id)  # type: ignore[arg-type]
    setting.bar_weight_kg = body.bar_weight_kg
    db.add(setting)
    db.commit()
    return ExerciseSettingRead(
        exercise_id=exercise_id,
        bar_weight_kg=body.bar_weight_kg,
        default_bar_weight_kg=_default_bar_weight(db, ex),
    )
