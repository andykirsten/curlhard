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


def test_e1rm_excluded_above_30_reps_or_invalid():
    assert stats.e1rm(50, 31) is None
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


def test_high_rep_factor_continuous_monotonic_and_flatter_than_epley():
    factors = [stats.rm_factor(r) for r in range(1, 31)]
    assert all(b > a for a, b in zip(factors, factors[1:], strict=False))
    assert stats.rm_factor(15) == pytest.approx(1.5)
    assert stats.rm_factor(16) - stats.rm_factor(15) < 1 / 30
    assert stats.rm_factor(20) == pytest.approx(1.600, abs=0.001)
    assert stats.rm_factor(30) == pytest.approx(1.757, abs=0.001)
    assert stats.rm_factor(30) < 1 + 30 / 30


def test_nrm_inverts_e1rm_for_high_reps():
    e = stats.e1rm(40, 25)
    assert e is not None
    assert stats.nrm(e, 25) == pytest.approx(40)


def test_sets_over_30_reps_in_volume_but_not_estimate():
    m = stats.session_metrics([s(1, 1, 35, 30), s(1, 1, 5, 60)], "weight", None)
    assert m["volume"] == 35 * 30 + 5 * 60
    assert m["e1rm"] == pytest.approx(60 * (1 + 5 / 30), abs=0.01)


def test_high_rep_sets_count_towards_e1rm():
    m = stats.session_metrics([s(1, 1, 20, 40)], "weight", None)
    assert m["e1rm"] == pytest.approx(40 * stats.rm_factor(20), abs=0.01)
    assert m["best_set"] == {"reps": 20, "weight_kg": 40}
    assert m["nrm"][5] == pytest.approx(m["e1rm"] / (1 + 5 / 30), abs=0.01)


def test_only_very_high_rep_sets_have_no_e1rm():
    m = stats.session_metrics([s(1, 1, 40, 20)], "weight", None)
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


def sr(session, days_ago, reps, weight, rpe=None, warm=False, set_id=0, num=0):
    return SetData(session, NOW - timedelta(days=days_ago), reps, weight, warm, rpe, set_id, num)


def test_session_metrics_rpe_and_working_sets():
    m = stats.session_metrics(
        [sr(1, 1, 8, 80, rpe=7), sr(1, 1, 8, 80, rpe=9), sr(1, 1, 10, 40, rpe=3, warm=True)],
        "weight",
        None,
    )
    assert m["working_sets"] == 2
    assert m["max_rpe"] == 9 and m["avg_rpe"] == 8.0
    assert m["max_reps"] is None


def test_session_metrics_max_reps_for_bodyweight_and_time():
    m = stats.session_metrics([s(1, 1, 10, 0), s(1, 1, 12, 0)], "bodyweight", 80)
    assert m["max_reps"] == 12 and m["max_rpe"] is None
    t = stats.session_metrics([s(1, 1, 60, 0)], "time", None)
    assert t["working_sets"] == 1 and t["max_reps"] is None


def test_rep_profile_actual_vs_estimated():
    sets = [s(1, 5, 5, 100), s(2, 2, 10, 80), s(3, 1, 10, 30, warm=True)]
    best = max(100 * (1 + 5 / 30), 80 * (1 + 10 / 30))
    prof = stats.rep_profile(sets, "weight", None, best)
    assert [p["reps"] for p in prof] == list(range(1, 16))
    assert prof[0]["actual_kg"] == 100  # >= 1 Wdh.
    assert prof[4]["actual_kg"] == 100
    assert prof[9]["actual_kg"] == 80
    assert prof[10]["actual_kg"] is None and prof[10]["actual_date"] is None
    assert prof[7]["estimated_kg"] == pytest.approx(stats.nrm(best, 8), abs=0.01)


def test_rep_profile_empty_for_time_or_without_e1rm():
    assert stats.rep_profile([s(1, 1, 60, 0)], "time", None, None) == []
    assert stats.rep_profile([s(1, 1, 20, 40)], "weight", None, None) == []


def test_pr_events_first_session_is_baseline():
    sets = [
        sr(1, 30, 5, 100, set_id=1, num=1),
        sr(1, 30, 5, 105, set_id=2, num=2),  # gleiche Session, Basis
        sr(2, 10, 5, 110, set_id=3, num=1),
        sr(2, 10, 5, 50, warm=True, set_id=4, num=2),
        sr(3, 2, 5, 110, set_id=5, num=1),  # kein neuer Rekord
    ]
    ev = stats.pr_events(sets, "weight", None)
    assert {e["session_id"] for e in ev} == {2}
    kinds = {(e["kind"], e["reps"]) for e in ev}
    assert kinds == {("e1rm", None), ("nrm", 1), ("nrm", 5)}
    assert all(e["set_id"] == 3 for e in ev)


def test_pr_events_time_and_empty():
    assert stats.pr_events([s(1, 5, 60, 0), s(2, 1, 90, 0)], "time", None) == []
    assert stats.pr_events([], "weight", None) == []


def test_pr_events_bodyweight_most_reps():
    sets = [sr(1, 20, 8, 0, set_id=1), sr(2, 5, 12, 0, set_id=2)]
    ev = stats.pr_events(sets, "bodyweight", 80)
    assert any(e["kind"] == "reps" and e["value"] == 12 for e in ev)


