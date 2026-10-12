from datetime import UTC, datetime, timedelta

API = "/api/v1"


def iso(days_ago: int) -> str:
    return (datetime.now(UTC) - timedelta(days=days_ago)).isoformat()


def _active_plan(c, catalog, weekday=0):
    plan = c.post(f"{API}/plans", json={"name": "PPL"}).json()
    day = c.post(f"{API}/plans/{plan['id']}/days", json={"name": "Push", "weekday": weekday}).json()
    c.post(
        f"{API}/plan-days/{day['id']}/exercises",
        json={"exercise_id": catalog["bench"]["id"], "target_sets": 3, "target_rest_sec": 120},
    )
    c.post(f"{API}/plan-days/{day['id']}/exercises", json={"exercise_id": catalog["squat"]["id"]})
    return plan, day


def test_today_without_plan(alice):
    body = alice.get(f"{API}/today").json()
    assert body == {"plan": None, "day": None, "other_days": [], "cycle": None}


def test_today_picks_weekday_and_includes_last_values(alice, catalog):
    plan, day = _active_plan(alice, catalog, weekday=2)
    other = alice.post(f"{API}/plans/{plan['id']}/days", json={"name": "Pull", "weekday": 4}).json()
    alice.put(f"{API}/exercises/{catalog['bench']['id']}/note", json={"note": "Sitz 4"})
    s = alice.post(f"{API}/sessions", json={"plan_day_id": day["id"]}).json()
    se = s["exercises"][0]
    alice.post(f"{API}/session-exercises/{se['id']}/sets", json={"reps": 8, "weight_kg": 80})
    alice.post(
        f"{API}/session-exercises/{se['id']}/sets",
        json={"reps": 10, "weight_kg": 40, "is_warmup": True},
    )
    body = alice.get(f"{API}/today", params={"weekday": 2}).json()
    assert body["day"]["id"] == day["id"]
    assert [d["id"] for d in body["other_days"]] == [other["id"]]
    bench = body["day"]["exercises"][0]
    assert bench["name"] == "Bankdrücken" and bench["permanent_note"] == "Sitz 4"
    assert bench["target_rest_sec"] == 120
    assert [(x["reps"], x["weight_kg"]) for x in bench["last_sets"]] == [(8, 80), (10, 40)]
    assert body["day"]["exercises"][1]["last_sets"] == []
    assert alice.get(f"{API}/today", params={"weekday": 6}).json()["day"] is None


def test_start_session_copies_plan_exercises(alice, catalog):
    plan, day = _active_plan(alice, catalog)
    s = alice.post(f"{API}/sessions", json={"plan_day_id": day["id"]}).json()
    assert [e["exercise_id"] for e in s["exercises"]] == [
        catalog["bench"]["id"],
        catalog["squat"]["id"],
    ]
    assert s["finished_at"] is None


def test_free_session_and_add_exercise(alice, catalog):
    s = alice.post(f"{API}/sessions", json={}).json()
    assert s["plan_day_id"] is None and s["exercises"] == []
    r = alice.post(
        f"{API}/sessions/{s['id']}/exercises", json={"exercise_id": catalog["bench"]["id"]}
    )
    assert r.status_code == 201 and r.json()["position"] == 0
    r2 = alice.post(
        f"{API}/sessions/{s['id']}/exercises", json={"exercise_id": catalog["squat"]["id"]}
    )
    assert r2.json()["position"] == 1


def test_log_sets_auto_numbering_and_fields(alice, catalog):
    s = alice.post(f"{API}/sessions", json={}).json()
    se = alice.post(
        f"{API}/sessions/{s['id']}/exercises", json={"exercise_id": catalog["bench"]["id"]}
    ).json()
    a = alice.post(
        f"{API}/session-exercises/{se['id']}/sets",
        json={"reps": 8, "weight_kg": 62.5, "rest_sec": 90, "rpe": 8.5},
    ).json()
    b = alice.post(
        f"{API}/session-exercises/{se['id']}/sets", json={"reps": 7, "weight_kg": 62.5}
    ).json()
    assert (a["set_number"], b["set_number"]) == (1, 2)
    assert a["weight_kg"] == 62.5 and a["rpe"] == 8.5 and a["rest_sec"] == 90
    assert a["is_warmup"] is False
    detail = alice.get(f"{API}/sessions/{s['id']}").json()
    assert len(detail["exercises"][0]["sets"]) == 2


def test_set_validation(alice, catalog):
    s = alice.post(f"{API}/sessions", json={}).json()
    se = alice.post(
        f"{API}/sessions/{s['id']}/exercises", json={"exercise_id": catalog["bench"]["id"]}
    ).json()
    url = f"{API}/session-exercises/{se['id']}/sets"
    assert alice.post(url, json={"reps": -1, "weight_kg": 10}).status_code == 422
    assert alice.post(url, json={"reps": 5, "weight_kg": -10}).status_code == 422
    assert alice.post(url, json={"reps": 5, "weight_kg": 10, "rpe": 11}).status_code == 422
    assert (
        alice.post(url, json={"reps": 5, "completed_at": "2026-01-01T10:00:00"}).status_code == 422
    )


