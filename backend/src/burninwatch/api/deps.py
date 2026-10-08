"""FastAPI dependencies: singletons live on ``app.state`` (set in ``create_app``)."""
from __future__ import annotations

from fastapi import Request

from ..config import Settings
from ..ml.model_registry import ModelRegistry
from ..services.screening_service import ScreeningService


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_registry(request: Request) -> ModelRegistry:
    return request.app.state.registry


def get_screening_service(request: Request) -> ScreeningService:
    return request.app.state.screening_service
