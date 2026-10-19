import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

from app.config import Settings
from app.main import create_app
from app.models import MuscleGroup, User
from app.reset_db import reset_schema
from app.services.auth import hash_password

PASSWORD = "correct-horse-battery"
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://curlhard:curlhard@localhost:5432/curlhard_test"
)


@pytest.fixture(scope="session")
def _schema():
    """Frisches Schema einmal pro Testlauf; die Tests leeren nur die Tabellen."""
    reset_schema(TEST_DATABASE_URL)
    engine = create_engine(TEST_DATABASE_URL)
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def app(_schema):
    tables = ", ".join(f'"{t.name}"' for t in SQLModel.metadata.sorted_tables)
    with _schema.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    settings = Settings(
        database_url=TEST_DATABASE_URL,
        cookie_secure=False,
        rate_limit_per_minute=1000,
        secret_key="test",
    )
    application = create_app(settings)
    yield application
    application.state.engine.dispose()


def _client(app) -> TestClient:
    return TestClient(app, base_url="http://testserver")


@pytest.fixture
def admin(app) -> TestClient:
    with Session(app.state.engine) as db:
        db.add(
            User(
                email="admin@example.com",
                password_hash=hash_password(PASSWORD),
                display_name="Admin",
                role="admin",
            )
        )
        db.commit()
    c = _client(app)
    r = c.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": PASSWORD})
    assert r.status_code == 200, r.text
    return c


@pytest.fixture
def make_user(app, admin):
    def _make(email: str) -> TestClient:
        code = admin.post("/api/v1/admin/invites", json={}).json()["code"]
        c = _client(app)
        r = c.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": PASSWORD,
                "display_name": email.split("@")[0],
                "invite_code": code,
            },
        )
        assert r.status_code == 201, r.text
        return c

    return _make


@pytest.fixture
def alice(make_user) -> TestClient:
    return make_user("alice@example.com")


@pytest.fixture
def bob(make_user) -> TestClient:
    return make_user("bob@example.com")


@pytest.fixture
def db(app):
    with Session(app.state.engine) as session:
        yield session


@pytest.fixture
def catalog(app, admin):
    """Zwei globale Übungen über die Admin-API."""
    with Session(app.state.engine) as session:
        chest = MuscleGroup(name="Brust")
        session.add(chest)
        session.commit()
        session.refresh(chest)
        chest_id = chest.id
    bench = admin.post(
        "/api/v1/exercises",
        json={"name": "Bankdrücken", "is_global": True, "primary_muscle_group_id": chest_id},
    ).json()
    squat = admin.post("/api/v1/exercises", json={"name": "Kniebeuge", "is_global": True}).json()
    return {"bench": bench, "squat": squat, "chest_id": chest_id}
