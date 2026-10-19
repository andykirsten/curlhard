"""Importiert ein FitNotes-Backup (.fitnotes = SQLite) für einen bestehenden Benutzer.

Aufruf: python -m app.import_fitnotes DATEI EMAIL [--dry-run]

- Pro Trainingstag entsteht eine Session mit den Übungen in der Reihenfolge des ersten Satzes.
- Übungen ohne Historie werden nicht angelegt. Namensgleiche sichtbare Übungen (global oder eigene)
  werden wiederverwendet, alle anderen als private Übung angelegt (Kategorie -> Hauptmuskelgruppe).
- Ein zweiter Import für denselben Benutzer wird abgelehnt (Marker in Session.note).
"""

import argparse
import sqlite3
from collections import defaultdict
from datetime import UTC, date, datetime, time, timedelta

from sqlmodel import Session, col, select

from app.config import get_settings
from app.db import make_engine
from app.models import (
    Exercise,
    ExerciseNote,
    MuscleGroup,
    SessionExercise,
    SetLog,
    User,
    WorkoutSession,
)

MARKER = "FitNotes-Import"

CATEGORY_GROUP = {
    "Shoulders": "Schultern",
    "Triceps": "Trizeps",
    "Biceps": "Bizeps",
    "Chest": "Brust",
    "Back": "Rücken",
    "Legs": "Quadrizeps",
    "Abs": "Bauch",
}
LEG_KEYWORDS = (
    (("leg curl", "hamstring"), "Beinbeuger"),
    (("calf",), "Waden"),
    (("glute", "hip thrust", "bridge"), "Gesäß"),
)


def _group_for(category: str, name: str, groups: dict[str, int]) -> int | None:
    target = CATEGORY_GROUP.get(category)
    if target == "Quadrizeps":
        lowered = name.lower()
        for keywords, group in LEG_KEYWORDS:
            if any(k in lowered for k in keywords):
                target = group
                break
    return groups.get(target) if target else None


def _noon(day: str) -> datetime:
    return datetime.combine(date.fromisoformat(day), time(12, 0), tzinfo=UTC)


def import_fitnotes(db: Session, path: str, email: str) -> dict[str, int]:
    user = db.exec(select(User).where(User.email == email.lower())).first()
    if user is None:
        raise SystemExit(f"Benutzer {email} nicht gefunden")
    already = db.exec(
        select(WorkoutSession.id).where(
            WorkoutSession.user_id == user.id, WorkoutSession.note == MARKER
        )
    ).first()
    if already is not None:
        raise SystemExit("Für diesen Benutzer wurde schon ein FitNotes-Import durchgeführt")

    src = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    src.row_factory = sqlite3.Row
    fn_exercises = {
        r["_id"]: r
        for r in src.execute(
            "SELECT e._id, e.name, e.notes, e.exercise_type_id, c.name AS category "
            "FROM exercise e LEFT JOIN Category c ON c._id = e.category_id"
        )
    }
    logs = src.execute(
        "SELECT _id, exercise_id, date, metric_weight, reps, duration_seconds "
        "FROM training_log ORDER BY date, _id"
    ).fetchall()

    used = {r["exercise_id"] for r in logs}
    zero_weight_only = {
        eid for eid in used if all(r["metric_weight"] == 0 for r in logs if r["exercise_id"] == eid)
    }
    groups = {m.name: m.id for m in db.exec(select(MuscleGroup)).all()}
    visible = {
        e.name.lower(): e
        for e in db.exec(
            select(Exercise).where(
                (col(Exercise.owner_user_id).is_(None)) | (Exercise.owner_user_id == user.id)
            )
        ).all()
    }

    mapping: dict[int, Exercise] = {}
    created = reused = notes = 0
    for eid in sorted(used):
        fe = fn_exercises[eid]
        existing = visible.get(fe["name"].strip().lower())
        if existing is not None:
            mapping[eid] = existing
            reused += 1
            continue
        if fe["exercise_type_id"] == 1:
            load_type = "time"
        elif eid in zero_weight_only:
            load_type = "bodyweight"
        else:
            load_type = "weight"
        ex = Exercise(
            name=fe["name"].strip(),
            owner_user_id=user.id,
            primary_muscle_group_id=_group_for(fe["category"] or "", fe["name"], groups),
            load_type=load_type,
        )
        db.add(ex)
        db.flush()
        mapping[eid] = ex
        visible[ex.name.lower()] = ex
        created += 1

    for eid, ex in mapping.items():
        text_note = (fn_exercises[eid]["notes"] or "").strip()
        if text_note and ex.owner_user_id == user.id:
            db.add(ExerciseNote(user_id=user.id, exercise_id=ex.id, note=text_note))
            notes += 1

    by_day: dict[str, list[sqlite3.Row]] = defaultdict(list)
    for r in logs:
        by_day[r["date"]].append(r)

    sessions = sets = 0
    for day, rows in sorted(by_day.items()):
        start = _noon(day)
        ws = WorkoutSession(
            user_id=user.id,
            started_at=start,
            finished_at=start + timedelta(minutes=len(rows)),
            note=MARKER,
        )
        db.add(ws)
        db.flush()
        positions: dict[int, SessionExercise] = {}
        counters: dict[int, int] = defaultdict(int)
        for i, r in enumerate(rows):
            eid = r["exercise_id"]
            se = positions.get(eid)
            if se is None:
                se = SessionExercise(
                    user_id=user.id,
                    session_id=ws.id,
                    exercise_id=mapping[eid].id,
                    position=len(positions),
                )
                db.add(se)
                db.flush()
                positions[eid] = se
            counters[eid] += 1
            is_time = mapping[eid].load_type == "time"
            db.add(
                SetLog(
                    user_id=user.id,
                    exercise_id=mapping[eid].id,
                    session_exercise_id=se.id,
                    set_number=counters[eid],
                    reps=int(r["duration_seconds"] if is_time else r["reps"]),
                    weight_kg=0.0 if is_time else round(float(r["metric_weight"]), 2),
                    completed_at=start + timedelta(minutes=i),
                )
            )
            sets += 1
        sessions += 1
    src.close()
    return {
        "exercises_created": created,
        "exercises_reused": reused,
        "exercise_notes": notes,
        "sessions": sessions,
        "sets": sets,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("file")
    parser.add_argument("email")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    engine = make_engine(get_settings().database_url)
    with Session(engine) as session:
        result = import_fitnotes(session, args.file, args.email)
        for key, value in result.items():
            print(f"{key}: {value}")
        if args.dry_run:
            session.rollback()
            print("Dry-Run: nichts gespeichert.")
        else:
            session.commit()
            print("Import abgeschlossen.")
