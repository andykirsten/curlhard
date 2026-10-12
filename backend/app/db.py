from sqlalchemy import event
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.pool import StaticPool
from sqlmodel import create_engine


def _set_pragmas(dbapi_connection, _record) -> None:
    # pysqlite-Transaktionssteuerung abschalten: BEGIN setzt SQLAlchemy selbst (siehe _begin)
    dbapi_connection.isolation_level = None
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()


def _begin(conn: Connection) -> None:
    # Schreibende Requests reservieren die Schreibsperre sofort (BEGIN IMMEDIATE), damit
    # Lesen-dann-Schreiben (max()+1, Existenzprüfung) atomar ist. Lesende nutzen BEGIN.
    if conn.get_execution_options().get("sqlite_immediate"):
        conn.exec_driver_sql("BEGIN IMMEDIATE")
    else:
        conn.exec_driver_sql("BEGIN")


def _begin_shared(conn: Connection) -> None:
    # Nur In-Memory-Testdatenbank: alle Sessions teilen sich eine Verbindung (StaticPool),
    # dort kann die Transaktion einer anderen Session noch offen sein -> kein zweites BEGIN.
    if conn.connection.driver_connection.in_transaction:
        return
    _begin(conn)


def make_engine(url: str) -> Engine:
    kwargs: dict = {"connect_args": {"check_same_thread": False}}
    in_memory = url in ("sqlite://", "sqlite:///:memory:")
    if in_memory:
        kwargs["poolclass"] = StaticPool
    engine = create_engine(url, **kwargs)
    if url.startswith("sqlite"):
        event.listen(engine, "connect", _set_pragmas)
        event.listen(engine, "begin", _begin_shared if in_memory else _begin)
    return engine
