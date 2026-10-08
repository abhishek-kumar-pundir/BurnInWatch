from __future__ import annotations

from fastapi import APIRouter

from .routes import datasets, evaluation, health, models, screenings

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(models.router)
api_router.include_router(datasets.router)
api_router.include_router(evaluation.router)
api_router.include_router(screenings.router)
