API = "/api/v1"


def _plan_with_day(c, catalog):
    plan = c.post(f"{API}/plans", json={"name": "PPL"}).json()
    day = c.post(f"{API}/plans/{plan['id']}/days", json={"name": "Push", "weekdays": [0]}).json()
    pe = c.post(
        f"{API}/plan-days/{day['id']}/exercises",
        json={"exercise_id": catalog["bench"]["id"], "target_sets": 4, "target_rest_sec": 120},
    ).json()
    return plan, day, pe


def test_first_plan_is_active_second_not(alice):
    p1 = alice.post(f"{API}/plans", json={"name": "A"}).json()
    p2 = alice.post(f"{API}/plans", json={"name": "B"}).json()
    assert p1["is_active"] is True and p2["is_active"] is False


def test_activate_switches_exactly_one(alice):
    p1 = alice.post(f"{API}/plans", json={"name": "A"}).json()
    p2 = alice.post(f"{API}/plans", json={"name": "B"}).json()
    alice.post(f"{API}/plans/{p2['id']}/activate")
    plans = {p["id"]: p["is_active"] for p in alice.get(f"{API}/plans").json()}
    assert plans == {p1["id"]: False, p2["id"]: True}


def test_plan_structure_and_positions(alice, catalog):
    plan, day, pe = _plan_with_day(alice, catalog)
    second = alice.post(
        f"{API}/plan-days/{day['id']}/exercises", json={"exercise_id": catalog["squat"]["id"]}
    ).json()
    assert (pe["position"], second["position"]) == (0, 1)
    full = alice.get(f"{API}/plans/{plan['id']}").json()
    assert full["days"][0]["weekdays"] == [0]
    assert [e["id"] for e in full["days"][0]["exercises"]] == [pe["id"], second["id"]]
    assert full["days"][0]["exercises"][0]["target_rest_sec"] == 120


def test_reorder_exercises_and_days(alice, catalog):
    plan, day, pe = _plan_with_day(alice, catalog)
    second = alice.post(
        f"{API}/plan-days/{day['id']}/exercises", json={"exercise_id": catalog["squat"]["id"]}
    ).json()
    r = alice.put(f"{API}/plan-days/{day['id']}/order", json={"ids": [second["id"], pe["id"]]})
    assert [e["id"] for e in r.json()["exercises"]] == [second["id"], pe["id"]]
    bad = alice.put(f"{API}/plan-days/{day['id']}/order", json={"ids": [pe["id"]]})
    assert bad.status_code == 422
    d2 = alice.post(f"{API}/plans/{plan['id']}/days", json={"name": "Pull"}).json()
    r = alice.put(f"{API}/plans/{plan['id']}/order", json={"ids": [d2["id"], day["id"]]})
    assert [d["id"] for d in r.json()["days"]] == [d2["id"], day["id"]]


def test_update_and_validation(alice, catalog):
    plan, day, pe = _plan_with_day(alice, catalog)
    r = alice.patch(f"{API}/plan-days/{day['id']}", json={"weekdays": [1, 9]})
    assert r.status_code == 422
    r = alice.patch(f"{API}/plan-days/{day['id']}", json={"weekdays": [4, 0, 2, 4]})
    assert r.json()["weekdays"] == [0, 2, 4]
    r = alice.patch(f"{API}/plan-days/{day['id']}", json={"name": "Ganzkörper"})
    assert r.json()["weekdays"] == [0, 2, 4]
    r = alice.patch(f"{API}/plan-days/{day['id']}", json={"weekdays": []})
    assert r.json()["weekdays"] == []
    r = alice.patch(f"{API}/plan-exercises/{pe['id']}", json={"target_reps_min": 20})
    assert r.status_code == 422
    r = alice.patch(
        f"{API}/plan-exercises/{pe['id']}", json={"target_reps_min": 6, "target_reps_max": 8}
    )
    assert r.status_code == 200 and r.json()["target_reps_min"] == 6


def test_unknown_exercise_rejected(alice, bob):
    plan = alice.post(f"{API}/plans", json={"name": "A"}).json()
    day = alice.post(f"{API}/plans/{plan['id']}/days", json={"name": "D"}).json()
    private = bob.post(f"{API}/exercises", json={"name": "Bobs"}).json()
    r = alice.post(f"{API}/plan-days/{day['id']}/exercises", json={"exercise_id": private["id"]})
    assert r.status_code == 404


def test_delete_plan_cascades_but_keeps_sessions(alice, catalog):
    plan, day, pe = _plan_with_day(alice, catalog)
    session = alice.post(f"{API}/sessions", json={"plan_day_id": day["id"]}).json()
    assert alice.delete(f"{API}/plans/{plan['id']}").status_code == 204
    assert alice.get(f"{API}/plans/{plan['id']}").status_code == 404
    assert alice.patch(f"{API}/plan-exercises/{pe['id']}", json={"note": "x"}).status_code == 404
    kept = alice.get(f"{API}/sessions/{session['id']}")
    assert kept.status_code == 200 and kept.json()["plan_day_id"] is None
    assert len(kept.json()["exercises"]) == 1


def test_duplicate_plan(alice, catalog):
    plan, day, pe = _plan_with_day(alice, catalog)
    copy = alice.post(f"{API}/plans/{plan['id']}/duplicate").json()
    assert copy["id"] != plan["id"] and copy["is_active"] is False
    assert copy["days"][0]["id"] != day["id"]
    assert copy["days"][0]["exercises"][0]["exercise_id"] == catalog["bench"]["id"]


def test_delete_day_and_exercise(alice, catalog):
    plan, day, pe = _plan_with_day(alice, catalog)
    assert alice.delete(f"{API}/plan-exercises/{pe['id']}").status_code == 204
    assert alice.delete(f"{API}/plan-days/{day['id']}").status_code == 204
    assert alice.get(f"{API}/plans/{plan['id']}").json()["days"] == []


def test_pagination(alice):
    for i in range(5):
        alice.post(f"{API}/plans", json={"name": f"P{i}"})
    assert len(alice.get(f"{API}/plans?limit=2").json()) == 2
    assert len(alice.get(f"{API}/plans?limit=10&offset=3").json()) == 2
