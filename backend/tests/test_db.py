import sqlite3

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, select

from app.config import Settings
from app.create_admin import create_admin
from app.db import make_engine
from app.main import create_app
from app.models import Equipment, Exercise, MuscleGroup, Plan, User
from app.seed import seed_catalog


def test_pragmas_applied_on_file_db(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 't.db'}")
    with engine.connect() as conn:
        assert conn.execute(text("PRAGMA journal_mode")).scalar() == "wal"
        assert conn.execute(text("PRAGMA foreign_keys")).scalar() == 1
        assert conn.execute(text("PRAGMA busy_timeout")).scalar() == 5000


def test_alembic_migration_matches_models(tmp_path):
    url = f"sqlite:///{tmp_path / 'mig.db'}"
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", url)
    cfg.set_main_option("script_location", "migrations")
    command.upgrade(cfg, "head")
    engine = make_engine(url)
    tables = set(inspect(engine).get_table_names())
    assert set(SQLModel.metadata.tables) <= tables
    idx = {i["name"] for i in inspect(engine).get_indexes("set_log")}
    assert "ix_set_log_user_exercise_completed" in idx
    # keine ausstehenden Modelländerungen gegenüber der Migration
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext

    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), SQLModel.metadata)
    assert diff == []


def test_exercise_fk_restrict(app):
    with Session(app.state.engine) as db:
        user = create_admin(db, "a@example.com", "long-enough-pw")
        ex = Exercise(name="X")
        db.add(ex)
        db.commit()
        from app.models import PlanDay, PlanExercise

        plan = Plan(user_id=user.id, name="P")
        db.add(plan)
        db.commit()
        day = PlanDay(user_id=user.id, plan_id=plan.id, name="D")
        db.add(day)
        db.commit()
        db.add(PlanExercise(user_id=user.id, plan_day_id=day.id, exercise_id=ex.id))
        db.commit()
        with pytest.raises(IntegrityError):
            db.delete(ex)
            db.commit()


def test_seed_is_idempotent_and_maps_german(app):
    with Session(app.state.engine) as db:
        first = seed_catalog(db)
        second = seed_catalog(db)
        assert first["created"] == first["total"] > 40
        assert second["created"] == 0
        assert db.exec(select(MuscleGroup).where(MuscleGroup.name == "Brust")).first()
        assert db.exec(select(Equipment).where(Equipment.name == "Langhantel")).first()
        bench = db.exec(select(Exercise).where(Exercise.name == "Bankdrücken")).one()
        assert bench.owner_user_id is None and bench.load_type == "weight"
        plank = db.exec(select(Exercise).where(Exercise.name == "Plank")).one()
        assert plank.load_type == "time"


def test_create_admin_validates(app):
    with Session(app.state.engine) as db:
        create_admin(db, "Boss@Example.com", "long-enough-pw")
        assert db.exec(select(User)).one().email == "boss@example.com"
        with pytest.raises(ValueError):
            create_admin(db, "boss@example.com", "long-enough-pw")
        with pytest.raises(ValueError):
            create_admin(db, "x@example.com", "short")


def test_sqlite_in_app_uses_wal_pragmas_on_memory():
    app = create_app(Settings(database_url="sqlite://", cookie_secure=False))
    with app.state.engine.connect() as conn:
        assert conn.execute(text("PRAGMA foreign_keys")).scalar() == 1


def test_sqlite3_available():
    assert sqlite3.sqlite_version_info >= (3, 35)
