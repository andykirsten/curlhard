"""Öffentliche Pläne: teilen, lesen, übernehmen und zurückziehen."""

import pytest
from sqlmodel import select

from app.models import User

API = "/api/v1"


@pytest.fixture
def shared(alice, catalog):
    """Alices Plan mit globaler Übung und einer privaten Übung."""
    private = alice.post(
        f"{API}/exercises",
        json={
            "name": "Alice-Geheimzug",
            "description": "Nur für Alice",
            "primary_muscle_group_id": catalog["chest_id"],
        },
    ).json()
    plan = alice.post(f"{API}/plans", json={"name": "Push Alice", "description": "Brust"}).json()
    day = alice.post(
        f"{API}/plans/{plan['id']}/days", json={"name": "Brust", "weekdays": [1]}
    ).json()
    alice.post(
        f"{API}/plan-days/{day['id']}/exercises",
        json={"exercise_id": catalog["bench"]["id"], "target_sets": 4},
    )
    alice.post(f"{API}/plan-days/{day['id']}/exercises", json={"exercise_id": private["id"]})
    return {"plan": plan["id"], "private": private["id"]}


def _publish(client, plan_id: int, value: bool = True):
    return client.patch(f"{API}/plans/{plan_id}", json={"is_public": value})


def test_toggle_then_listed_for_others_not_for_author(alice, bob, shared):
    assert bob.get(f"{API}/public-plans").json() == []
    assert _publish(alice, shared["plan"]).json()["is_public"] is True
    items = bob.get(f"{API}/public-plans").json()
    assert [i["name"] for i in items] == ["Push Alice"]
    assert items[0]["author"]["display_name"] == "alice"
    assert items[0]["day_count"] == 1 and items[0]["exercise_count"] == 2
    assert items[0]["days"] == [{"name": "Brust", "weekdays": [1], "exercise_count": 2}]
    assert alice.get(f"{API}/public-plans").json() == []


def test_read_public_plan_with_author(alice, bob, shared):
    _publish(alice, shared["plan"])
    r = bob.get(f"{API}/public-plans/{shared['plan']}")
    assert r.status_code == 200
    body = r.json()
    alice_id = alice.get(f"{API}/auth/me").json()["id"]
    assert body["is_public"] is True and body["author"]["id"] == alice_id
    exercises = body["days"][0]["exercises"]
    assert len(exercises) == 2 and exercises[0]["target_sets"] == 4
    assert body["exercise_names"][str(shared["private"])] == "Alice-Geheimzug"


def test_copy_creates_independent_plan_and_private_exercise(alice, bob, shared, catalog):
    _publish(alice, shared["plan"])
    r = bob.post(f"{API}/public-plans/{shared['plan']}/copy")
    assert r.status_code == 201
    copy = r.json()
    assert copy["name"] == "Push Alice"
    assert copy["is_active"] is False and copy["is_public"] is False

    ex_ids = [pe["exercise_id"] for pe in copy["days"][0]["exercises"]]
    assert ex_ids[0] == catalog["bench"]["id"]  # globale Übung bleibt unverändert
    bob_ex_id = ex_ids[1]
    assert bob_ex_id != shared["private"]
    bob_ex = bob.get(f"{API}/exercises/{bob_ex_id}").json()
    assert bob_ex["name"] == "Alice-Geheimzug"
    assert bob_ex["description"] == "Nur für Alice"
    assert bob_ex["owner_user_id"] == bob.get(f"{API}/auth/me").json()["id"]

    # Alices private Übung ist unverändert
    alice_ex = alice.get(f"{API}/exercises/{shared['private']}").json()
    assert alice_ex["name"] == "Alice-Geheimzug" and alice_ex["description"] == "Nur für Alice"

    # Änderungen an der Kopie wirken nicht auf das Original
    bob.patch(f"{API}/plans/{copy['id']}", json={"name": "Bobs Version"})
    assert alice.get(f"{API}/plans/{shared['plan']}").json()["name"] == "Push Alice"

    # zweite Übernahme nutzt die vorhandene eigene Übung wieder
    copy2 = bob.post(f"{API}/public-plans/{shared['plan']}/copy").json()
    assert copy2["days"][0]["exercises"][1]["exercise_id"] == bob_ex_id
    same_name = [e for e in bob.get(f"{API}/exercises").json() if e["name"] == "Alice-Geheimzug"]
    assert len(same_name) == 1


def test_unpublish_makes_plan_invisible_again(alice, bob, shared):
    _publish(alice, shared["plan"])
    assert bob.get(f"{API}/public-plans/{shared['plan']}").status_code == 200
    _publish(alice, shared["plan"], False)
    assert bob.get(f"{API}/public-plans/{shared['plan']}").status_code == 404
    assert bob.post(f"{API}/public-plans/{shared['plan']}/copy").status_code == 404
    assert bob.get(f"{API}/public-plans").json() == []


def test_own_public_plan_is_not_copyable(alice, shared):
    _publish(alice, shared["plan"])
    assert alice.get(f"{API}/public-plans/{shared['plan']}").status_code == 404
    assert alice.post(f"{API}/public-plans/{shared['plan']}/copy").status_code == 404


def test_copy_reactivates_archived_private_exercise(alice, bob, shared):
    _publish(alice, shared["plan"])
    first = bob.post(f"{API}/public-plans/{shared['plan']}/copy").json()
    bob_ex_id = first["days"][0]["exercises"][1]["exercise_id"]
    assert bob.patch(f"{API}/exercises/{bob_ex_id}", json={"is_active": False}).status_code == 200

    second = bob.post(f"{API}/public-plans/{shared['plan']}/copy").json()
    assert second["days"][0]["exercises"][1]["exercise_id"] == bob_ex_id
    assert bob.get(f"{API}/exercises/{bob_ex_id}").json()["is_active"] is True


def test_deactivated_author_is_hidden_everywhere(alice, bob, shared, db):
    _publish(alice, shared["plan"])
    assert len(bob.get(f"{API}/public-plans").json()) == 1

    author = db.exec(select(User).where(User.email == "alice@example.com")).one()
    author.is_active = False
    db.add(author)
    db.commit()

    assert bob.get(f"{API}/public-plans").json() == []
    assert bob.get(f"{API}/public-plans/{shared['plan']}").status_code == 404
    assert bob.post(f"{API}/public-plans/{shared['plan']}/copy").status_code == 404


def test_list_limit_is_bounded(alice, bob, shared):
    _publish(alice, shared["plan"])
    assert bob.get(f"{API}/public-plans", params={"limit": 101}).status_code == 422
    assert bob.get(f"{API}/public-plans", params={"limit": 0}).status_code == 422
    assert len(bob.get(f"{API}/public-plans", params={"limit": 1}).json()) == 1


def test_exercise_count_counts_only_this_plan(alice, bob, shared):
    """Die Übungsanzahl zählt nur die Übungen dieses Plans, nicht alle des Autors."""
    other = alice.post(f"{API}/plans", json={"name": "Zweiter Plan"}).json()
    day = alice.post(f"{API}/plans/{other['id']}/days", json={"name": "Beine"}).json()
    alice.post(f"{API}/plan-days/{day['id']}/exercises", json={"exercise_id": shared["private"]})
    _publish(alice, shared["plan"])
    _publish(alice, other["id"])

    items = {i["name"]: i for i in bob.get(f"{API}/public-plans").json()}
    assert items["Push Alice"]["exercise_count"] == 2
    assert items["Zweiter Plan"]["exercise_count"] == 1
    assert items["Zweiter Plan"]["days"] == [{"name": "Beine", "weekdays": [], "exercise_count": 1}]
