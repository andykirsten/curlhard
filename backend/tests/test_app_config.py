from fastapi.testclient import TestClient

API = "/api/v1"


def test_default_is_off(alice):
    r = alice.get(f"{API}/app-config")
    assert r.status_code == 200
    assert r.json() == {"kliment_mode": False}


def test_admin_toggles_and_user_sees_it(admin, alice):
    r = admin.put(f"{API}/admin/app-config", json={"kliment_mode": True})
    assert r.status_code == 200
    assert r.json() == {"kliment_mode": True}
    assert alice.get(f"{API}/app-config").json() == {"kliment_mode": True}
    assert admin.get(f"{API}/app-config").json() == {"kliment_mode": True}

    admin.put(f"{API}/admin/app-config", json={"kliment_mode": False})
    assert alice.get(f"{API}/app-config").json() == {"kliment_mode": False}


def test_non_admin_cannot_update(admin, alice):
    r = alice.put(f"{API}/admin/app-config", json={"kliment_mode": True})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "forbidden"
    assert admin.get(f"{API}/app-config").json() == {"kliment_mode": False}


def test_invalid_body_rejected(admin):
    r = admin.put(f"{API}/admin/app-config", json={})
    assert r.status_code == 422


def test_unauthenticated_is_401(app):
    anon = TestClient(app, base_url="http://testserver")
    assert anon.get(f"{API}/app-config").status_code == 401
    assert anon.put(f"{API}/admin/app-config", json={"kliment_mode": True}).status_code == 401