def test_update_and_delete_set(alice, catalog):
    s = alice.post(f"{API}/sessions", json={}).json()
    se = alice.post(
        f"{API}/sessions/{s['id']}/exercises", json={"exercise_id": catalog["bench"]["id"]}
    ).json()
    st = alice.post(
        f"{API}/session-exercises/{se['id']}/sets", json={"reps": 5, "weight_kg": 50}
    ).json()
    r = alice.patch(f"{API}/sets/{st['id']}", json={"reps": 6, "is_warmup": True, "rpe": 9})
    assert r.json()["reps"] == 6 and r.json()["is_warmup"] is True and r.json()["rpe"] == 9
    r = alice.patch(f"{API}/sets/{st['id']}", json={"rpe": None})
    assert r.json()["rpe"] is None
    assert alice.delete(f"{API}/sets/{st['id']}").status_code == 204
    assert alice.patch(f"{API}/sets/{st['id']}", json={"reps": 1}).status_code == 404


def test_record_flag_on_new_best(alice, catalog):
    ex = catalog["bench"]["id"]
    old = alice.post(f"{API}/sessions", json={"started_at": iso(10)}).json()
    se_old = alice.post(f"{API}/sessions/{old['id']}/exercises", json={"exercise_id": ex}).json()
    first = alice.post(
        f"{API}/session-exercises/{se_old['id']}/sets",
        json={"reps": 5, "weight_kg": 100, "completed_at": iso(10)},
    ).json()
    assert first["records"] == []  # erste Eintragung: keine Vorgeschichte
    new = alice.post(f"{API}/sessions", json={}).json()
    se = alice.post(f"{API}/sessions/{new['id']}/exercises", json={"exercise_id": ex}).json()
    better = alice.post(
        f"{API}/session-exercises/{se['id']}/sets", json={"reps": 5, "weight_kg": 105}
    ).json()
    assert better["records"] == [1, 5]
    same = alice.post(
        f"{API}/session-exercises/{se['id']}/sets", json={"reps": 5, "weight_kg": 105}
    ).json()
    assert same["records"] == []
    warm = alice.post(
        f"{API}/session-exercises/{se['id']}/sets",
        json={"reps": 5, "weight_kg": 200, "is_warmup": True},
    ).json()
    assert warm["records"] == []


def test_session_note_finish_and_patch(alice):
    s = alice.post(f"{API}/sessions", json={}).json()
    r = alice.patch(f"{API}/sessions/{s['id']}", json={"note": "Guter Tag"})
    assert r.json()["note"] == "Guter Tag"
    fin = alice.post(f"{API}/sessions/{s['id']}/finish").json()
    assert fin["finished_at"] is not None
    again = alice.post(f"{API}/sessions/{s['id']}/finish").json()
    assert again["finished_at"] == fin["finished_at"]


def test_session_exercise_memo(alice, catalog):
    s = alice.post(f"{API}/sessions", json={}).json()
    se = alice.post(
        f"{API}/sessions/{s['id']}/exercises", json={"exercise_id": catalog["bench"]["id"]}
    ).json()
    r = alice.patch(f"{API}/session-exercises/{se['id']}", json={"note": "Schulter zwickt"})
    assert r.json()["note"] == "Schulter zwickt"
    assert (
        alice.get(f"{API}/sessions/{s['id']}").json()["exercises"][0]["note"] == "Schulter zwickt"
    )
    assert alice.delete(f"{API}/session-exercises/{se['id']}").status_code == 204


def test_list_sessions_with_range_and_counts(alice, catalog):
    for days in (30, 5, 1):
        s = alice.post(f"{API}/sessions", json={"started_at": iso(days)}).json()
        se = alice.post(
            f"{API}/sessions/{s['id']}/exercises", json={"exercise_id": catalog["bench"]["id"]}
        ).json()
        alice.post(f"{API}/session-exercises/{se['id']}/sets", json={"reps": 5, "weight_kg": 50})
    everything = alice.get(f"{API}/sessions").json()
    assert len(everything) == 3
    assert everything[0]["started_at"] > everything[-1]["started_at"]
    assert everything[0]["exercise_count"] == 1 and everything[0]["set_count"] == 1
    recent = alice.get(f"{API}/sessions", params={"from": iso(7)}).json()
    assert len(recent) == 2
    window = alice.get(f"{API}/sessions", params={"from": iso(40), "to": iso(20)}).json()
    assert len(window) == 1


