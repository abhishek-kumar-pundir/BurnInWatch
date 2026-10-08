"""Application errors and their HTTP mapping.

Every error is returned to the client in one envelope::

    {"error": {"code": "MISSING_COLUMNS", "message": "...", "details": {...}}}
"""
from __future__ import annotations

from typing import Any


class BurnInWatchError(Exception):
    status_code: int = 400
    code: str = "BAD_REQUEST"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        status_code: int | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code
        self.details = details or {}


class UploadError(BurnInWatchError):
    status_code = 400
    code = "INVALID_UPLOAD"


class UnsupportedFileTypeError(UploadError):
    status_code = 415
    code = "UNSUPPORTED_FILE_TYPE"


class UploadTooLargeError(UploadError):
    status_code = 413
    code = "UPLOAD_TOO_LARGE"


class CsvValidationError(BurnInWatchError):
    status_code = 422
    code = "INVALID_CSV"


class MissingColumnsError(CsvValidationError):
    code = "MISSING_COLUMNS"


class InsufficientDataError(CsvValidationError):
    code = "INSUFFICIENT_DATA"


class UnknownModelError(BurnInWatchError):
    status_code = 422
    code = "UNKNOWN_MODEL"


class ModelArtifactError(BurnInWatchError):
    """Model artifacts are missing or not in a loadable / consistent format."""

    status_code = 503
    code = "MODEL_UNAVAILABLE"


class ScreeningNotFoundError(BurnInWatchError):
    status_code = 404
    code = "SCREENING_NOT_FOUND"


class WindowNotFoundError(BurnInWatchError):
    status_code = 404
    code = "WINDOW_NOT_FOUND"


class UnknownSignalError(BurnInWatchError):
    status_code = 422
    code = "UNKNOWN_SIGNAL"


class DetailUnavailableError(BurnInWatchError):
    """Drill-down data was evicted (in-memory store is bounded) or never stored."""

    status_code = 404
    code = "DETAIL_UNAVAILABLE"
