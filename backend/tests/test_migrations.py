import sqlite3
from pathlib import Path

from alembic import command
from alembic.config import Config

BACKEND_DIR = Path(__file__).resolve().parent.parent

COUNT_TABLES = ("user", "plan", "exercise", "workout_session", "session_exercise", "set_log")
TS = "2026-10-01 10:00:00"


def _alembic_config(url: str) -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    return cfg


def _counts(path: Path) -> dict[str, int]:
    con = sqlite3.connect(path)
    try:
        return {t: con.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0] for t in COUNT_TABLES}
    finally:
        con.close()


def test_0002_keeps_workout_data(tmp_path):
    db_path = tmp_path / "migrate.db"
    url = f"sqlite:///{db_path}"
    cfg = _alembic_config(url)

    command.upgrade(cfg, "0001")

    con = sqlite3.connect(db_path)
    con.execute("PRAGMA foreign_keys=ON")
    con.execute(
        'INSERT INTO "user" (id, created_at, updated_at, email, password_hash, display_name,'
        " role, is_active) VALUES (1, ?, ?, 'a@example.com', 'x', 'Alice', 'user', 1)",
        (TS, TS),
    )
    con.execute(
        "INSERT INTO plan (id, created_at, updated_at, user_id, name, description, is_active)"
        " VALUES (1, ?, ?, 1, 'Plan', '', 1)",
        (TS, TS),
    )
    con.execute(
        "INSERT INTO plan_day (id, created_at, updated_at, user_id, plan_id, name, weekday,"
        " position) VALUES (1, ?, ?, 1, 1, 'Tag A', 0, 0)",
        (TS, TS),
    )
    con.execute(
        "INSERT INTO exercise (id, created_at, updated_at, name, description, owner_user_id,"
        " load_type, is_active) VALUES (1, ?, ?, 'Kniebeuge', '', NULL, 'weight', 1)",
        (TS, TS),
    )
    con.execute(
        "INSERT INTO workout_session (id, created_at, updated_at, user_id, plan_day_id,"
        " started_at, note) VALUES (1, ?, ?, 1, 1, ?, '')",
        (TS, TS, TS),
    )
    con.execute(
        "INSERT INTO session_exercise (id, created_at, updated_at, user_id, session_id,"
        " exercise_id, position, note) VALUES (1, ?, ?, 1, 1, 1, 0, '')",
        (TS, TS),
    )
    con.execute(
        "INSERT INTO set_log (id, created_at, updated_at, user_id, exercise_id,"
        " session_exercise_id, set_number, reps, weight_kg, is_warmup, completed_at)"
        " VALUES (1, ?, ?, 1, 1, 1, 1, 8, 25.0, 0, ?)",
        (TS, TS, TS),
    )
    con.commit()
    con.close()

    before = _counts(db_path)
    assert before == {t: 1 for t in COUNT_TABLES}

    command.upgrade(cfg, "head")

    assert _counts(db_path) == before

    con = sqlite3.connect(db_path)
    try:
        assert con.execute("PRAGMA foreign_key_check").fetchall() == []
    finally:
        con.close()
