from sqlmodel import select

from app.models import Exercise, SetLog, User
from tests.conftest import PASSWORD

API = "/api/v1"


def _seed(c, catalog):
    ex = c.post(f"{API}/exercises", json={"name": "Privat"}).json()
    plan = c.post(f"{API}/plans", json={"name": "P"}).json()
    day = c.post(f"{API}/plans/{plan['id']}/days", json={"name": "D"}).json()
    c.post(f"{API}/plan-days/{day['id']}/exercises", json={"exercise_id": ex["id"]})
    s = c.post(f"{API}/sessions", json={"plan_day_id": day["id"]}).json()
    c.post(
        f"{API}/session-exercises/{s['exercises'][0]['id']}/sets",
        json={"reps": 5, "weight_kg": 50},
    )
    c.put(f"{API}/exercises/{catalog['bench']['id']}/note", json={"note": "memo"})


def test_export_contains_only_own_data(alice, bob, catalog):
    _seed(alice, catalog)
    _seed(bob, catalog) if False else None
    data = alice.get(f"{API}/account/export").json()
    assert data["profile"]["email"] == "alice@example.com"
    assert "password_hash" not in str(data)
    assert len(data["plans"]) == 1 and len(data["sets"]) == 1
    assert data["private_exercises"][0]["name"] == "Privat"
    assert data["exercise_notes"][0]["note"] == "memo"
    empty = bob.get(f"{API}/account/export").json()
    assert empty["plans"] == [] and empty["sets"] == []


def test_delete_account_removes_everything(app, alice, bob, catalog, db):
    _seed(alice, catalog)
    bob.post(f"{API}/plans", json={"name": "Bobs"})
    assert (
        alice.post(f"{API}/account/delete", json={"password": "falsch-falsch"}).status_code == 400
    )
    r = alice.post(f"{API}/account/delete", json={"password": PASSWORD})
    assert r.status_code == 204
    assert alice.get(f"{API}/auth/me").status_code == 401
    db.expire_all()
    assert db.exec(select(User).where(User.email == "alice@example.com")).first() is None
    assert db.exec(select(SetLog)).all() == []
    assert db.exec(select(Exercise).where(Exercise.name == "Privat")).first() is None
    assert [p["name"] for p in bob.get(f"{API}/plans").json()] == ["Bobs"]
    assert bob.get(f"{API}/auth/me").status_code == 200
