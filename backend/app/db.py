from sqlalchemy.engine import Engine
from sqlmodel import create_engine


def make_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        # Nur noch für den Altdaten-Import (app.sqlite_to_postgres), schreibend nicht vorgesehen
        return create_engine(url, connect_args={"check_same_thread": False})
    return create_engine(url, pool_pre_ping=True)
