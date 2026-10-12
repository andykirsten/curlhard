from alembic import context
from sqlmodel import SQLModel

import app.models  # noqa: F401  (registriert alle Tabellen)
from app.config import get_settings
from app.db import make_engine

config = context.config
target_metadata = SQLModel.metadata


def _url() -> str:
    return config.get_main_option("sqlalchemy.url") or get_settings().database_url


def run_migrations_offline() -> None:
    context.configure(
        url=_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = config.attributes.get("connection")
    if connectable is None:
        engine = make_engine(_url())
        with engine.connect() as connection:
            _run(connection)
    else:
        _run(connectable)


def _sqlite_pragma(connection, statement: str) -> None:
    # Direkt über den DBAPI-Cursor: SQLAlchemy startet bei exec_driver_sql sofort eine
    # Transaktion (begin-Event), und PRAGMA foreign_keys ist innerhalb einer Transaktion
    # wirkungslos.
    cursor = connection.connection.cursor()
    try:
        cursor.execute(statement)
    finally:
        cursor.close()


def _run(connection) -> None:
    is_sqlite = connection.dialect.name == "sqlite"
    if is_sqlite:
        # Migration 0002 baut workout_session per batch_alter_table neu (DROP TABLE). Bei
        # aktiven Fremdschlüsseln würde das ON DELETE CASCADE auslösen und alle Trainings-
        # sätze löschen. Deshalb FKs für die Migration aus, danach prüfen und wieder ein.
        _sqlite_pragma(connection, "PRAGMA foreign_keys=OFF")
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=True,
        compare_type=True,
    )
    try:
        with context.begin_transaction():
            context.run_migrations()
            if is_sqlite:
                # innerhalb der Transaktion: bei Verletzungen wird zurückgerollt
                violations = connection.exec_driver_sql("PRAGMA foreign_key_check").fetchall()
                if violations:
                    raise RuntimeError(
                        f"Migration hat Fremdschlüssel-Verletzungen erzeugt: {len(violations)}"
                    )
    finally:
        if is_sqlite:
            _sqlite_pragma(connection, "PRAGMA foreign_keys=ON")


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
