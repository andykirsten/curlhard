"""Reine Berechnungen für die Progression (keine DB-Zugriffe).

Aufwärmsätze zählen nie mit. Gewichte in kg.
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta

RM_TARGETS = (5, 8, 13)
RECORD_TARGETS = (1, 5, 8, 13)
MAX_REPS_FOR_ESTIMATE = 15


@dataclass(frozen=True)
class SetData:
    session_id: int
    date: datetime
    reps: int
    weight_kg: float
    is_warmup: bool = False


def effective_load(load_type: str, weight_kg: float, body_weight_kg: float | None) -> float | None:
    bw = body_weight_kg or 0.0
    if load_type == "weight":
        return weight_kg
    if load_type == "bodyweight":
        return bw + weight_kg
    if load_type == "assisted":
        return max(bw - weight_kg, 0.0)
    return None  # time


def e1rm(load: float, reps: int) -> float | None:
    if reps < 1 or reps > MAX_REPS_FOR_ESTIMATE or load <= 0:
        return None
    if reps == 1:
        return load
    return load * (1 + reps / 30)


def nrm(e1: float, n: int) -> float:
    return e1 / (1 + n / 30)


def _working(sets: list[SetData]) -> list[SetData]:
    return [s for s in sets if not s.is_warmup and s.reps > 0]


def session_metrics(
    sets: list[SetData], load_type: str, body_weight_kg: float | None
) -> dict | None:
    """Kennzahlen einer Session für eine Übung; None wenn keine Arbeitssätze."""
    working = _working(sets)
    if not working:
        return None
    when = min(s.date for s in working)
    if load_type == "time":
        best = max(working, key=lambda s: s.reps)
        return {
            "session_id": working[0].session_id,
            "date": when,
            "volume": None,
            "best_set": {"reps": best.reps, "weight_kg": 0.0},
            "e1rm": None,
            "nrm": {},
            "duration_sec": sum(s.reps for s in working),
        }
    volume = 0.0
    best_e1: float | None = None
    best_set: SetData | None = None
    best_load = 0.0
    top_load_set: tuple[float, SetData] | None = None
    for s in working:
        load = effective_load(load_type, s.weight_kg, body_weight_kg) or 0.0
        volume += s.reps * load
        if top_load_set is None or (load, s.reps) > (top_load_set[0], top_load_set[1].reps):
            top_load_set = (load, s)
        est = e1rm(load, s.reps)
        if est is not None and (best_e1 is None or est > best_e1):
            best_e1, best_set, best_load = est, s, load
    if best_set is None and top_load_set is not None:
        best_load, best_set = top_load_set
    assert best_set is not None
    return {
        "session_id": working[0].session_id,
        "date": when,
        "volume": round(volume, 2),
        "best_set": {"reps": best_set.reps, "weight_kg": round(best_load, 2)},
        "e1rm": round(best_e1, 2) if best_e1 is not None else None,
        "nrm": {n: round(nrm(best_e1, n), 2) for n in RM_TARGETS} if best_e1 is not None else {},
        "duration_sec": None,
    }


def history(sets: list[SetData], load_type: str, body_weight_kg: float | None) -> list[dict]:
    by_session: dict[int, list[SetData]] = defaultdict(list)
    for s in sets:
        by_session[s.session_id].append(s)
    rows = [session_metrics(v, load_type, body_weight_kg) for v in by_session.values()]
    return sorted((r for r in rows if r), key=lambda r: r["date"])


def records(sets: list[SetData], load_type: str, body_weight_kg: float | None) -> list[dict]:
    """Höchste Last in einem Arbeitssatz mit mindestens n Wiederholungen (n = 1, 5, 8, 13)."""
    result = []
    working = _working(sets)
    for n in RECORD_TARGETS:
        best: tuple[float, SetData] | None = None
        for s in working:
            if s.reps < n:
                continue
            load = effective_load(load_type, s.weight_kg, body_weight_kg)
            if load is None:
                continue
            # bei Gleichstand zählt der frühere Satz (zuerst erreicht)
            if best is None or load > best[0] or (load == best[0] and s.date < best[1].date):
                best = (load, s)
        result.append(
            {
                "reps": n,
                "weight_kg": round(best[0], 2) if best else None,
                "achieved_reps": best[1].reps if best else None,
                "date": best[1].date if best else None,
            }
        )
    return result


def new_records(
    previous: list[SetData], reps: int, weight_kg: float, load_type: str, bw: float | None
) -> list[int]:
    """Welche n-Rekorde bricht ein neuer Arbeitssatz? Ohne Vorgeschichte gibt es keinen Rekord."""
    load = effective_load(load_type, weight_kg, bw)
    prev_working = _working(previous)
    if load is None or not prev_working or reps < 1:
        return []
    broken = []
    for n in RECORD_TARGETS:
        if reps < n:
            continue
        prev_best = max(
            (
                effective_load(load_type, p.weight_kg, bw) or 0.0
                for p in prev_working
                if p.reps >= n
            ),
            default=None,
        )
        if prev_best is not None and load > prev_best:
            broken.append(n)
    return broken


def _best_e1rm_between(rows: list[dict], start: datetime, end: datetime) -> float | None:
    vals = [r["e1rm"] for r in rows if r["e1rm"] is not None and start < r["date"] <= end]
    return max(vals) if vals else None


def _pct(current: float | None, reference: float | None) -> float | None:
    if current is None or reference is None or reference == 0:
        return None
    return round((current - reference) / reference * 100, 1)


def summary(rows: list[dict], now: datetime) -> dict:
    """Aktuelle Werte aus den letzten 4 Wochen; Veränderung ggü. dem 4-Wochen-Fenster
    vor 4 bzw. 12 Wochen."""
    w = timedelta(weeks=1)
    current = _best_e1rm_between(rows, now - 4 * w, now)
    ref4 = _best_e1rm_between(rows, now - 8 * w, now - 4 * w)
    ref12 = _best_e1rm_between(rows, now - 16 * w, now - 12 * w)
    return {
        "e1rm": round(current, 2) if current is not None else None,
        "nrm": {n: round(nrm(current, n), 2) for n in RM_TARGETS} if current is not None else {},
        "change_4w_pct": _pct(current, ref4),
        "change_12w_pct": _pct(current, ref12),
    }


def week_start(d: datetime | date) -> date:
    day = d.date() if isinstance(d, datetime) else d
    return day - timedelta(days=day.weekday())


def overview(
    entries: list[tuple[int, datetime, float, int | None]], weeks: int, now: datetime
) -> list[dict]:
    """entries: (session_id, Zeitpunkt, Volumen des Satzes, Muskelgruppe) pro Arbeitssatz."""
    first = week_start(now) - timedelta(weeks=weeks - 1)
    buckets: dict[date, dict] = {}
    for i in range(weeks):
        ws = first + timedelta(weeks=i)
        buckets[ws] = {"week_start": ws, "volume": 0.0, "by_muscle_group": {}, "_sessions": set()}
    for session_id, when, volume, muscle_group_id in entries:
        ws = week_start(when)
        if ws not in buckets:
            continue
        b = buckets[ws]
        b["volume"] += volume
        b["_sessions"].add(session_id)
        if muscle_group_id is not None:
            key = muscle_group_id
            b["by_muscle_group"][key] = b["by_muscle_group"].get(key, 0.0) + volume
    out = []
    for ws in sorted(buckets):
        b = buckets[ws]
        out.append(
            {
                "week_start": ws,
                "volume": round(b["volume"], 2),
                "sessions": len(b["_sessions"]),
                "by_muscle_group": {k: round(v, 2) for k, v in b["by_muscle_group"].items()},
            }
        )
    return out
