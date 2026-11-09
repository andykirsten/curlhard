"""Import eines Hevy-CSV-Exports für einen angemeldeten Benutzer.

Spalten des Exports: title, start_time, end_time, description, exercise_title, superset_id,
exercise_notes, set_index, set_type, weight_kg, reps, distance_km, duration_seconds, rpe.

- Pro Training (title + start_time) entsteht eine Session mit den Übungen in Reihenfolge des ersten
  Satzes. Namensgleiche sichtbare Übungen werden wiederverwendet, alle anderen als private angelegt.
- warmup → Aufwärmsatz, dropset → Drop-Satz, failure/normal → Arbeitssatz.
- Aufeinanderfolgende Übungen mit gleicher superset_id bekommen dieselbe group_no.
- Sätze ohne Wiederholungen (reine Distanz/Dauer) und Zeilen mit unplausiblen Werten werden gezählt
  und übersprungen. Trainings, deren Startzeit schon existiert, werden nicht doppelt importiert.
"""

import csv
import io
from collections import defaultdict
from datetime import UTC, datetime, timedelta

from sqlmodel import Session, col, select

from app.errors import ApiError
from app.models import Exercise, SessionExercise, SetLog, User, WorkoutSession

MARKER = "Hevy-Import"
MAX_BYTES = 5 * 1024 * 1024
REQUIRED = {"title", "start_time", "exercise_title", "set_type", "weight_kg", "reps"}
MAX_REPS = 1000
MAX_WEIGHT_KG = 2000
MAX_NAME = 120
# Monatskürzel explizit (englisch, zur Sicherheit auch deutsch): strptime("%b") hängt von der
# Locale des Servers ab
MONTHS = {
    m: i
    for i, m in enumerate(
        ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"),
        start=1,
    )
} | {"mär": 3, "mai": 5, "okt": 10, "dez": 12}
# Hevy-Satztyp → (is_warmup, set_type); failure und normal sind Arbeitssätze
KIND = {"warmup": (True, "normal"), "dropset": (False, "drop")}


def parse_time(text: str) -> datetime | None:
    """„7 Jan 2024, 09:30“ (Hevy) oder ISO-Format. Ohne Zeitzone im Export gilt UTC.

    shortcut: Zeitzone unbekannt, bei Bedarf als Einstellung nachrüsten.
    """
    text = (text or "").strip()
    try:
        day, month, rest = text.replace(",", "").split(maxsplit=2)
        year, clock = rest.split()
        hour, minute = clock.split(":")[:2]
        return datetime(
            int(year), MONTHS[month[:3].lower()], int(day), int(hour), int(minute), tzinfo=UTC
        )
    except (ValueError, KeyError):
        pass
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _number(text: str | None) -> float | None:
    text = (text or "").strip().replace(",", ".")
    try:
        return float(text) if text else None
    except ValueError:
        return None


def parse_rows(csv_text: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(csv_text))
    if not REQUIRED <= set(reader.fieldnames or []):
        raise ApiError(422, "invalid_csv", "Das ist kein Hevy-Export (erwartete Spalten fehlen)")
    return list(reader)


