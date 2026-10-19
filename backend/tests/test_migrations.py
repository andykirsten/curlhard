from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlmodel import create_engine

from app.reset_db import reset_schema

from .conftest import TEST_DATABASE_URL

BACKEND_DIR = Path(__file__).resolve().parent.parent

COUNT_TABLES = ("user", "plan", "exercise", "workout_session", "session_exercise", "set_log")
TS = "2026-10-01 10:00:00+00"


def _alembic_config(url: str) -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    return cfg


def _counts(conn) -> dict[str, int]:
    return {t: conn.execute(text(f'SELECT count(*) FROM "{t}"')).scalar_one() for t in COUNT_TABLES}


def test_migrations_keep_workout_data():
    url = TEST_DATABASE_URL + "_mig"
    reset_schema(url)
    cfg = _alembic_config(url)

    command.upgrade(cfg, "0001")

    engine = create_engine(url)
    with engine.begin() as conn:
        params = {"ts": TS}
        for stmt in (
            'INSERT INTO "user" (id, created_at, updated_at, email, password_hash, display_name,'
            " role, is_active) VALUES (1, :ts, :ts, 'a@example.com', 'x', 'Alice', 'user', true)",
            "INSERT INTO plan (id, created_at, updated_at, user_id, name, description, is_active)"
            " VALUES (1, :ts, :ts, 1, 'Plan', '', true)",
            "INSERT INTO plan_day (id, created_at, updated_at, user_id, plan_id, name, weekday,"
            " position) VALUES (1, :ts, :ts, 1, 1, 'Tag A', 0, 0)",
            "INSERT INTO exercise (id, created_at, updated_at, name, description, owner_user_id,"
            " load_type, is_active) VALUES (1, :ts, :ts, 'Kniebeuge', '', NULL, 'weight', true)",
            "INSERT INTO workout_session (id, created_at, updated_at, user_id, plan_day_id,"
            " started_at, note) VALUES (1, :ts, :ts, 1, 1, :ts, '')",
            "INSERT INTO session_exercise (id, created_at, updated_at, user_id, session_id,"
            " exercise_id, position, note) VALUES (1, :ts, :ts, 1, 1, 1, 0, '')",
            "INSERT INTO set_log (id, created_at, updated_at, user_id, exercise_id,"
            " session_exercise_id, set_number, reps, weight_kg, is_warmup, completed_at)"
            " VALUES (1, :ts, :ts, 1, 1, 1, 1, 8, 25.0, false, :ts)",
        ):
            conn.execute(text(stmt), params)
        before = _counts(conn)
    assert before == {t: 1 for t in COUNT_TABLES}

    command.upgrade(cfg, "head")

    with engine.connect() as conn:
        assert _counts(conn) == before
        # 0005: einzelner Wochentag wird zur Liste
        weekdays = conn.execute(text("SELECT weekdays FROM plan_day WHERE id = 1")).scalar_one()
        assert weekdays == [0]

    # Downgrade von 0005 behält den ersten Wochentag
    command.downgrade(cfg, "0004")
    with engine.connect() as conn:
        assert conn.execute(text("SELECT weekday FROM plan_day WHERE id = 1")).scalar_one() == 0
    engine.dispose()
