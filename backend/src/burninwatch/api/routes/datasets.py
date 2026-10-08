from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile

from ...config import Settings
from ...schemas.dataset import DatasetValidationResponse
from ...services import csv_service, dataset_service
from ..deps import get_settings

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.post("/validate", response_model=DatasetValidationResponse)
def validate(
    file: UploadFile = File(..., description="Burn-in test CSV"),
    settings: Settings = Depends(get_settings),
) -> DatasetValidationResponse:
    """Check a file with the same rules as analysis, without running any model.

    Problems inside the file are reported as ``valid: false`` with per-check detail;
    only upload-level problems (type, size, empty) raise HTTP errors.
    """
    filename = csv_service.validate_upload_metadata(file.filename, file.content_type)
    raw = csv_service.read_limited(file.file, settings.max_upload_bytes)
    return dataset_service.validate_dataset(raw, filename)
