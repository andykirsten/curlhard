API = "/api/v1"


def _day(c, catalog, group=1):
    plan = c.post(f"{API}/plans", json={"name": "P"}).json()
    day = c.post(f"{API}/plans/{plan['id']}/days", json={"name": "Push", "weekdays": [0]}).json()
    items = [
        c.post(
            f"{API}/plan-days/{day['id']}/exercises",
            json={"exercise_id": catalog[k]["id"], "group_no": group},
        ).json()
        for k in ("bench", "squat")
    ]
    return day, items


def test_plan_exercise_group_no_set_and_clear(alice, catalog):
    day, (a, b) = _day(alice, catalog)
    assert (a["group_no"], b["group_no"]) == (1, 1)
    # Andere Felder ändern lässt die Gruppe unberührt
    assert (
        alice.patch(f"{API}/plan-exercises/{a['id']}", json={"note": "x"}).json()["group_no"] == 1
    )
    # Explizit null löst die Gruppe
    cleared = alice.patch(f"{API}/plan-exercises/{a['id']}", json={"group_no": None}).json()
    assert cleared["group_no"] is None
    assert (
        alice.patch(f"{API}/plan-exercises/{a['id']}", json={"group_no": 2}).json()["group_no"] == 2
    )


def test_session_copies_group_no_from_plan_day(alice, catalog):
    day, _ = _day(alice, catalog)
    s = alice.post(f"{API}/sessions", json={"plan_day_id": day["id"]}).json()
    assert [e["group_no"] for e in s["exercises"]] == [1, 1]


def test_apply_session_to_plan_writes_group_no_back(alice, catalog):
    day, (a, b) = _day(alice, catalog)
    s = alice.post(f"{API}/sessions", json={"plan_day_id": day["id"]}).json()
    # Gruppe im Plan lösen; das Training trägt sie noch
    alice.patch(f"{API}/plan-exercises/{a['id']}", json={"group_no": None})
    after = alice.post(f"{API}/sessions/{s['id']}/apply-to-plan").json()
    assert [e["group_no"] for e in after["exercises"]] == [1, 1]


def test_set_type_roundtrip_and_no_records_for_drop(alice, catalog):
    ex = catalog["bench"]["id"]

    def new_set(body):
        sess = alice.post(f"{API}/sessions", json={}).json()
        se = alice.post(f"{API}/sessions/{sess['id']}/exercises", json={"exercise_id": ex}).json()
        return alice.post(f"{API}/session-exercises/{se['id']}/sets", json=body).json()

    new_set({"reps": 5, "weight_kg": 100})  # Vorgeschichte
    drop = new_set({"reps": 5, "weight_kg": 120, "set_type": "drop"})
    assert drop["set_type"] == "drop" and drop["records"] == []
    normal = new_set({"reps": 5, "weight_kg": 120})
    assert normal["set_type"] == "normal" and normal["records"] != []
    # Typ nachträglich ändern: aus dem Rekordsatz wird ein Backoff-Satz ohne Rekord
    patched = alice.patch(f"{API}/sets/{normal['id']}", json={"set_type": "backoff"}).json()
    assert patched["set_type"] == "backoff" and patched["records"] == []


def test_unknown_set_type_is_rejected(alice, catalog):
    sess = alice.post(f"{API}/sessions", json={}).json()
    se = alice.post(
        f"{API}/sessions/{sess['id']}/exercises", json={"exercise_id": catalog["bench"]["id"]}
    ).json()
    r = alice.post(f"{API}/session-exercises/{se['id']}/sets", json={"reps": 5, "set_type": "x"})
    assert r.status_code == 422
