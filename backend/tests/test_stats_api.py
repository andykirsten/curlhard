from datetime import UTC, datetime, timedelta

import pytest

API = "/api/v1"


def iso(days_ago: float) -> str:
    return (datetime.now(UTC) - timedelta(days=days_ago)).isoformat()


def log(c, exercise_id, days_ago, sets):
    s = c.post(f"{API}/sessions", json={"started_at": iso(days_ago)}).json()
    se = c.post(f"{API}/sessions/{s['id']}/exercises", json={"exercise_id": exercise_id}).json()
    for reps, weight, *rest in sets:
        c.post(
            f"{API}/session-exercises/{se['id']}/sets",
            json={
                "reps": reps,
                "weight_kg": weight,
                "is_warmup": bool(rest and rest[0]),
                "completed_at": iso(days_ago),
            },
        )
    return s


def test_summary_history_records(alice, catalog):
    ex = catalog["bench"]["id"]
    log(alice, ex, 40, [(5, 90)])
    log(alice, ex, 3, [(8, 80), (5, 85), (10, 30, True)])
    summary = alice.get(f"{API}/stats/exercises/{ex}/summary").json()
    expected = max(80 * (1 + 8 / 30), 85 * (1 + 5 / 30))
    assert summary["e1rm"] == pytest.approx(expected, abs=0.01)
    assert set(summary["nrm"]) == {"5", "8", "13"}
    assert summary["session_count"] == 2
    assert summary["change_4w_pct"] is not None or summary["change_4w_pct"] is None

    hist = alice.get(f"{API}/stats/exercises/{ex}/history").json()["points"]
    assert len(hist) == 2 and hist[0]["date"] < hist[1]["date"]
    assert hist[1]["volume"] == 8 * 80 + 5 * 85
    assert hist[1]["value"] == hist[1]["e1rm"]

    vol = alice.get(f"{API}/stats/exercises/{ex}/history", params={"metric": "volume"}).json()
    assert vol["points"][1]["value"] == 8 * 80 + 5 * 85
    best = alice.get(f"{API}/stats/exercises/{ex}/history", params={"metric": "best_set"}).json()
    assert best["points"][0]["value"] == 90
    assert (
        alice.get(f"{API}/stats/exercises/{ex}/history", params={"metric": "zzz"}).status_code
        == 422
    )

    recs = {
        r["reps"]: r for r in alice.get(f"{API}/stats/exercises/{ex}/records").json()["records"]
    }
    assert recs[5]["weight_kg"] == 90 and recs[8]["weight_kg"] == 80
    assert recs[13]["weight_kg"] is None and recs[1]["weight_kg"] == 90


def test_history_range_filter(alice, catalog):
    ex = catalog["bench"]["id"]
    log(alice, ex, 100, [(5, 70)])
    log(alice, ex, 2, [(5, 80)])
    pts = alice.get(f"{API}/stats/exercises/{ex}/history", params={"from": iso(30)}).json()[
        "points"
    ]
    assert len(pts) == 1 and pts[0]["best_set"]["weight_kg"] == 80


def test_bodyweight_exercise_uses_profile_weight(alice, admin):
    alice.patch(f"{API}/auth/me", json={"body_weight_kg": 80})
    ex = alice.post(f"{API}/exercises", json={"name": "Klimmzug", "load_type": "bodyweight"}).json()
    log(alice, ex["id"], 1, [(10, 0), (5, 10)])
    pt = alice.get(f"{API}/stats/exercises/{ex['id']}/history").json()["points"][0]
    assert pt["volume"] == 10 * 80 + 5 * 90


def test_time_exercise_has_no_rm(alice):
    ex = alice.post(f"{API}/exercises", json={"name": "Plank", "load_type": "time"}).json()
    log(alice, ex["id"], 1, [(60, 0)])
    summary = alice.get(f"{API}/stats/exercises/{ex['id']}/summary").json()
    assert summary["e1rm"] is None
    assert (
        alice.get(f"{API}/stats/exercises/{ex['id']}/history").json()["points"][0]["volume"] is None
    )


def test_overview(alice, catalog):
    ex = catalog["bench"]["id"]
    log(alice, ex, 0.01, [(5, 100)])
    log(alice, ex, 9, [(10, 50)])
    weeks = alice.get(f"{API}/stats/overview", params={"weeks": 4}).json()["weeks"]
    assert len(weeks) == 4
    assert sum(w["volume"] for w in weeks) == 500 + 500
    assert weeks[-1]["sessions"] >= 1
    chest = str(catalog["chest_id"])
    assert any(chest in w["by_muscle_group"] for w in weeks)
    assert alice.get(f"{API}/stats/overview", params={"weeks": 0}).status_code == 422


def test_stats_unknown_exercise_404(alice):
    assert alice.get(f"{API}/stats/exercises/9999/summary").status_code == 404
