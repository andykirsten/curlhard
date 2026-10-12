"""Avatare, Online-Status und Export/Löschen von Avatar und Zyklen."""

from datetime import timedelta

from sqlmodel import select

from app.models import User, UserAvatar, utcnow

API = "/api/v1"
PASSWORD = "correct-horse-battery"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR" + b"\x00" * 16


def _upload(client, data: bytes, content_type: str, name: str = "avatar.png"):
    return client.put(f"{API}/auth/me/avatar", files={"file": (name, data, content_type)})


def test_upload_then_fetch_returns_same_bytes(alice, bob):
    r = _upload(alice, PNG, "image/png")
    assert r.status_code == 200
    me = alice.get(f"{API}/auth/me").json()
    assert me["avatar_url"].startswith(f"{API}/users/{me['id']}/avatar?v=")
    assert r.json()["avatar_url"] == me["avatar_url"]

    got = alice.get(me["avatar_url"])
    assert got.status_code == 200
    assert got.content == PNG
    assert got.headers["content-type"] == "image/png"
    assert got.headers["cache-control"] == "private, max-age=86400"
    assert got.headers["x-content-type-options"] == "nosniff"

    # andere eingeloggte Nutzer dürfen Avatare sehen
    assert bob.get(f"{API}/users/{me['id']}/avatar").content == PNG


def test_jpeg_and_webp_are_accepted_and_replace_previous(alice):
    _upload(alice, PNG, "image/png")
    jpeg = b"\xff\xd8\xff\xe0" + b"\x00" * 32
    assert _upload(alice, jpeg, "image/jpeg", "a.jpg").status_code == 200
    me = alice.get(f"{API}/auth/me").json()
    assert alice.get(f"{API}/users/{me['id']}/avatar").headers["content-type"] == "image/jpeg"

    webp = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"VP8 " + b"\x00" * 16
    assert _upload(alice, webp, "image/webp", "a.webp").status_code == 200
    assert alice.get(f"{API}/users/{me['id']}/avatar").headers["content-type"] == "image/webp"


def test_too_large_and_non_images_are_rejected(alice):
    too_big = b"\xff\xd8\xff" + b"\x00" * (512 * 1024)
    r = _upload(alice, too_big, "image/jpeg", "big.jpg")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "image_too_large"

    r = _upload(alice, b"<html>nope</html>", "text/html", "x.html")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_image"
    assert alice.get(f"{API}/auth/me").json()["avatar_url"] is None


def test_delete_avatar(alice):
    _upload(alice, PNG, "image/png")
    me = alice.get(f"{API}/auth/me").json()
    assert alice.delete(f"{API}/auth/me/avatar").status_code == 204
    assert alice.get(f"{API}/auth/me").json()["avatar_url"] is None
    assert alice.get(f"{API}/users/{me['id']}/avatar").status_code == 404


def test_export_flags_avatar_without_bytes_and_delete_removes_it(alice, db):
    _upload(alice, PNG, "image/png")
    alice.post(f"{API}/cycles", json={"name": "Kraft", "start_date": "2026-10-01"})
    export = alice.get(f"{API}/account/export").json()
    assert export["has_avatar"] is True
    assert "avatar" not in export  # nur das Flag, keine Bytes
    assert [c["name"] for c in export["training_cycles"]] == ["Kraft"]
    assert export["training_cycles"][0]["start_date"] == "2026-10-01"

    assert alice.post(f"{API}/account/delete", json={"password": PASSWORD}).status_code == 204
    assert db.exec(select(UserAvatar)).all() == []


def _online_by_name(client) -> dict[str, dict]:
    return {u["display_name"]: u for u in client.get(f"{API}/users/online").json()}


def test_online_list_excludes_self_and_marks_training(alice, bob):
    bob.get(f"{API}/auth/me")
    alice.get(f"{API}/auth/me")
    online = _online_by_name(alice)
    assert "alice" not in online  # der Anfragende steht nicht in der Liste
    assert online["bob"]["is_training"] is False and online["bob"]["avatar_url"] is None

    session = bob.post(f"{API}/sessions", json={}).json()
    assert _online_by_name(alice)["bob"]["is_training"] is True

    bob.post(f"{API}/sessions/{session['id']}/finish")
    assert _online_by_name(alice)["bob"]["is_training"] is False


def test_users_outside_five_minutes_drop_out(alice, bob, db):
    bob.get(f"{API}/auth/me")
    alice.get(f"{API}/auth/me")
    assert "bob" in _online_by_name(alice)

    user = db.exec(select(User).where(User.email == "bob@example.com")).one()
    user.last_seen_at = utcnow() - timedelta(minutes=6)
    db.add(user)
    db.commit()
    assert "bob" not in _online_by_name(alice)


def test_online_list_shows_avatar_url(alice, bob):
    _upload(bob, PNG, "image/png")
    bob.get(f"{API}/auth/me")
    alice.get(f"{API}/auth/me")
    bob_entry = _online_by_name(alice)["bob"]
    assert bob_entry["avatar_url"].startswith(f"{API}/users/{bob_entry['id']}/avatar?v=")


def test_avatar_of_deactivated_user_is_404(alice, bob, db):
    _upload(alice, PNG, "image/png")
    uid = alice.get(f"{API}/auth/me").json()["id"]
    assert bob.get(f"{API}/users/{uid}/avatar").status_code == 200

    user = db.exec(select(User).where(User.id == uid)).one()
    user.is_active = False
    db.add(user)
    db.commit()
    assert bob.get(f"{API}/users/{uid}/avatar").status_code == 404


def test_oversized_avatar_request_is_rejected_before_upload(alice):
    body = b"x" * (1024 * 1024 + 1)
    r = alice.put(
        f"{API}/auth/me/avatar",
        content=body,
        headers={"content-type": "multipart/form-data; boundary=xyz"},
    )
    assert r.status_code == 413
    assert r.json()["error"] == {
        "code": "payload_too_large",
        "message": "Anfrage zu groß",
        "details": {},
    }
