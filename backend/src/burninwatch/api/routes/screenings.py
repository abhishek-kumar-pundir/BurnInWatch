"""Thin HTTP layer - no ML or parsing logic here."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile

from ...config import Settings
from ...schemas.details import ScreeningListResponse, SignalSeriesResponse, WindowDetailResponse
from ...schemas.screening import ErrorResponse, ScreeningResponse, TimelineResponse
from ...services import csv_service
from ...services.screening_service import ScreeningService
from ..deps import get_screening_service, get_settings

router = APIRouter(prefix="/screenings", tags=["screenings"])

_ERRORS = {
    404: {"model": ErrorResponse},
    413: {"model": ErrorResponse},
    415: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
    503: {"model": ErrorResponse},
}


@router.post("/analyze", response_model=ScreeningResponse, status_code=201, responses=_ERRORS)
def analyze(
    file: UploadFile = File(..., description="Burn-in test CSV"),
    device_id: str = Form(...),
    model: str | None = Form(None, description="response_focused (default) | expanded"),
    service: ScreeningService = Depends(get_screening_service),
    settings: Settings = Depends(get_settings),
) -> ScreeningResponse:
    # Sync endpoint on purpose: CPU-bound inference runs in FastAPI's threadpool.
    filename = csv_service.validate_upload_metadata(file.filename, file.content_type)
    raw = csv_service.read_limited(file.file, settings.max_upload_bytes)
    return service.analyze(raw=raw, filename=filename, device_id=device_id, model_name=model)


@router.get("", response_model=ScreeningListResponse)
def list_screenings(service: ScreeningService = Depends(get_screening_service)) -> ScreeningListResponse:
    """Screenings held by the repository (in-memory: since server start). Newest first."""
    return service.list_screenings()


@router.get("/{screening_id}", response_model=ScreeningResponse, responses=_ERRORS)
def get_screening(
    screening_id: str, service: ScreeningService = Depends(get_screening_service)
) -> ScreeningResponse:
    return service.get(screening_id)


@router.get("/{screening_id}/timeline", response_model=TimelineResponse, responses=_ERRORS)
def get_timeline(
    screening_id: str, service: ScreeningService = Depends(get_screening_service)
) -> TimelineResponse:
    return service.timeline(screening_id)


@router.get(
    "/{screening_id}/windows/{window_index}", response_model=WindowDetailResponse, responses=_ERRORS
)
def get_window(
    screening_id: str, window_index: int, service: ScreeningService = Depends(get_screening_service)
) -> WindowDetailResponse:
    return service.window(screening_id, window_index)


@router.get("/{screening_id}/signals/{signal}", response_model=SignalSeriesResponse, responses=_ERRORS)
def get_signal(
    screening_id: str,
    signal: str,
    max_points: int = Query(1500, ge=50, le=5000),
    start: float | None = Query(None, description="timeEpoch lower bound (zoom)"),
    end: float | None = Query(None, description="timeEpoch upper bound (zoom)"),
    service: ScreeningService = Depends(get_screening_service),
) -> SignalSeriesResponse:
    """Measured series for one signal (min/max down-sampled, optionally zoomed) with baseline,
    flagged windows and anomaly episodes."""
    return service.signal(screening_id, signal, max_points, start, end)
