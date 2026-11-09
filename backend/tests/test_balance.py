from tests.test_stats_api import log

API = "/api/v1"


def test_balance_counts_primary_full_and_secondary_half(alice, admin, catalog):
    triceps = admin.post(f"{API}/muscle-groups", json={"name": "Trizeps"}).json()
    press = alice.post(
        f"{API}/exercises",
        json={
            "name": "Schrägbankdrücken",
            "primary_muscle_group_id": catalog["chest_id"],
            "secondary_muscle_group_ids": [triceps["id"]],
        },
    ).json()
    log(alice, press["id"], 2, [(8, 60, True), (8, 80), (8, 80), (8, 80)])  # 1 Aufwärmsatz
    rows = {
        r["name"]: r["sets_per_week"]
        for r in alice.get(f"{API}/stats/balance").json()["muscle_groups"]
    }
    assert rows["Brust"] == 0.8  # 3 Arbeitssätze / 4 Wochen
    assert rows["Trizeps"] == 0.4  # halbe Gewichtung


def test_balance_lists_untrained_groups_with_zero_and_orders_by_sets(alice, catalog):
    log(alice, catalog["bench"]["id"], 1, [(8, 80)])
    data = alice.get(f"{API}/stats/balance", params={"weeks": 2}).json()
    assert data["weeks"] == 2
    assert data["muscle_groups"][0] == {
        "muscle_group_id": catalog["chest_id"],
        "name": "Brust",
        "sets_per_week": 0.5,
    }


def test_balance_ignores_sets_older_than_the_window(alice, catalog):
    log(alice, catalog["bench"]["id"], 40, [(8, 80)])
    data = alice.get(f"{API}/stats/balance", params={"weeks": 4}).json()
    assert data["muscle_groups"][0]["sets_per_week"] == 0


def test_pr_feed_spans_exercises_newest_first_and_respects_limit(alice, catalog):
    bench, squat = catalog["bench"]["id"], catalog["squat"]["id"]
    log(alice, bench, 30, [(5, 100)])  # Basis
    log(alice, bench, 10, [(5, 105)])
    log(alice, squat, 20, [(5, 120)])  # Basis
    log(alice, squat, 3, [(5, 130)])
    items = alice.get(f"{API}/stats/prs").json()["items"]
    assert items[0]["exercise_name"] == "Kniebeuge"
    assert {i["exercise_name"] for i in items} == {"Bankdrücken", "Kniebeuge"}
    dates = [i["date"] for i in items]
    assert dates == sorted(dates, reverse=True)
    assert len(alice.get(f"{API}/stats/prs", params={"limit": 1}).json()["items"]) == 1