def test_pr_timeline_keeps_best_per_session_and_kind():
    sets = [
        sr(1, 30, 5, 100, set_id=1),
        sr(2, 10, 5, 105, set_id=2, num=1),
        sr(2, 10, 5, 110, set_id=3, num=2),
    ]
    tl = stats.pr_timeline(stats.pr_events(sets, "weight", None))
    e1 = [e for e in tl if e["kind"] == "e1rm"]
    assert len(e1) == 1 and e1[0]["value"] == pytest.approx(110 * (1 + 5 / 30), abs=0.01)


def test_rep_ranges_buckets_exclude_warmups():
    sets = [s(1, 1, 3, 100), s(1, 1, 5, 90), s(1, 1, 6, 80), s(1, 1, 12, 60), s(1, 1, 13, 40)]
    sets.append(s(1, 1, 8, 20, warm=True))
    assert stats.rep_ranges(sets) == {"strength": 2, "hypertrophy": 2, "endurance": 1}


def test_weekly_fills_gaps_and_sums():
    sets = [s(1, 21, 5, 100), s(1, 21, 5, 100), s(2, 1, 10, 50)]
    rows = stats.history(sets, "weight", None)
    wk = stats.weekly(rows)
    assert len(wk) >= 3
    assert wk[0]["volume"] == 1000 and wk[0]["working_sets"] == 2 and wk[0]["sessions"] == 1
    assert any(w["volume"] == 0 and w["sessions"] == 0 for w in wk)
    assert stats.weekly([]) == []


def test_lifetime_weight():
    sets = [s(1, 20, 5, 100), s(2, 10, 8, 90), s(2, 10, 20, 30), s(2, 10, 10, 20, warm=True)]
    rows = stats.history(sets, "weight", None)
    lt = stats.lifetime(sets, rows, "weight", None, NOW)
    assert lt["total_volume"] == 500 + 720 + 600
    assert lt["total_sessions"] == 2 and lt["total_working_sets"] == 3
    assert lt["heaviest_set"] == {"reps": 5, "weight_kg": 100.0}
    assert lt["most_reps"] == 20
    assert lt["best_session_volume"] == 1320
    assert lt["days_since_last"] == 10
    assert lt["longest_hold_sec"] is None


def test_lifetime_time_and_empty():
    sets = [s(1, 5, 60, 0), s(2, 2, 90, 0)]
    rows = stats.history(sets, "time", None)
    lt = stats.lifetime(sets, rows, "time", None, NOW)
    assert lt["longest_hold_sec"] == 90 and lt["total_time_sec"] == 150
    assert lt["total_volume"] is None and lt["heaviest_set"] is None
    empty = stats.lifetime([], [], "weight", None, NOW)
    assert empty["total_sessions"] == 0 and empty["avg_sessions_per_week"] is None


def test_lifetime_bodyweight_uses_body_weight():
    sets = [s(1, 3, 10, 0)]
    rows = stats.history(sets, "bodyweight", 80)
    lt = stats.lifetime(sets, rows, "bodyweight", 80, NOW)
    assert lt["total_volume"] == 800 and lt["heaviest_set"]["weight_kg"] == 80


def test_plateau_weeks():
    rows = stats.history([s(1, 7 * 6, 5, 100), s(2, 7 * 2, 5, 90)], "weight", None)
    assert stats.plateau_weeks(rows, NOW) == 6
    assert stats.plateau_weeks([], NOW) is None
    t = stats.history([s(1, 3, 60, 0)], "time", None)
    assert stats.plateau_weeks(t, NOW) is None


def test_rpe_adds_reps_in_reserve():
    assert stats.reps_to_failure(8, None) == 8
    assert stats.reps_to_failure(8, 10) == 8
    assert stats.reps_to_failure(8, 8) == 10
    assert stats.reps_to_failure(8, 7.5) == 10.5
    # Reserve höchstens 4 Wdh., Gesamt höchstens 30
    assert stats.reps_to_failure(8, 3) == 12
    assert stats.reps_to_failure(28, 6) == 30
    assert stats.e1rm(80, 8, 8) == pytest.approx(80 * (1 + 10 / 30))
    assert stats.e1rm(40, 20, 7) == pytest.approx(40 * stats.rm_factor(23))


def test_session_metrics_uses_rpe_for_e1rm():
    # 100 × 5 @ RPE 7 (3 in Reserve) schlägt 100 × 6 @ RPE 10
    m = stats.session_metrics([sr(1, 1, 6, 100, rpe=10), sr(1, 1, 5, 100, rpe=7)], "weight", None)
    assert m["e1rm"] == pytest.approx(100 * (1 + 8 / 30), abs=0.01)
    assert m["best_set"] == {"reps": 5, "weight_kg": 100}


def test_pr_events_use_rpe():
    sets = [sr(1, 10, 8, 80, rpe=10, set_id=1), sr(2, 3, 8, 80, rpe=8, set_id=2)]
    events = stats.pr_events(sets, "weight", None)
    assert [e["kind"] for e in events] == ["e1rm"]
    assert events[0]["value"] == pytest.approx(80 * (1 + 10 / 30), abs=0.01)
