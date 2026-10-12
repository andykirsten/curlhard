"""Fehler-Envelope für Datenbankfehler und unerwartete Ausnahmen."""

from fastapi import APIRouter
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm.exc import StaleDataError

from app.errors import BUSY_MESSAGE, CONFLICT_MESSAGE, INTERNAL_MESSAGE


def _app_with_routes(app):
    router = APIRouter()

    @router.get("/_test/integrity")
    def integrity():
        raise IntegrityError("INSERT", {}, Exception("UNIQUE constraint failed"))

    @router.get("/_test/stale")
    def stale():
        raise StaleDataError("UPDATE statement on table expected 1 row(s)")

    @router.get("/_test/locked")
    def locked():
        raise OperationalError("SELECT", {}, Exception("database is locked"))

    @router.get("/_test/other-operational")
    def other_operational():
        raise OperationalError("SELECT", {}, Exception("disk I/O error"))

    @router.get("/_test/crash")
    def crash():
        raise RuntimeError("geheimer Interna")

    app.include_router(router)
    return TestClient(app, base_url="http://testserver", raise_server_exceptions=False)


def test_integrity_error_returns_409_envelope(app):
    r = _app_with_routes(app).get("/_test/integrity")
    assert r.status_code == 409
    assert r.headers["content-type"].startswith("application/json")
    assert r.json() == {"error": {"code": "conflict", "message": CONFLICT_MESSAGE, "details": {}}}


def test_stale_data_returns_409_envelope(app):
    r = _app_with_routes(app).get("/_test/stale")
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "conflict"


def test_locked_database_returns_503_envelope(app):
    r = _app_with_routes(app).get("/_test/locked")
    assert r.status_code == 503
    assert r.json()["error"] == {"code": "db_busy", "message": BUSY_MESSAGE, "details": {}}


def test_other_operational_error_returns_generic_500(app):
    r = _app_with_routes(app).get("/_test/other-operational")
    assert r.status_code == 500
    assert r.json()["error"]["code"] == "internal_error"


def test_unhandled_exception_returns_generic_500_without_details(app):
    r = _app_with_routes(app).get("/_test/crash")
    assert r.status_code == 500
    body = r.json()
    assert body["error"] == {"code": "internal_error", "message": INTERNAL_MESSAGE, "details": {}}
    assert "Interna" not in r.text
