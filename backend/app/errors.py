import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm.exc import StaleDataError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("curlhard")

CONFLICT_MESSAGE = "Konflikt mit einer gleichzeitigen Änderung – bitte erneut versuchen"
BUSY_MESSAGE = "Datenbank ausgelastet – bitte erneut versuchen"
INTERNAL_MESSAGE = "Interner Fehler"


class ApiError(Exception):
    def __init__(
        self, status_code: int, code: str, message: str, details: dict[str, Any] | None = None
    ):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}


def not_found(what: str = "Ressource") -> ApiError:
    return ApiError(404, "not_found", f"{what} nicht gefunden")


def _body(code: str, message: str, details: dict[str, Any] | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or {}}}


_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    429: "rate_limited",
}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError):
        return JSONResponse(_body(exc.code, exc.message, exc.details), status_code=exc.status_code)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        code = _CODES.get(exc.status_code, "error")
        return JSONResponse(_body(code, str(exc.detail)), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        errors = [{"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in exc.errors()]
        return JSONResponse(
            _body("validation_error", "Ungültige Eingabe", {"errors": errors}),
            status_code=422,
        )

    @app.exception_handler(IntegrityError)
    async def _integrity_error(request: Request, exc: IntegrityError):
        logger.exception("Integritätsfehler bei %s %s", request.method, request.url.path)
        return JSONResponse(_body("conflict", CONFLICT_MESSAGE), status_code=409)

    @app.exception_handler(StaleDataError)
    async def _stale_data(request: Request, exc: StaleDataError):
        logger.exception("Veraltete Daten bei %s %s", request.method, request.url.path)
        return JSONResponse(_body("conflict", CONFLICT_MESSAGE), status_code=409)

    @app.exception_handler(OperationalError)
    async def _operational_error(request: Request, exc: OperationalError):
        logger.exception("Datenbankfehler bei %s %s", request.method, request.url.path)
        # 40001 = serialization_failure, 40P01 = deadlock_detected, 55P03 = lock_not_available
        sqlstate = getattr(exc.orig, "sqlstate", None)
        if sqlstate in ("40001", "40P01", "55P03"):
            return JSONResponse(_body("db_busy", BUSY_MESSAGE), status_code=503)
        return JSONResponse(_body("internal_error", INTERNAL_MESSAGE), status_code=500)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        logger.exception("Unerwarteter Fehler bei %s %s", request.method, request.url.path)
        return JSONResponse(_body("internal_error", INTERNAL_MESSAGE), status_code=500)
