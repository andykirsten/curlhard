from sqlmodel import Session, col, select

from app.models import ExerciseSecondaryMuscle


def secondary_map(db: Session, ids: list[int]) -> dict[int, list[int]]:
    """Nebenmuskel-Gruppen je Übung (Übungen ohne Nebenmuskeln bekommen eine leere Liste)."""
    result: dict[int, list[int]] = {i: [] for i in ids}
    if not ids:
        return result
    rows = db.exec(
        select(ExerciseSecondaryMuscle).where(col(ExerciseSecondaryMuscle.exercise_id).in_(ids))
    ).all()
    for row in rows:
        result[row.exercise_id].append(row.muscle_group_id)
    return result
