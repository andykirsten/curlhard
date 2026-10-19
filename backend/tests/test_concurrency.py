"""Parallele Schreibzugriffe gegen Postgres (Advisory-Lock pro Nutzer in deps.current_user).

Ohne die Schreibsperre pro Request würden Lesen-dann-Schreiben-Muster (max()+1,
Existenzprüfung) doppelte Werte oder 500er erzeugen. Alle Antworten müssen < 500 sein.
"""

from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, func, select

from app.models import ExerciseNote, ExerciseSetting, SetLog, User, UserAvatar
from app.services.auth import hash_password

API = "/api/v1"
PASSWORD = "correct-horse-battery"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR" + b"\x00" * 16
WORKERS = 16


def _client(app) -> TestClient:
    return TestClient(app, base_url="http://testserver")


@pytest.fixture
def alice(app):
    with Session(app.state.engine) as db:
        admin = User(
            email="admin@example.com",
            password_hash=hash_password(PASSWORD),
            display_name="Admin",
            role="admin",
        )
        db.add(admin)
        db.commit()
    admin_client = _client(app)
    r = admin_client.post(
        f"{API}/auth/login", json={"email": "admin@example.com", "password": PASSWORD}
    )
    assert r.status_code == 200, r.text
    code = admin_client.post(f"{API}/admin/invites", json={}).json()["code"]
    client = _client(app)
    r = client.post(
        f"{API}/auth/register",
        json={
            "email": "alice@example.com",
            "password": PASSWORD,
            "display_name": "alice",
            "invite_code": code,
        },
    )
    assert r.status_code == 201, r.text
    return client


@pytest.fixture
def bench(alice):
    r = alice.post(f"{API}/exercises", json={"name": "Bankdrücken"})
    assert r.status_code == 201, r.text
    return r.json()


def _run(n: int, fn) -> list:
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        return list(pool.map(fn, range(n)))


def _statuses(responses) -> list[int]:
    return [r.status_code for r in responses]


def _scalar(app, stmt):
    with Session(app.state.engine) as db:
        return db.exec(stmt).all()


def test_parallel_add_set_gives_unique_consecutive_numbers(app, alice, bench):
    session_id = alice.post(f"{API}/sessions", json={}).json()["id"]
    se_id = alice.post(
        f"{API}/sessions/{session_id}/exercises", json={"exercise_id": bench["id"]}
    ).json()["id"]

    responses = _run(
        30,
        lambda i: alice.post(
            f"{API}/session-exercises/{se_id}/sets", json={"reps": 8, "weight_kg": 50 + i}
        ),
    )
    assert all(s < 500 for s in _statuses(responses)), _statuses(responses)
    assert _statuses(responses) == [201] * 30

    numbers = sorted(
        _scalar(app, select(SetLog.set_number).where(SetLog.session_exercise_id == se_id))
    )
    assert numbers == list(range(1, 31))


def test_parallel_first_note_creates_exactly_one_row(app, alice, bench):
    responses = _run(
        10,
        lambda i: alice.put(f"{API}/exercises/{bench['id']}/note", json={"note": f"Notiz {i}"}),
    )
    assert _statuses(responses) == [200] * 10
    count = _scalar(
        app,
        select(func.count())
        .select_from(ExerciseNote)
        .where(ExerciseNote.exercise_id == bench["id"]),
    )
    assert count == [1]


def test_parallel_first_setting_creates_exactly_one_row(app, alice, bench):
    responses = _run(
        10,
        lambda i: alice.put(
            f"{API}/exercises/{bench['id']}/setting", json={"bar_weight_kg": 10 + i}
        ),
    )
    assert _statuses(responses) == [200] * 10
    count = _scalar(
        app,
        select(func.count())
        .select_from(ExerciseSetting)
        .where(ExerciseSetting.exercise_id == bench["id"]),
    )
    assert count == [1]


def test_parallel_avatar_uploads_keep_one_row(app, alice):
    responses = _run(
        10,
        lambda i: alice.put(
            f"{API}/auth/me/avatar", files={"file": (f"a{i}.png", PNG, "image/png")}
        ),
    )
    assert _statuses(responses) == [200] * 10
    count = _scalar(app, select(func.count()).select_from(UserAvatar))
    assert count == [1]


def test_parallel_create_day_gives_unique_positions(alice, app):
    plan_id = alice.post(f"{API}/plans", json={"name": "Parallel"}).json()["id"]
    responses = _run(
        10,
        lambda i: alice.post(f"{API}/plans/{plan_id}/days", json={"name": f"Tag {i}"}),
    )
    assert _statuses(responses) == [201] * 10
    positions = [r.json()["position"] for r in responses]
    assert len(set(positions)) == 10


def test_parallel_activate_keeps_single_active_cycle(alice):
    ids = [
        alice.post(
            f"{API}/cycles",
            json={"name": f"Zyklus {n}", "start_date": "2026-10-01", "activate": False},
        ).json()["id"]
        for n in range(2)
    ]
    responses = _run(
        20,
        lambda i: alice.post(f"{API}/cycles/{ids[i % 2]}/activate"),
    )
    assert all(s < 500 for s in _statuses(responses)), _statuses(responses)
    cycles = alice.get(f"{API}/cycles").json()
    assert sum(1 for c in cycles if c["is_active"]) == 1
