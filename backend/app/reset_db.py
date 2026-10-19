"""Legt eine Postgres-Datenbank bei Bedarf an und setzt ihr Schema zurück (E2E, Tests).

Aufruf: python -m app.reset_db postgresql+psycopg://user:pw@host:5432/dbname
"""

import sys

from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlmodel import create_engine


def ensure_database(url: str) -> None:
    target = make_url(url)
    admin = create_engine(target.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": target.database}
        ).first()
        if exists is None:
            conn.execute(text(f'CREATE DATABASE "{target.database}"'))
    admin.dispose()


def reset_schema(url: str) -> None:
    ensure_database(url)
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    engine.dispose()


if __name__ == "__main__":
    reset_schema(sys.argv[1])
