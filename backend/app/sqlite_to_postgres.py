"""Einmaliger Import einer SQLite-Datenbank nach Postgres.

Aufruf: python -m app.sqlite_to_postgres SQLITE_PFAD
Ziel ist DATABASE_URL (Postgres, Schema muss per `alembic upgrade head` angelegt und leer sein).
"""

import sys

from sqlalchemy import inspect, select, text
from sqlmodel import SQLModel, create_engine

import app.models  # noqa: F401  (registriert alle Tabellen)
from app.config import get_settings
from app.db import make_engine

BATCH = 1000


def copy_database(source_url: str, target_url: str) -> dict[str, int]:
    source = create_engine(source_url, connect_args={"check_same_thread": False})
    target = make_engine(target_url)
    counts: dict[str, int] = {}
    source_schema = {
        t: {c["name"] for c in inspect(source).get_columns(t)}
        for t in inspect(source).get_table_names()
    }
    with source.connect() as src, target.begin() as dst:
        existing = dst.execute(text('SELECT count(*) FROM "user"')).scalar_one()
        if existing:
            raise SystemExit("Zieldatenbank ist nicht leer – Import abgebrochen")
        # Reihenfolge nach Fremdschlüsseln; die Spaltentypen des Modells wandeln Bool/JSON/
        # Zeitstempel beim Lesen aus SQLite und beim Schreiben nach Postgres selbst um.
        for table in SQLModel.metadata.sorted_tables:
            # Quelle kann einen älteren Schemastand haben (z. B. Revision 0005): fehlende Tabellen
            # gelten als leer, fehlende Spalten füllt das Ziel mit seinen Defaults.
            available = source_schema.get(table.name)
            if available is None:
                print(f"Hinweis: {table.name} fehlt in der Quelle (leer übernommen)")
                rows = []
            else:
                cols = [c for c in table.columns if c.name in available]
                rows = [dict(r) for r in src.execute(select(*cols)).mappings()]
            for i in range(0, len(rows), BATCH):
                dst.execute(table.insert(), rows[i : i + BATCH])
            counts[table.name] = len(rows)
            if "id" in table.columns:
                dst.execute(
                    text(
                        f"SELECT setval(pg_get_serial_sequence('\"{table.name}\"', 'id'), "
                        f'COALESCE((SELECT max(id) FROM "{table.name}"), 1), '
                        f'(SELECT max(id) IS NOT NULL FROM "{table.name}"))'
                    )
                )
        for name, expected in counts.items():
            actual = dst.execute(text(f'SELECT count(*) FROM "{name}"')).scalar_one()
            if actual != expected:
                raise SystemExit(f"Zeilenzahl weicht ab bei {name}: {expected} -> {actual}")
    return counts


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Aufruf: python -m app.sqlite_to_postgres SQLITE_PFAD")
    result = copy_database(f"sqlite:///{sys.argv[1]}", get_settings().database_url)
    for table_name, n in result.items():
        print(f"{table_name}: {n}")
    print("Import abgeschlossen.")
