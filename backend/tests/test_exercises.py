API = "/api/v1"


def test_catalog_lists_global_and_own_only(admin, alice, bob, catalog):
    alice.post(f"{API}/exercises", json={"name": "Alices Spezial"})
    names_alice = {e["name"] for e in alice.get(f"{API}/exercises").json()}
    names_bob = {e["name"] for e in bob.get(f"{API}/exercises").json()}
    assert {"Bankdrücken", "Kniebeuge", "Alices Spezial"} <= names_alice
    assert "Alices Spezial" not in names_bob


def test_user_cannot_create_global(alice):
    r = alice.post(f"{API}/exercises", json={"name": "X", "is_global": True})
    assert r.status_code == 403


def test_private_exercise_flagged_and_owned(alice):
    r = alice.post(f"{API}/exercises", json={"name": "Meine"})
    assert r.status_code == 201
    assert r.json()["is_global"] is False and r.json()["owner_user_id"] is not None


def test_user_cannot_edit_global(alice, catalog):
    r = alice.patch(f"{API}/exercises/{catalog['bench']['id']}", json={"name": "Hack"})
    assert r.status_code == 403


def test_admin_edits_global_and_deactivates(admin, alice, catalog):
    ex_id = catalog["bench"]["id"]
    assert admin.patch(f"{API}/exercises/{ex_id}", json={"is_active": False}).status_code == 200
    names = {e["name"] for e in alice.get(f"{API}/exercises").json()}
    assert "Bankdrücken" not in names
    inactive = admin.get(f"{API}/exercises?include_inactive=true").json()
    assert any(e["id"] == ex_id for e in inactive)


def test_other_users_private_exercise_is_404(alice, bob):
    ex = alice.post(f"{API}/exercises", json={"name": "Geheim"}).json()
    assert bob.get(f"{API}/exercises/{ex['id']}").status_code == 404
    assert bob.patch(f"{API}/exercises/{ex['id']}", json={"name": "x"}).status_code == 404


def test_name_unique_per_owner(alice, bob):
    assert alice.post(f"{API}/exercises", json={"name": "Curl"}).status_code == 201
    assert alice.post(f"{API}/exercises", json={"name": "Curl"}).status_code == 409
    assert bob.post(f"{API}/exercises", json={"name": "Curl"}).status_code == 201


def test_global_name_unique(admin, catalog):
    r = admin.post(f"{API}/exercises", json={"name": "Kniebeuge", "is_global": True})
    assert r.status_code == 409


def test_search_and_filters(admin, alice, catalog):
    r = alice.get(f"{API}/exercises", params={"search": "bank"}).json()
    assert [e["name"] for e in r] == ["Bankdrücken"]
    r = alice.get(f"{API}/exercises", params={"muscle_group": catalog["chest_id"]}).json()
    assert [e["name"] for e in r] == ["Bankdrücken"]


def test_secondary_muscles_and_equipment(admin, catalog):
    eq = admin.post(f"{API}/equipment", json={"name": "Langhantel"}).json()
    mg = admin.post(f"{API}/muscle-groups", json={"name": "Trizeps"}).json()
    ex = admin.post(
        f"{API}/exercises",
        json={
            "name": "Dips",
            "is_global": True,
            "equipment_id": eq["id"],
            "secondary_muscle_group_ids": [mg["id"]],
        },
    ).json()
    assert ex["secondary_muscle_group_ids"] == [mg["id"]]
    found = admin.get(f"{API}/exercises", params={"muscle_group": mg["id"]}).json()
    assert [e["name"] for e in found] == ["Dips"]
    found = admin.get(f"{API}/exercises", params={"equipment": eq["id"]}).json()
    assert [e["name"] for e in found] == ["Dips"]


def test_invalid_references_rejected(alice):
    r = alice.post(f"{API}/exercises", json={"name": "Z", "equipment_id": 999})
    assert r.status_code == 422


