from datetime import UTC, datetime, timedelta

from app.services.deload import _reason, detect
from app.services.stats import SetData

NOW = datetime(2026, 10, 10, 12, 0, tzinfo=UTC)
# Session-IDs gelten übergreifend: ein Trainingstag = eine Session für alle Übungen
DAYS = [(1, 20), (2, 13), (3, 6), (4, 2)]


def lift(weights: list[float], reps: int = 8, days=DAYS) -> list[SetData]:
    return [
        SetData(session_id=sid, date=NOW - timedelta(days=d), reps=reps, weight_kg=w)
        for (sid, d), w in zip(days, weights, strict=False)
    ]


def per(*exercises: tuple[str, list[SetData]]) -> dict:
    return {i: (name, "weight", sets) for i, (name, sets) in enumerate(exercises, start=1)}


def test_fallender_e1rm_bei_zwei_übungen_empfiehlt_deload():
    data = per(("Bankdrücken", lift([80, 80, 78, 76])), ("Rudern", lift([60, 60, 58, 56])))
    result = detect(data, None, NOW)
    assert result["recommended"] is True
    assert [(e["name"], e["reason"]) for e in result["exercises"]] == [
        ("Bankdrücken", "e1rm_falling"),
        ("Rudern", "e1rm_falling"),
    ]


def test_eine_betroffene_übung_reicht_nicht():
    data = per(("Bankdrücken", lift([80, 80, 78, 76])), ("Rudern", lift([60, 60, 62, 64])))
    result = detect(data, None, NOW)
    assert result["recommended"] is False
    assert len(result["exercises"]) == 1


def test_steigender_e1rm_löst_nichts_aus():
    data = per(("Bankdrücken", lift([70, 72, 74, 76])), ("Rudern", lift([50, 52, 54, 56])))
    assert detect(data, None, NOW) == {"recommended": False, "exercises": []}


def test_zu_wenig_sessions_kein_trend():
    two = [(3, 6), (4, 2)]
    data = per(("Bankdrücken", lift([80, 70], days=two)), ("Rudern", lift([60, 50], days=two)))
    assert detect(data, None, NOW)["exercises"] == []


def test_pause_ist_keine_ermüdung():
    old = [(1, 27), (2, 24), (3, 21), (4, 18)]  # nichts in den letzten 7 Tagen
    data = per(
        ("Bankdrücken", lift([80, 80, 78, 76], days=old)),
        ("Rudern", lift([60, 60, 58, 56], days=old)),
    )
    result = detect(data, None, NOW)
    assert len(result["exercises"]) == 2
    assert result["recommended"] is False


def test_geringer_abfall_unter_einem_prozent_zählt_nicht():
    data = per(
        ("Bankdrücken", lift([80, 79.9, 79.8, 79.7])), ("Rudern", lift([60, 59.9, 59.8, 59.7]))
    )
    assert detect(data, None, NOW)["exercises"] == []


def row(e1rm, load, rpe):
    return {"e1rm": e1rm, "best_set": {"weight_kg": load}, "avg_rpe": rpe}


def test_rpe_steigt_bei_gleicher_last():
    rows = [row(100, 80, 7.0), row(100, 80, 7.5), row(100, 80, 8.0)]
    assert _reason(rows) == "rpe_rising"


def test_rpe_steigt_aber_last_wechselt_kein_hinweis():
    rows = [row(100, 80, 7.0), row(100, 82.5, 7.5), row(100, 80, 8.5)]
    assert _reason(rows) is None


def test_rpe_fehlt_kein_hinweis():
    rows = [row(100, 80, None), row(100, 80, None), row(100, 80, None)]
    assert _reason(rows) is None
