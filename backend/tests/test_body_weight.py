from datetime import date, timedelta

from sqlmodel import select

from app.models import BodyWeightLog
from tests.conftest import PASSWORD
from tests.test_stats_api import log

API = "/api/v1"


def day(days_ago: int) -> str:
    return (date.today() - timedelta(days=days_ago)).isoformat()


def test_upsert_per_day_and_current_weight_follows_latest(alice):
    a = alice.post(f"{API}/body-weight", json={"weight_kg": 80, "measured_on": day(10)}).json()
    assert a["measured_on"] == day(10)
    # Derselbe Tag wird überschrieben, kein zweiter Eintrag
    again = alice.post(f"{API}/body-weight", json={"weight_kg": 81, "measured_on": day(10)}).json()
    assert again["id"] == a["id"] and again["weight_kg"] == 81
    alice.post(f"{API}/body-weight", json={"weight_kg": 79, "measured_on": day(2)})
    # Ein älterer Nachtrag ändert das aktuelle Gewicht nicht
    alice.post(f"{API}/body-weight", json={"weight_kg": 90, "measured_on": day(30)})
    assert alice.get(f"{API}/auth/me").json()["body_weight_kg"] == 79
    rows = alice.get(f"{API}/body-weight").json()
    assert [r["weight_kg"] for r in rows] == [90, 81, 79]  # aufsteigend nach Datum
    ranged = alice.get(f"{API}/body-weight", params={"from": day(5)}).json()
    assert [r["weight_kg"] for r in ranged] == [79]


def test_future_date_and_invalid_weight_are_rejected(alice):
    future = (date.today() + timedelta(days=1)).isoformat()
    r = alice.post(f"{API}/body-weight", json={"weight_kg": 80, "measured_on": future})
    assert r.status_code == 422 and r.json()["error"]["code"] == "future_date"
    assert alice.post(f"{API}/body-weight", json={"weight_kg": 0}).status_code == 422


def test_profile_field_writes_todays_entry(alice):
    alice.patch(f"{API}/auth/me", json={"body_weight_kg": 82.5})
    rows = alice.get(f"{API}/body-weight").json()
    assert [(r["measured_on"], r["weight_kg"]) for r in rows] == [(day(0), 82.5)]
    # Löschen des einzigen Eintrags lässt das aktuelle Gewicht stehen
    alice.delete(f"{API}/body-weight/{rows[0]['id']}")
    assert alice.get(f"{API}/body-weight").json() == []
    assert alice.get(f"{API}/auth/me").json()["body_weight_kg"] == 82.5


def test_delete_latest_entry_moves_current_weight_back(alice):
    old = alice.post(f"{API}/body-weight", json={"weight_kg": 80, "measured_on": day(9)}).json()
    new = alice.post(f"{API}/body-weight", json={"weight_kg": 78, "measured_on": day(1)}).json()
    assert alice.get(f"{API}/auth/me").json()["body_weight_kg"] == 78
    assert alice.delete(f"{API}/body-weight/{new['id']}").status_code == 204
    assert alice.get(f"{API}/auth/me").json()["body_weight_kg"] == 80
    assert old["id"] != new["id"]


def test_bodyweight_exercise_uses_weight_at_the_day_of_the_set(alice):
    ex = alice.post(f"{API}/exercises", json={"name": "Klimmzug", "load_type": "bodyweight"}).json()
    alice.post(f"{API}/body-weight", json={"weight_kg": 70, "measured_on": day(30)})
    alice.post(f"{API}/body-weight", json={"weight_kg": 80, "measured_on": day(5)})
    log(alice, ex["id"], 20, [(10, 0)])  # damals 70 kg
    log(alice, ex["id"], 2, [(10, 0)])  # jetzt 80 kg
    points = alice.get(f"{API}/stats/exercises/{ex['id']}/history").json()["points"]
    assert [p["volume"] for p in points] == [700, 800]


def test_relative_e1rm_only_for_weight_exercises(alice, catalog):
    alice.patch(f"{API}/auth/me", json={"body_weight_kg": 80})
    bench = catalog["bench"]["id"]
    log(alice, bench, 1, [(1, 120)])
    summary = alice.get(f"{API}/stats/exercises/{bench}/summary").json()
    assert summary["relative_e1rm"] == round(summary["e1rm"] / 80, 2) == 1.5
    pull = alice.post(
        f"{API}/exercises", json={"name": "Klimmzug", "load_type": "bodyweight"}
    ).json()
    log(alice, pull["id"], 1, [(5, 10)])
    assert alice.get(f"{API}/stats/exercises/{pull['id']}/summary").json()["relative_e1rm"] is None


def test_body_weight_is_part_of_export_and_account_delete(alice, db):
    alice.post(f"{API}/body-weight", json={"weight_kg": 80})
    assert len(alice.get(f"{API}/account/export").json()["body_weight"]) == 1
    assert alice.post(f"{API}/account/delete", json={"password": PASSWORD}).status_code == 204
    db.expire_all()
    assert db.exec(select(BodyWeightLog)).all() == []
