from urllib.parse import urlparse

from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlmodel import Session

from app.config import Settings, get_settings
from app.db import make_engine
from app.errors import install_error_handlers
from app.routers import (
    account,
    admin,
    auth,
    cycles,
    exercises,
    plans,
    public_plans,
    sessions,
    stats,
    users,
)
from app.services.ratelimit import RateLimiter

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
# Avatar-Upload: nginx begrenzt ebenfalls auf 1 MB; hier vor dem Einlesen des Bodys abweisen
AVATAR_PATH = "/api/v1/auth/me/avatar"
MAX_AVATAR_REQUEST_BYTES = 1024 * 1024


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(
        title="Curlhard API",
        openapi_url="/api/openapi.json",
        docs_url="/api/docs",
        redoc_url=None,
        generate_unique_id_function=lambda route: route.name,
    )
    app.state.settings = settings
    app.state.engine = make_engine(settings.database_url)
    app.state.limiter = RateLimiter(settings.rate_limit_per_minute)
    install_error_handlers(app)

    @app.middleware("http")
    async def origin_check(request: Request, call_next):
        if request.method in WRITE_METHODS:
            origin = request.headers.get("origin")
            if origin:
                host = request.headers.get("host", "")
                allowed = set(settings.allowed_origins)
                if urlparse(origin).netloc != host and origin not in allowed:
                    return JSONResponse(
                        {
                            "error": {
                                "code": "forbidden",
                                "message": "Origin nicht erlaubt",
                                "details": {},
                            }
                        },
                        status_code=403,
                    )
        return await call_next(request)

    @app.middleware("http")
    async def avatar_size_limit(request: Request, call_next):
        if request.url.path == AVATAR_PATH:
            try:
                length = int(request.headers.get("content-length", "0"))
            except ValueError:
                length = 0
            if length > MAX_AVATAR_REQUEST_BYTES:
                return JSONResponse(
                    {
                        "error": {
                            "code": "payload_too_large",
                            "message": "Anfrage zu groß",
                            "details": {},
                        }
                    },
                    status_code=413,
                )
        return await call_next(request)

    v1 = APIRouter(prefix="/api/v1")
    for module in (
        auth,
        admin,
        exercises,
        plans,
        public_plans,
        cycles,
        users,
        sessions,
        stats,
        account,
    ):
        v1.include_router(module.router)
    app.include_router(v1)

    @app.get("/api/health", tags=["health"])
    def health():
        with Session(app.state.engine) as db:
            db.execute(text("SELECT 1"))
        return {"status": "ok"}

    return app


app = create_app()
