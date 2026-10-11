from datetime import timedelta

from fastapi.testclient import TestClient
from sqlmodel import select

from app.models import AuthSession, InviteCode, User, utcnow
from tests.conftest import PASSWORD

API = "/api/v1"


def _register(app, code, email="new@example.com", password=PASSWORD):
    c = TestClient(app, base_url="http://testserver")
    r = c.post(
        f"{API}/auth/register",
        json={"email": email, "password": password, "display_name": "N", "invite_code": code},
    )
    return c, r


def test_register_requires_valid_invite(app, admin):
    _, r = _register(app, "falsch")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "invalid_invite"


def test_register_login_me_logout(app, admin):
    code = admin.post(f"{API}/admin/invites", json={}).json()["code"]
    c, r = _register(app, code)
    assert r.status_code == 201
    assert "password" not in r.text
    me = c.get(f"{API}/auth/me")
    assert me.status_code == 200 and me.json()["email"] == "new@example.com"
    assert me.json()["role"] == "user"
    assert c.post(f"{API}/auth/logout").status_code == 204
    assert c.get(f"{API}/auth/me").status_code == 401


def test_invite_is_single_use_and_only_hash_stored(app, admin, db):
    code = admin.post(f"{API}/admin/invites", json={}).json()["code"]
    _, r1 = _register(app, code, "a1@example.com")
    _, r2 = _register(app, code, "a2@example.com")
    assert r1.status_code == 201
    assert r2.status_code == 400
    stored = db.exec(select(InviteCode)).all()
    assert all(i.code_hash != code for i in stored)


def test_expired_invite_rejected(app, admin, db):
    code = admin.post(f"{API}/admin/invites", json={}).json()["code"]
    inv = db.exec(select(InviteCode)).first()
    inv.expires_at = utcnow() - timedelta(days=1)
    db.add(inv)
    db.commit()
    _, r = _register(app, code)
    assert r.status_code == 400


def test_failed_registration_does_not_burn_invite(app, admin):
    code = admin.post(f"{API}/admin/invites", json={}).json()["code"]
    _, bad = _register(app, code, password="kurz")
    assert bad.status_code == 422
    _, ok = _register(app, code)
    assert ok.status_code == 201


def test_duplicate_email_conflict_keeps_invite(app, admin):
    c1 = admin.post(f"{API}/admin/invites", json={}).json()["code"]
    c2 = admin.post(f"{API}/admin/invites", json={}).json()["code"]
    _register(app, c1)
    _, dup = _register(app, c2)
    assert dup.status_code == 409
    _, ok = _register(app, c2, "other@example.com")
    assert ok.status_code == 201


def test_password_min_length_10(app, admin):
    code = admin.post(f"{API}/admin/invites", json={}).json()["code"]
    _, r = _register(app, code, password="123456789")
    assert r.status_code == 422


def test_login_wrong_password(app, admin):
    c = TestClient(app, base_url="http://testserver")
    r = c.post(
        f"{API}/auth/login", json={"email": "admin@example.com", "password": "nope-nope-nope"}
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


def test_session_cookie_flags(app, admin):
    c = TestClient(app, base_url="http://testserver")
    r = c.post(f"{API}/auth/login", json={"email": "admin@example.com", "password": PASSWORD})
    header = r.headers["set-cookie"].lower()
    assert "httponly" in header and "samesite=lax" in header


def test_session_token_stored_hashed(app, admin, db):
    token = admin.cookies.get("curlhard_session")
    rows = db.exec(select(AuthSession)).all()
    assert rows and all(r.token_hash != token for r in rows)


def test_change_password_invalidates_other_sessions(app, admin):
    other = TestClient(app, base_url="http://testserver")
    other.post(f"{API}/auth/login", json={"email": "admin@example.com", "password": PASSWORD})
    r = admin.post(
        f"{API}/auth/change-password",
        json={"current_password": PASSWORD, "new_password": "another-long-password"},
    )
    assert r.status_code == 204
    assert other.get(f"{API}/auth/me").status_code == 401
    assert admin.get(f"{API}/auth/me").status_code == 200
    c = TestClient(app, base_url="http://testserver")
    ok = c.post(
        f"{API}/auth/login",
        json={"email": "admin@example.com", "password": "another-long-password"},
    )
    assert ok.status_code == 200


def test_change_password_requires_current(admin):
    r = admin.post(
        f"{API}/auth/change-password",
        json={"current_password": "wrong-wrong-wrong", "new_password": "another-long-password"},
    )
    assert r.status_code == 400


def test_expired_session_rejected(app, admin, db):
    row = db.exec(select(AuthSession)).first()
    row.expires_at = utcnow() - timedelta(minutes=1)
    db.add(row)
    db.commit()
    assert admin.get(f"{API}/auth/me").status_code == 401


def test_sliding_session_extended(app, admin, db):
    row = db.exec(select(AuthSession)).first()
    row.expires_at = utcnow() + timedelta(days=5)
    db.add(row)
    db.commit()
    assert admin.get(f"{API}/auth/me").status_code == 200
    db.refresh(row)
    assert row.expires_at > utcnow() + timedelta(days=29)


def test_inactive_user_rejected(app, alice, db):
    user = db.exec(select(User).where(User.email == "alice@example.com")).one()
    user.is_active = False
    db.add(user)
    db.commit()
    assert alice.get(f"{API}/auth/me").status_code == 401


def test_admin_endpoints_forbidden_for_user(alice):
    assert alice.get(f"{API}/admin/invites").status_code == 403
    assert alice.post(f"{API}/admin/invites", json={}).status_code == 403


def test_invite_list_and_delete(admin):
    created = admin.post(f"{API}/admin/invites", json={"expires_in_days": 3}).json()
    assert "code" in created
    lst = admin.get(f"{API}/admin/invites").json()
    assert len(lst) == 1 and "code" not in lst[0]
    assert admin.delete(f"{API}/admin/invites/{created['id']}").status_code == 204
    assert admin.get(f"{API}/admin/invites").json() == []


def test_origin_check_blocks_foreign_origin(admin):
    r = admin.post(f"{API}/auth/logout", headers={"Origin": "https://evil.example"})
    assert r.status_code == 403
    ok = admin.post(f"{API}/admin/invites", json={}, headers={"Origin": "http://testserver"})
    assert ok.status_code == 201


def test_rate_limit_on_login(app):
    app.state.limiter.limit = 3
    app.state.limiter.reset()
    c = TestClient(app, base_url="http://testserver")
    codes = [
        c.post(
            f"{API}/auth/login", json={"email": "x@example.com", "password": "nope-nope-nope"}
        ).status_code
        for _ in range(5)
    ]
    assert codes[:3] == [401, 401, 401]
    assert codes[3:] == [429, 429]


def test_update_profile(alice):
    r = alice.patch(f"{API}/auth/me", json={"display_name": "Ali", "body_weight_kg": 82.5})
    assert r.status_code == 200
    assert r.json()["body_weight_kg"] == 82.5


def test_health(app):
    c = TestClient(app)
    assert c.get("/api/health").json() == {"status": "ok"}


def test_openapi_path(app):
    assert TestClient(app).get("/api/openapi.json").status_code == 200


def test_unauthenticated_me(app):
    assert TestClient(app).get(f"{API}/auth/me").status_code == 401


def test_error_format_validation(app):
    r = TestClient(app).post(f"{API}/auth/login", json={})
    body = r.json()
    assert r.status_code == 422 and body["error"]["code"] == "validation_error"
    assert "details" in body["error"]
