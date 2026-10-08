"""FastAPI application factory. Run with: uvicorn burninwatch.main:app"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import __version__
from .api.router import api_router
from .config import Settings, get_settings
from .errors import BurnInWatchError
from .ml.model_registry import ModelRegistry
from .services.repository import InMemoryScreeningRepository, ScreeningRepository
from .services.screening_service import ScreeningService

log = logging.getLogger("burninwatch")


def _error(status: int, code: str, message: str, details: dict | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "details": details or {}}},
    )


def create_app(
    settings: Settings | None = None,
    registry: ModelRegistry | None = None,
    repository: ScreeningRepository | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(level=settings.log_level.upper())
    registry = registry or ModelRegistry(settings)
    repository = repository or InMemoryScreeningRepository(settings.repository_max_items)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if settings.preload_models:  # loads saved artifacts only; never trains
            registry.preload()
        yield

    app = FastAPI(title=settings.app_name, version=__version__, lifespan=lifespan)
    app.state.settings = settings
    app.state.registry = registry
    app.state.repository = repository
    app.state.screening_service = ScreeningService(settings, registry, repository)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def limit_body_size(request: Request, call_next):
        declared = request.headers.get("content-length")
        # small allowance for multipart framing + form fields
        if declared and declared.isdigit() and int(declared) > settings.max_upload_bytes + 64 * 1024:
            return _error(
                413,
                "UPLOAD_TOO_LARGE",
                f"Request exceeds the maximum upload size of {settings.max_upload_mb} MB.",
                {"max_bytes": settings.max_upload_bytes},
            )
        return await call_next(request)

    @app.exception_handler(BurnInWatchError)
    async def _app_error(_: Request, exc: BurnInWatchError):
        return _error(exc.status_code, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        errs = [
            {"field": ".".join(str(p) for p in e["loc"] if p != "body"), "message": e["msg"]}
            for e in exc.errors()
        ]
        return _error(422, "REQUEST_VALIDATION_ERROR", "Invalid request.", {"errors": errs})

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        log.exception("Unhandled error")
        return _error(500, "INTERNAL_ERROR", "Unexpected server error.")

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