def import_hevy(db: Session, user: User, csv_text: str) -> dict[str, int]:
    """Legt Sessions, Übungen und Sätze an (flush, kein Commit; der Aufrufer entscheidet)."""
    rows = parse_rows(csv_text)
    trainings: dict[tuple[str, str], list[dict]] = defaultdict(list)
    skipped = 0
    for r in rows:
        name = (r.get("exercise_title") or "").strip()[:MAX_NAME]
        start = parse_time(r.get("start_time") or "")
        reps = _number(r.get("reps"))
        weight = _number(r.get("weight_kg")) or 0.0
        if (
            not name
            or start is None
            or reps is None
            or not 0 <= reps <= MAX_REPS
            or not 0 <= weight <= MAX_WEIGHT_KG
        ):
            skipped += 1
            continue
        rpe = _number(r.get("rpe"))
        is_warmup, set_type = KIND.get((r.get("set_type") or "").strip().lower(), (False, "normal"))
        trainings[((r.get("title") or "").strip(), (r.get("start_time") or "").strip())].append(
            {
                "name": name,
                "start": start,
                "end": parse_time(r.get("end_time") or ""),
                "superset": (r.get("superset_id") or "").strip(),
                "reps": int(reps),
                "weight": round(weight, 2),
                "rpe": rpe if rpe is not None and 1 <= rpe <= 10 else None,
                "is_warmup": is_warmup,
                "set_type": set_type,
                "note": (r.get("exercise_notes") or "").strip(),
            }
        )

    visible = {
        e.name.lower(): e
        for e in db.exec(
            select(Exercise).where(
                col(Exercise.owner_user_id).is_(None) | (Exercise.owner_user_id == user.id)
            )
        ).all()
    }
    bodyweight_only: dict[str, bool] = {}
    for sets in trainings.values():
        for s in sets:
            key = s["name"].lower()
            bodyweight_only[key] = bodyweight_only.get(key, True) and s["weight"] == 0

    existing = set(
        db.exec(select(WorkoutSession.started_at).where(WorkoutSession.user_id == user.id)).all()
    )
    result = {
        "sessions": 0,
        "sets": 0,
        "exercises_created": 0,
        "exercises_reused": 0,
        "sessions_skipped": 0,
        "rows_skipped": skipped,
    }
    reused: set[int] = set()
    for (title, _raw), sets in sorted(trainings.items(), key=lambda kv: kv[1][0]["start"]):
        start = sets[0]["start"]
        if start in existing:
            result["sessions_skipped"] += 1
            continue
        end = next((s["end"] for s in sets if s["end"] and s["end"] > start), None)
        ws = WorkoutSession(
            user_id=user.id,  # type: ignore[arg-type]
            started_at=start,
            finished_at=end or start + timedelta(minutes=len(sets)),
            note=f"{MARKER}: {title}" if title else MARKER,
        )
        db.add(ws)
        db.flush()
        by_name: dict[str, SessionExercise] = {}
        groups: dict[str, int] = {}
        counters: dict[str, int] = defaultdict(int)
        for i, s in enumerate(sets):
            key = s["name"].lower()
            se = by_name.get(key)
            if se is None:
                ex = visible.get(key)
                if ex is None:
                    ex = Exercise(
                        name=s["name"],
                        owner_user_id=user.id,
                        load_type="bodyweight" if bodyweight_only[key] else "weight",
                    )
                    db.add(ex)
                    db.flush()
                    visible[key] = ex
                    result["exercises_created"] += 1
                elif ex.id not in reused:
                    reused.add(ex.id)  # type: ignore[arg-type]
                    result["exercises_reused"] += 1
                group = None
                if s["superset"]:
                    group = groups.setdefault(s["superset"], len(groups) + 1)
                se = SessionExercise(
                    user_id=user.id,  # type: ignore[arg-type]
                    session_id=ws.id,  # type: ignore[arg-type]
                    exercise_id=ex.id,  # type: ignore[arg-type]
                    position=len(by_name),
                    note=s["note"],
                    group_no=group,
                )
                db.add(se)
                db.flush()
                by_name[key] = se
            counters[key] += 1
            db.add(
                SetLog(
                    user_id=user.id,  # type: ignore[arg-type]
                    exercise_id=se.exercise_id,
                    session_exercise_id=se.id,  # type: ignore[arg-type]
                    set_number=counters[key],
                    reps=s["reps"],
                    weight_kg=s["weight"],
                    rpe=s["rpe"],
                    is_warmup=s["is_warmup"],
                    set_type=s["set_type"],
                    completed_at=start + timedelta(minutes=i),
                )
            )
            result["sets"] += 1
        existing.add(start)
        result["sessions"] += 1
    db.flush()
    return result
