from __future__ import annotations

from fastapi import APIRouter, Depends

from ...config import PIPELINE
from ...ml.model_registry import MODEL_SPECS, ModelRegistry
from ...schemas.screening import ModelDescriptor, ModelListResponse, Thresholds
from ..deps import get_registry

router = APIRouter(tags=["models"])


@router.get("/models", response_model=ModelListResponse)
def list_models(registry: ModelRegistry = Depends(get_registry)) -> ModelListResponse:
    """Known model configurations. Never triggers artifact loading."""
    out = []
    for name, spec in MODEL_SPECS.items():
        missing = registry.missing_artifacts(spec)
        loaded = registry.is_loaded(name)
        thresholds = None
        if loaded:
            b = registry.get(name)
            thresholds = Thresholds(isolation_forest=b.if_threshold, autoencoder=b.ae_threshold)
        out.append(
            ModelDescriptor(
                name=name,
                version=spec.version,
                description=spec.description,
                is_default=name == registry.default_name,
                feature_count=spec.feature_count,
                features=list(spec.features),
                window_size=PIPELINE.window_size,
                stride=PIPELINE.stride,
                artifacts_available=not missing,
                missing_artifacts=missing,
                loaded=loaded,
                thresholds=thresholds,
            )
        )
    return ModelListResponse(default_model=registry.default_name, models=out)
