"""Deload-Erkennung: die Leistung hält über mehrere Sessions nicht mehr (reine Funktionen)."""

from datetime import datetime, timedelta

from app.services import stats
from app.services.stats import SetData

MIN_SESSIONS = 3  # so viele Sessions einer Übung braucht ein Trend
DROP = 0.99  # der e1RM muss je Schritt um mindestens 1 % fallen
RPE_RISE = 1.0  # so viel höher muss das durchschnittliche RPE bei gleicher Last liegen
WINDOW = timedelta(weeks=4)
RECENT = timedelta(days=7)
MIN_EXERCISES = 2  # erst bei mehreren betroffenen Übungen ist es ein Muster
MIN_RECENT_SESSIONS = 2  # Pause ist keine Ermüdung: ohne aktuelles Training kein Hinweis


def _reason(rows: list[dict]) -> str | None:
    last = rows[-MIN_SESSIONS:]
    e = [r["e1rm"] for r in last]
    if None not in e and e[1] <= e[0] * DROP and e[2] <= e[1] * DROP:
        return "e1rm_falling"
    loads = {r["best_set"]["weight_kg"] for r in last}
    rpe = [r["avg_rpe"] for r in last]
    if len(loads) == 1 and None not in (rpe[0], rpe[2]) and rpe[2] - rpe[0] >= RPE_RISE:
        return "rpe_rising"
    return None


def detect(
    per_exercise: dict[int, tuple[str, str, list[SetData]]],
    body_weight_kg: float | None,
    now: datetime,
) -> dict:
    """per_exercise: Übungs-ID → (Name, Lasttyp, Sätze der letzten Wochen)."""
    hits = []
    recent_sessions: set[int] = set()
    for exercise_id, (name, load_type, sets) in per_exercise.items():
        recent_sessions |= {s.session_id for s in sets if not s.is_warmup and s.date > now - RECENT}
        rows = [
            r for r in stats.history(sets, load_type, body_weight_kg) if r["date"] > now - WINDOW
        ]
        if len(rows) < MIN_SESSIONS:
            continue
        reason = _reason(rows)
        if reason:
            hits.append({"exercise_id": exercise_id, "name": name, "reason": reason})
    return {
        "recommended": len(hits) >= MIN_EXERCISES and len(recent_sessions) >= MIN_RECENT_SESSIONS,
        "exercises": hits,
    }
