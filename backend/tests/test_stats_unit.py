from datetime import datetime, timedelta

import pytest

from app.services import stats
from app.services.stats import SetData

NOW = datetime(2026, 10, 10, 12, 0)


def s(session, days_ago, reps, weight, warm=False):
    return SetData(session, NOW - timedelta(days=days_ago), reps, weight, warm)


def test_epley_plan_example():
    e = stats.e1rm(80, 8)
    assert e == pytest.approx(101.33, abs=0.01)
    assert stats.nrm(e, 5) == pytest.approx(86.86, abs=0.01)
    assert stats.nrm(e, 13) == pytest.approx(70.70, abs=0.01)


def test_e1rm_single_rep_equals_weight():
    assert stats.e1rm(100, 1) == 100


def test_e1rm_excluded_above_15_reps_or_invalid():
    assert stats.e1rm(50, 16) is None
    assert stats.e1rm(50, 15) == pytest.approx(75)
    assert stats.e1rm(50, 0) is None
    assert stats.e1rm(0, 5) is None


def test_effective_load_types():
    assert stats.effective_load("weight", 80, 90) == 80
    assert stats.effective_load("bodyweight", 10, 90) == 100
    assert stats.effective_load("assisted", 20, 90) == 70
    assert stats.effective_load("assisted", 200, 90) == 0
    assert stats.effective_load("time", 0, 90) is None
    assert stats.effective_load("bodyweight", 0, None) == 0


def test_session_metrics_volume_and_best_set():
    m = stats.session_metrics(
        [s(1, 1, 8, 80), s(1, 1, 6, 85), s(1, 1, 10, 40, warm=True)], "weight", None
    )
    assert m["volume"] == 8 * 80 + 6 * 85
    assert m["e1rm"] == pytest.approx(max(80 * (1 + 8 / 30), 85 * (1 + 6 / 30)), abs=0.01)
    assert m["best_set"] == {"reps": 6, "weight_kg": 85.0}
    assert set(m["nrm"]) == {5, 8, 13}


def test_warmups_never_count():
    assert stats.session_metrics([s(1, 1, 10, 40, warm=True)], "weight", None) is None


def test_sets_over_15_reps_in_volume_but_not_estimate():
    m = stats.session_metrics([s(1, 1, 20, 40), s(1, 1, 5, 60)], "weight", None)
    assert m["volume"] == 20 * 40 + 5 * 60
    assert m["e1rm"] == pytest.approx(60 * (1 + 5 / 30), abs=0.01)


def test_only_high_rep_sets_have_no_e1rm():
    m = stats.session_metrics([s(1, 1, 20, 40)], "weight", None)
    assert m["e1rm"] is None and m["nrm"] == {} and m["volume"] == 800


def test_bodyweight_exercise_uses_body_weight():
    m = stats.session_metrics([s(1, 1, 10, 0), s(1, 1, 8, 10)], "bodyweight", 80)
    assert m["volume"] == 10 * 80 + 8 * 90


def test_assisted_exercise():
    m = stats.session_metrics([s(1, 1, 6, 30)], "assisted", 80)
    assert m["volume"] == 6 * 50


def test_time_exercise_has_no_rm():
    m = stats.session_metrics([s(1, 1, 60, 0), s(1, 1, 45, 0)], "time", 80)
    assert m["e1rm"] is None and m["nrm"] == {} and m["volume"] is None
    assert m["duration_sec"] == 105 and m["best_set"]["reps"] == 60


def test_history_groups_by_session_sorted():
    rows = stats.history([s(2, 1, 5, 100), s(1, 8, 5, 90), s(1, 8, 5, 90)], "weight", None)
    assert [r["session_id"] for r in rows] == [1, 2]
    assert rows[0]["volume"] == 900


def test_records_require_min_reps():
    sets = [s(1, 20, 1, 120), s(1, 20, 5, 100), s(2, 10, 8, 90), s(3, 2, 5, 105)]
    recs = {r["reps"]: r for r in stats.records(sets, "weight", None)}
    assert recs[1]["weight_kg"] == 120
    assert recs[5]["weight_kg"] == 105
    assert recs[8]["weight_kg"] == 90
    assert recs[13]["weight_kg"] is None and recs[13]["date"] is None


def test_records_exclude_warmups_and_time():
    assert stats.records([s(1, 1, 5, 200, warm=True)], "weight", None)[0]["weight_kg"] is None
    assert stats.records([s(1, 1, 60, 0)], "time", None)[0]["weight_kg"] is None


def test_new_records_needs_history():
    assert stats.new_records([], 5, 100, "weight", None) == []


def test_new_records_detects_broken_targets():
    prev = [s(1, 10, 5, 100), s(1, 10, 8, 90)]
    assert stats.new_records(prev, 5, 105, "weight", None) == [1, 5]
    assert stats.new_records(prev, 8, 95, "weight", None) == [8]
    assert stats.new_records(prev, 5, 100, "weight", None) == []
    assert stats.new_records(prev, 3, 120, "weight", None) == [1]


def test_summary_windows_and_changes():
    rows = stats.history(
        [
            s(1, 7 * 14, 5, 80),  # vor 14 Wochen -> Referenz 12 Wochen davor
            s(2, 7 * 6, 5, 90),  # vor 6 Wochen -> Referenz 4 Wochen davor
            s(3, 3, 5, 100),  # aktuell
        ],
        "weight",
        None,
    )
    out = stats.summary(rows, NOW)
    assert out["e1rm"] == pytest.approx(100 * (1 + 5 / 30), abs=0.01)
    assert out["change_4w_pct"] == pytest.approx((100 - 90) / 90 * 100, abs=0.1)
    assert out["change_12w_pct"] == pytest.approx((100 - 80) / 80 * 100, abs=0.1)
    assert set(out["nrm"]) == {5, 8, 13}


def test_summary_empty():
    out = stats.summary([], NOW)
    assert out["e1rm"] is None and out["change_4w_pct"] is None and out["nrm"] == {}


def test_summary_ignores_old_sessions_for_current():
    rows = stats.history([s(1, 7 * 6, 5, 90)], "weight", None)
    assert stats.summary(rows, NOW)["e1rm"] is None


def test_overview_weekly_volume_and_muscles():
    entries = [
        (1, NOW - timedelta(days=1), 800.0, 7),
        (1, NOW - timedelta(days=1), 400.0, 7),
        (2, NOW - timedelta(days=1), 100.0, 8),
        (3, NOW - timedelta(days=8), 500.0, None),
        (4, NOW - timedelta(days=400), 999.0, 7),  # außerhalb des Fensters
    ]
    weeks = stats.overview(entries, 3, NOW)
    assert len(weeks) == 3
    this_week = weeks[-1]
    assert this_week["volume"] == 1300.0 and this_week["sessions"] == 2
    assert this_week["by_muscle_group"] == {7: 1200.0, 8: 100.0}
    assert weeks[-2]["volume"] == 500.0
    assert weeks[0]["volume"] == 0