def test_delete_session_removes_sets(alice, catalog):
    s = alice.post(f"{API}/sessions", json={}).json()
    se = alice.post(
        f"{API}/sessions/{s['id']}/exercises", json={"exercise_id": catalog["bench"]["id"]}
    ).json()
    st = alice.post(
        f"{API}/session-exercises/{se['id']}/sets", json={"reps": 5, "weight_kg": 50}
    ).json()
    assert alice.delete(f"{API}/sessions/{s['id']}").status_code == 204
    assert alice.patch(f"{API}/sets/{st['id']}", json={"reps": 1}).status_code == 404


def _log(c, session, exercise_id, *sets):
    se = next(e for e in session["exercises"] if e["exercise_id"] == exercise_id)
    for reps, weight in sets:
        c.post(f"{API}/session-exercises/{se['id']}/sets", json={"reps": reps, "weight_kg": weight})


def test_previous_prefers_same_plan_day(alice, catalog):
    bench, squat = catalog["bench"]["id"], catalog["squat"]["id"]
    plan, day_a = _active_plan(alice, catalog, weekday=0)
    day_b = alice.post(f"{API}/plans/{plan['id']}/days", json={"name": "Tag B"}).json()
    alice.post(f"{API}/plan-days/{day_b['id']}/exercises", json={"exercise_id": bench})

    a1 = alice.post(f"{API}/sessions", json={"plan_day_id": day_a["id"], "started_at": iso(7)})
    _log(alice, a1.json(), bench, (8, 80), (7, 80))
    b1 = alice.post(f"{API}/sessions", json={"plan_day_id": day_b["id"], "started_at": iso(3)})
    _log(alice, b1.json(), bench, (5, 100))
    a2 = alice.post(f"{API}/sessions", json={"plan_day_id": day_a["id"]}).json()
    # Eigene Sätze der laufenden Session dürfen den Vergleich nicht überschreiben
    _log(alice, a2, bench, (9, 82.5))

    body = alice.get(f"{API}/sessions/{a2['id']}/previous").json()
    assert body["plan_day_name"] == "Push"
    by_ex = {e["exercise_id"]: e for e in body["exercises"]}
    assert [(s["reps"], s["weight_kg"]) for s in by_ex[bench]["sets"]] == [(8, 80), (7, 80)]
    assert by_ex[bench]["same_plan_day"] is True
    assert by_ex[bench]["source_session_id"] == a1.json()["id"]
    assert (by_ex[bench]["target_sets"], by_ex[bench]["target_rest_sec"]) == (3, 120)
    assert by_ex[squat]["sets"] == [] and by_ex[squat]["source_session_id"] is None


def test_previous_falls_back_to_any_session(alice, catalog):
    bench, squat = catalog["bench"]["id"], catalog["squat"]["id"]
    _, day = _active_plan(alice, catalog)
    free = alice.post(f"{API}/sessions", json={"started_at": iso(2)}).json()
    se = alice.post(f"{API}/sessions/{free['id']}/exercises", json={"exercise_id": squat}).json()
    alice.post(f"{API}/session-exercises/{se['id']}/sets", json={"reps": 5, "weight_kg": 120})

    s = alice.post(f"{API}/sessions", json={"plan_day_id": day["id"]}).json()
    by_ex = {
        e["exercise_id"]: e
        for e in alice.get(f"{API}/sessions/{s['id']}/previous").json()["exercises"]
    }
    assert by_ex[squat]["same_plan_day"] is False
    assert [(x["reps"], x["weight_kg"]) for x in by_ex[squat]["sets"]] == [(5, 120)]
    assert by_ex[bench]["sets"] == []

    # Freie Session ohne Plantag: nur Fallback, keine Ziele
    later = alice.post(f"{API}/sessions", json={}).json()
    alice.post(f"{API}/sessions/{later['id']}/exercises", json={"exercise_id": squat})
    body = alice.get(f"{API}/sessions/{later['id']}/previous").json()
    assert body["plan_day_name"] is None
    [only] = body["exercises"]
    assert only["target_sets"] is None and only["same_plan_day"] is False
    assert only["source_session_id"] == free["id"]


def test_previous_of_finished_session_looks_further_back(alice, catalog):
    bench = catalog["bench"]["id"]
    _, day = _active_plan(alice, catalog)
    old = alice.post(f"{API}/sessions", json={"plan_day_id": day["id"], "started_at": iso(14)})
    _log(alice, old.json(), bench, (6, 70))
    mid = alice.post(f"{API}/sessions", json={"plan_day_id": day["id"], "started_at": iso(7)})
    _log(alice, mid.json(), bench, (7, 72.5))
    alice.post(f"{API}/sessions", json={"plan_day_id": day["id"]})
    body = alice.get(f"{API}/sessions/{mid.json()['id']}/previous").json()
    bench_prev = next(e for e in body["exercises"] if e["exercise_id"] == bench)
    assert bench_prev["source_session_id"] == old.json()["id"]


def test_cannot_start_session_from_foreign_day(alice, bob, catalog):
    plan, day = _active_plan(bob, catalog)
    assert alice.post(f"{API}/sessions", json={"plan_day_id": day["id"]}).status_code == 404