def test_invalid_load_type_rejected(alice):
    r = alice.post(f"{API}/exercises", json={"name": "Z", "load_type": "magic"})
    assert r.status_code == 422


def test_master_data_admin_only(admin, alice):
    assert alice.post(f"{API}/muscle-groups", json={"name": "Wade"}).status_code == 403
    assert alice.post(f"{API}/equipment", json={"name": "Seil"}).status_code == 403
    mg = admin.post(f"{API}/muscle-groups", json={"name": "Wade"}).json()
    assert admin.post(f"{API}/muscle-groups", json={"name": "Wade"}).status_code == 409
    r = admin.patch(f"{API}/muscle-groups/{mg['id']}", json={"name": "Waden"})
    assert r.json()["name"] == "Waden"
    assert [m["name"] for m in alice.get(f"{API}/muscle-groups").json()] == ["Waden"]
    assert alice.get(f"{API}/equipment").status_code == 200


def test_permanent_note_roundtrip_per_user(alice, bob, catalog):
    ex = catalog["bench"]["id"]
    assert alice.get(f"{API}/exercises/{ex}/note").json()["note"] == ""
    alice.put(f"{API}/exercises/{ex}/note", json={"note": "Sitz auf 4"})
    alice.put(f"{API}/exercises/{ex}/note", json={"note": "Sitz auf 5"})
    assert alice.get(f"{API}/exercises/{ex}/note").json()["note"] == "Sitz auf 5"
    assert bob.get(f"{API}/exercises/{ex}/note").json()["note"] == ""


def test_note_on_foreign_private_exercise_404(alice, bob):
    ex = alice.post(f"{API}/exercises", json={"name": "Geheim"}).json()
    assert bob.get(f"{API}/exercises/{ex['id']}/note").status_code == 404
    assert bob.put(f"{API}/exercises/{ex['id']}/note", json={"note": "x"}).status_code == 404


def _equipment_id(admin, name: str) -> int:
    return admin.post(f"{API}/equipment", json={"name": name}).json()["id"]


def test_bar_weight_defaults_from_equipment(admin, alice):
    barbell = _equipment_id(admin, "Langhantel")
    ez = _equipment_id(admin, "SZ-Stange")
    machine = _equipment_id(admin, "Maschine")
    defaults = {}
    for name, eq in (("Kniebeuge", barbell), ("SZ-Curls", ez), ("Beinpresse", machine)):
        ex = alice.post(f"{API}/exercises", json={"name": name, "equipment_id": eq}).json()
        r = alice.get(f"{API}/exercises/{ex['id']}/setting")
        assert r.status_code == 200
        assert r.json()["bar_weight_kg"] is None
        defaults[name] = r.json()["default_bar_weight_kg"]
    assert defaults == {"Kniebeuge": 20.0, "SZ-Curls": 10.0, "Beinpresse": None}


def test_bar_weight_roundtrip_per_user(alice, bob, catalog):
    ex = catalog["squat"]["id"]
    r = alice.put(f"{API}/exercises/{ex}/setting", json={"bar_weight_kg": 15})
    assert r.status_code == 200 and r.json()["bar_weight_kg"] == 15
    assert alice.get(f"{API}/exercises/{ex}/setting").json()["bar_weight_kg"] == 15
    assert bob.get(f"{API}/exercises/{ex}/setting").json()["bar_weight_kg"] is None
    # null setzt auf den Standard zurück
    alice.put(f"{API}/exercises/{ex}/setting", json={"bar_weight_kg": None})
    assert alice.get(f"{API}/exercises/{ex}/setting").json()["bar_weight_kg"] is None


def test_bar_weight_validated(alice, catalog):
    ex = catalog["squat"]["id"]
    assert alice.put(f"{API}/exercises/{ex}/setting", json={"bar_weight_kg": -1}).status_code == 422
    assert (
        alice.put(f"{API}/exercises/{ex}/setting", json={"bar_weight_kg": 500}).status_code == 422
    )
