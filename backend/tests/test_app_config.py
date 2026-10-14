from fastapi.testclient import TestClient

API = "/api/v1"


def cfg(mode: bool, intensity: str = "normal") -> dict:
    return {"kliment_mode": mode, "kliment_intensity": intensity}


def test_default_is_off(alice):
    r = alice.get(f"{API}/app-config")
    assert r.status_code == 200
    assert r.json() == cfg(False)


def test_admin_toggles_and_user_sees_it(admin, alice):
    r = admin.put(f"{API}/admin/app-config", json={"kliment_mode": True})
    assert r.status_code == 200
    assert r.json() == cfg(True)
    assert alice.get(f"{API}/app-config").json() == cfg(True)
    assert admin.get(f"{API}/app-config").json() == cfg(True)

    admin.put(f"{API}/admin/app-config", json={"kliment_mode": False})
    assert alice.get(f"{API}/app-config").json() == cfg(False)


def test_admin_sets_intensity_without_touching_mode(admin, alice):
    admin.put(f"{API}/admin/app-config", json={"kliment_mode": True})
    r = admin.put(f"{API}/admin/app-config", json={"kliment_intensity": "oft"})
    assert r.status_code == 200
    assert r.json() == cfg(True, "oft")
    assert alice.get(f"{API}/app-config").json() == cfg(True, "oft")


def test_non_admin_cannot_update(admin, alice):
    r = alice.put(f"{API}/admin/app-config", json={"kliment_mode": True})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "forbidden"
    assert admin.get(f"{API}/app-config").json() == cfg(False)


def test_invalid_intensity_rejected(admin):
    r = admin.put(f"{API}/admin/app-config", json={"kliment_intensity": "ständig"})
    assert r.status_code == 422


def test_unauthenticated_is_401(app):
    anon = TestClient(app, base_url="http://testserver")
    assert anon.get(f"{API}/app-config").status_code == 401
    assert anon.put(f"{API}/admin/app-config", json={"kliment_mode": True}).status_code == 401
