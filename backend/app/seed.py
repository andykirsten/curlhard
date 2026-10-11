"""Importiert den Startkatalog (idempotent): python -m app.seed"""

import json
import sys
from pathlib import Path

from sqlmodel import Session, select

from app.models import Equipment, Exercise, ExerciseSecondaryMuscle, MuscleGroup

DEFAULT_FILE = Path(__file__).resolve().parent.parent / "seeds" / "exercises.json"


def _get_or_create(db: Session, model, name: str):
    obj = db.exec(select(model).where(model.name == name)).first()
    if obj is None:
        obj = model(name=name)
        db.add(obj)
        db.flush()
    return obj


def seed_catalog(db: Session, path: Path = DEFAULT_FILE) -> dict[str, int]:
    data = json.loads(path.read_text(encoding="utf-8"))
    groups = {n: _get_or_create(db, MuscleGroup, n) for n in data["muscle_groups"]}
    equipment = {n: _get_or_create(db, Equipment, n) for n in data["equipment"]}
    created = 0
    for item in data["exercises"]:
        exists = db.exec(
            select(Exercise).where(
                Exercise.name == item["name"],
                Exercise.owner_user_id.is_(None),  # type: ignore[union-attr]
            )
        ).first()
        if exists:
            continue
        ex = Exercise(
            name=item["name"],
            owner_user_id=None,
            primary_muscle_group_id=groups[item["primary"]].id,
            equipment_id=equipment[item["equipment"]].id,
            load_type=item.get("load_type", "weight"),
        )
        db.add(ex)
        db.flush()
        for sec in item.get("secondary", []):
            db.add(
                ExerciseSecondaryMuscle(
                    exercise_id=ex.id,  # type: ignore[arg-type]
                    muscle_group_id=groups[sec].id,  # type: ignore[arg-type]
                )
            )
        created += 1
    db.commit()
    return {"created": created, "total": len(data["exercises"])}


def main() -> None:
    from app.config import get_settings
    from app.db import make_engine

    engine = make_engine(get_settings().database_url)
    with Session(engine) as db:
        result = seed_catalog(db, Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_FILE)
    print(f"Seed fertig: {result['created']} neue Übungen ({result['total']} im Katalog)")


if __name__ == "__main__":
    main()
