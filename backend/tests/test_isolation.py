"""User B darf Daten von User A weder lesen noch ändern (404 statt 403)."""

import pytest

API = "/api/v1"


@pytest.fixture
def world(alice, catalog):
    """Daten von Alice über alle Ressourcen-Typen hinweg."""
    private = alice.post(f"{API}/exercises", json={"name": "Alices Geheimübung"}).json()
    plan = alice.post(f"{API}/plans", json={"name": "Alice-Plan"}).json()
    day = alice.post(f"{API}/plans/{plan['id']}/days", json={"name": "Tag", "weekday": 1}).json()
    pe = alice.post(
        f"{API}/plan-days/{day['id']}/exercises", json={"exercise_id": private["id"]}
    ).json()
    session = alice.post(f"{API}/sessions", json={"plan_day_id": day["id"]}).json()
    se = session["exercises"][0]
    st = alice.post(
        f"{API}/session-exercises/{se['id']}/sets", json={"reps": 5, "weight_kg": 60}
    ).json()
    return {
        "private": private["id"],
        "plan": plan["id"],
        "day": day["id"],
        "pe": pe["id"],
        "session": session["id"],
        "se": se["id"],
        "set": st["id"],
    }


def _cases(w):
    return [
        ("get", f"/exercises/{w['private']}", None),
        ("patch", f"/exercises/{w['private']}", {"name": "gehackt"}),
        ("get", f"/exercises/{w['private']}/note", None),
        ("put", f"/exercises/{w['private']}/note", {"note": "x"}),
        ("get", f"/plans/{w['plan']}", None),
        ("patch", f"/plans/{w['plan']}", {"name": "gehackt"}),
        ("delete", f"/plans/{w['plan']}", None),
        ("post", f"/plans/{w['plan']}/activate", None),
        ("post", f"/plans/{w['plan']}/duplicate", None),
        ("put", f"/plans/{w['plan']}/order", {"ids": [w["day"]]}),
        ("post", f"/plans/{w['plan']}/days", {"name": "X"}),
        ("patch", f"/plan-days/{w['day']}", {"name": "gehackt"}),
        ("delete", f"/plan-days/{w['day']}", None),
        ("put", f"/plan-days/{w['day']}/order", {"ids": [w["pe"]]}),
        ("post", f"/plan-days/{w['day']}/exercises", {"exercise_id": w["private"]}),
        ("patch", f"/plan-exercises/{w['pe']}", {"note": "gehackt"}),
        ("delete", f"/plan-exercises/{w['pe']}", None),
        ("get", f"/sessions/{w['session']}", None),
        ("patch", f"/sessions/{w['session']}", {"note": "gehackt"}),
        ("delete", f"/sessions/{w['session']}", None),
        ("post", f"/sessions/{w['session']}/finish", None),
        ("post", f"/sessions/{w['session']}/exercises", {"exercise_id": w["private"]}),
        ("patch", f"/session-exercises/{w['se']}", {"note": "gehackt"}),
        ("delete", f"/session-exercises/{w['se']}", None),
        ("post", f"/session-exercises/{w['se']}/sets", {"reps": 1, "weight_kg": 1}),
        ("patch", f"/sets/{w['set']}", {"reps": 99}),
        ("delete", f"/sets/{w['set']}", None),
        ("get", f"/stats/exercises/{w['private']}/summary", None),
        ("get", f"/stats/exercises/{w['private']}/history", None),
        ("get", f"/stats/exercises/{w['private']}/records", None),
    ]


def test_every_endpoint_hides_foreign_resources(alice, bob, world):
    for method, path, body in _cases(world):
        kwargs = {"json": body} if body is not None else {}
        r = getattr(bob, method)(f"{API}{path}", **kwargs)
        assert r.status_code == 404, f"{method.upper()} {path} -> {r.status_code}"
        assert r.json()["error"]["code"] == "not_found"


def test_owner_data_untouched_after_attacks(alice, bob, world):
    for method, path, body in _cases(world):
        kwargs = {"json": body} if body is not None else {}
        getattr(bob, method)(f"{API}{path}", **kwargs)
    assert alice.get(f"{API}/plans/{world['plan']}").json()["name"] == "Alice-Plan"
    session = alice.get(f"{API}/sessions/{world['session']}").json()
    assert session["note"] == "" and len(session["exercises"][0]["sets"]) == 1
    assert session["exercises"][0]["sets"][0]["reps"] == 5
    assert alice.get(f"{API}/exercises/{world['private']}").json()["name"] == "Alices Geheimübung"


def test_lists_never_leak(alice, bob, world):
    assert bob.get(f"{API}/plans").json() == []
    assert bob.get(f"{API}/sessions").json() == []
    names = {e["name"] for e in bob.get(f"{API}/exercises").json()}
    assert "Alices Geheimübung" not in names
    assert bob.get(f"{API}/today").json()["plan"] is None
    overview = bob.get(f"{API}/stats/overview").json()["weeks"]
    assert all(w["volume"] == 0 and w["sessions"] == 0 for w in overview)


def test_user_id_in_body_is_ignored(alice, bob):
    me = alice.get(f"{API}/auth/me").json()
    r = bob.post(f"{API}/plans", json={"name": "Meins", "user_id": me["id"]})
    assert r.status_code == 201
    assert [p["name"] for p in bob.get(f"{API}/plans").json()] == ["Meins"]
    assert alice.get(f"{API}/plans").json() == []


def test_stats_of_global_exercise_are_per_user(alice, bob, catalog):
    ex = catalog["bench"]["id"]
    s = alice.post(f"{API}/sessions", json={}).json()
    se = alice.post(f"{API}/sessions/{s['id']}/exercises", json={"exercise_id": ex}).json()
    alice.post(f"{API}/session-exercises/{se['id']}/sets", json={"reps": 5, "weight_kg": 100})
    assert alice.get(f"{API}/stats/exercises/{ex}/summary").json()["session_count"] == 1
    assert bob.get(f"{API}/stats/exercises/{ex}/summary").json()["session_count"] == 0
    assert bob.get(f"{API}/stats/exercises/{ex}/history").json()["points"] == []


def test_admin_has_no_access_to_user_data(admin, alice, world):
    assert admin.get(f"{API}/plans/{world['plan']}").status_code == 404
    assert admin.get(f"{API}/sessions/{world['session']}").status_code == 404
    assert admin.patch(f"{API}/exercises/{world['private']}", json={"name": "x"}).status_code == 404


def test_all_user_endpoints_require_login(app, world):
    from fastapi.testclient import TestClient

    anon = TestClient(app, base_url="http://testserver")
    for method, path, body in _cases(world) + [("get", "/today", None), ("get", "/plans", None)]:
        kwargs = {"json": body} if body is not None else {}
        r = getattr(anon, method)(f"{API}{path}", **kwargs)
        assert r.status_code == 401, f"{method.upper()} {path} -> {r.status_code}"
