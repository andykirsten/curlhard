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
    rpe: float | None = None
    set_id: int = 0
    set_number: int = 0


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
    rpes = [s.rpe for s in working if s.rpe is not None]
    extra = {
        "working_sets": len(working),
        "max_rpe": max(rpes) if rpes else None,
        "avg_rpe": round(sum(rpes) / len(rpes), 1) if rpes else None,
        "max_reps": (
            max(s.reps for s in working) if load_type in ("bodyweight", "assisted") else None
        ),
    }
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
            **extra,
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
        **extra,
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


def pct(current: float | None, reference: float | None) -> float | None:
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
        "change_4w_pct": pct(current, ref4),
        "change_12w_pct": pct(current, ref12),
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


def rep_profile(
    sets: list[SetData], load_type: str, bw: float | None, best_e1rm: float | None
) -> list[dict]:
    """Je 1–15 Wiederholungen: tatsächlicher Bestwert (Last bei mindestens n Wdh.) und
    Epley-Schätzung aus dem besten e1RM. Leer für Zeitübungen oder ohne e1RM."""
    if load_type == "time" or best_e1rm is None:
        return []
    working = _working(sets)
    out = []
    for n in range(1, MAX_REPS_FOR_ESTIMATE + 1):
        best: tuple[float, SetData] | None = None
        for s in working:
            if s.reps < n:
                continue
            load = effective_load(load_type, s.weight_kg, bw)
            if load is None or load <= 0:
                continue
            if best is None or load > best[0] or (load == best[0] and s.date < best[1].date):
                best = (load, s)
        out.append(
            {
                "reps": n,
                "actual_kg": round(best[0], 2) if best else None,
                "actual_date": best[1].date if best else None,
                "estimated_kg": round(nrm(best_e1rm, n), 2),
            }
        )
    return out


def pr_events(sets: list[SetData], load_type: str, bw: float | None) -> list[dict]:
    """Chronologisch alle Sätze, die einen Rekord brechen (e1RM, n-RM, bei Körpergewicht
    zusätzlich meiste Wiederholungen). Die erste Session bildet nur die Basis, sie erzeugt
    keine Ereignisse. Aufwärmsätze zählen nie."""
    if load_type == "time":
        return []
    working = sorted(_working(sets), key=lambda s: (s.date, s.set_number, s.set_id))
    if not working:
        return []
    first_session = working[0].session_id
    best_e1: float | None = None
    best_n: dict[int, float] = {}
    best_reps = 0
    events: list[dict] = []
    for s in working:
        load = effective_load(load_type, s.weight_kg, bw)
        found: list[dict] = []
        if load is not None and load > 0:
            est = e1rm(load, s.reps)
            if est is not None:
                if best_e1 is not None and est > best_e1:
                    found.append({"kind": "e1rm", "reps": None, "value": round(est, 2)})
                if best_e1 is None or est > best_e1:
                    best_e1 = est
            for n in RECORD_TARGETS:
                if s.reps < n:
                    continue
                prev = best_n.get(n)
                if prev is not None and load > prev:
                    found.append({"kind": "nrm", "reps": n, "value": round(load, 2)})
                if prev is None or load > prev:
                    best_n[n] = load
        if load_type in ("bodyweight", "assisted"):
            if best_reps and s.reps > best_reps:
                found.append({"kind": "reps", "reps": s.reps, "value": float(s.reps)})
            best_reps = max(best_reps, s.reps)
        if s.session_id == first_session:
            continue
        for f in found:
            events.append({**f, "date": s.date, "session_id": s.session_id, "set_id": s.set_id})
    return events


def pr_timeline(events: list[dict]) -> list[dict]:
    """Pro Session, Art und Wiederholungszahl nur der höchste Wert (für die Zeitleiste)."""
    best: dict[tuple, dict] = {}
    for e in events:
        key = (e["session_id"], e["kind"], e["reps"])
        if key not in best or e["value"] > best[key]["value"]:
            best[key] = e
    return sorted(best.values(), key=lambda e: (e["date"], e["kind"], e["reps"] or 0))


def rep_ranges(sets: list[SetData]) -> dict[str, int]:
    """Anzahl Arbeitssätze je Wiederholungsbereich (Kraft 1–5, Hypertrophie 6–12, Ausdauer 13+)."""
    out = {"strength": 0, "hypertrophy": 0, "endurance": 0}
    for s in _working(sets):
        if s.reps <= 5:
            out["strength"] += 1
        elif s.reps <= 12:
            out["hypertrophy"] += 1
        else:
            out["endurance"] += 1
    return out


def weekly(rows: list[dict]) -> list[dict]:
    """Je Kalenderwoche Volumen, Arbeitssätze und Sessions; Wochen ohne Training mit 0
    zwischen der ersten und letzten Woche."""
    if not rows:
        return []
    buckets: dict[date, dict] = {}
    for r in rows:
        ws = week_start(r["date"])
        b = buckets.setdefault(
            ws, {"week_start": ws, "volume": 0.0, "working_sets": 0, "sessions": 0}
        )
        b["volume"] += r["volume"] or 0.0
        b["working_sets"] += r["working_sets"]
        b["sessions"] += 1
    out = []
    ws = min(buckets)
    last = max(buckets)
    while ws <= last:
        b = buckets.get(ws) or {"week_start": ws, "volume": 0.0, "working_sets": 0, "sessions": 0}
        out.append({**b, "volume": round(b["volume"], 2)})
        ws += timedelta(weeks=1)
    return out


def lifetime(
    sets: list[SetData], rows: list[dict], load_type: str, bw: float | None, now: datetime
) -> dict:
    """Lebenszeit-Kennzahlen; rows sind die Session-Kennzahlen (aufsteigend nach Datum)."""
    working = _working(sets)
    heaviest: tuple[float, SetData] | None = None
    for s in working:
        load = effective_load(load_type, s.weight_kg, bw)
        if load is None:
            continue
        if heaviest is None or (load, s.reps) > (heaviest[0], heaviest[1].reps):
            heaviest = (load, s)
    volumes = [r["volume"] for r in rows if r["volume"] is not None]
    avg_per_week: float | None = None
    last_days: int | None = None
    if rows:
        weeks = max((now - rows[0]["date"]).days / 7, 1.0)
        avg_per_week = round(len(rows) / weeks, 1)
        last_days = max((now - rows[-1]["date"]).days, 0)
    is_time = load_type == "time"
    return {
        "total_volume": None if is_time else round(sum(volumes), 2),
        "total_sessions": len(rows),
        "total_working_sets": len(working),
        "heaviest_set": (
            {"reps": heaviest[1].reps, "weight_kg": round(heaviest[0], 2)} if heaviest else None
        ),
        "most_reps": None if is_time else max((s.reps for s in working), default=None),
        "best_session_volume": max(volumes) if volumes else None,
        "avg_sessions_per_week": avg_per_week,
        "days_since_last": last_days,
        "longest_hold_sec": max((s.reps for s in working), default=None) if is_time else None,
        "total_time_sec": sum(s.reps for s in working) if is_time else None,
    }


def plateau_weeks(rows: list[dict], now: datetime) -> int | None:
    """Volle Wochen seit dem letzten neuen e1RM-Hoch; None ohne e1RM-Werte."""
    best: dict | None = None
    for r in rows:
        if r["e1rm"] is not None and (best is None or r["e1rm"] > best["e1rm"]):
            best = r
    if best is None:
        return None
    return max((now - best["date"]).days // 7, 0)
