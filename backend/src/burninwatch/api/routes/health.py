from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from ... import __version__
from ...config import Settings
from ...ml.model_registry import MODEL_SPECS, ModelRegistry
from ...schemas.screening import HealthResponse
from ..deps import get_registry, get_settings

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(
    settings: Settings = Depends(get_settings), registry: ModelRegistry = Depends(get_registry)
) -> HealthResponse:
    """Liveness + artifact presence. Does not load models."""
    models = {n: not registry.missing_artifacts(s) for n, s in MODEL_SPECS.items()}
    return HealthResponse(
        status="ok" if all(models.values()) else "degraded",
        app=settings.app_name,
        version=__version__,
        time=datetime.now(timezone.utc),
        models=models,
    )
