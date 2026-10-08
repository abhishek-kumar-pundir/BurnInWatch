"""Upload validation and CSV parsing (no ML, no cleaning rules)."""
from __future__ import annotations

import io
from dataclasses import dataclass

import pandas as pd

from ..config import REQUIRED_COLUMNS
from ..errors import (
    CsvValidationError,
    MissingColumnsError,
    UnsupportedFileTypeError,
    UploadError,
    UploadTooLargeError,
)

ALLOWED_EXTENSIONS = (".csv",)
# Browsers (especially on Windows/Excel) report CSV under several MIME types.
ALLOWED_CONTENT_TYPES = {
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "text/plain",
    "application/octet-stream",
}


@dataclass(frozen=True)
class RawCsv:
    filename: str
    frame: pd.DataFrame  # columns normalised to canonical names where matched
    original_columns: tuple[str, ...] = ()


def validate_upload_metadata(filename: str | None, content_type: str | None) -> str:
    """Return a safe display name, or raise. The name is never used as a path."""
    if not filename:
        raise UploadError("No file was uploaded.", code="NO_FILE")
    display = filename.replace("\\", "/").rsplit("/", 1)[-1][:255]
    if not display.lower().endswith(ALLOWED_EXTENSIONS):
        raise UnsupportedFileTypeError(
            "Only .csv files are accepted.", details={"filename": display}
        )
    if content_type and content_type.split(";")[0].strip().lower() not in ALLOWED_CONTENT_TYPES:
        raise UnsupportedFileTypeError(
            f"Unsupported content type '{content_type}'. Upload a CSV file.",
            details={"content_type": content_type},
        )
    return display


def read_limited(stream, max_bytes: int, chunk_size: int = 1024 * 1024) -> bytes:
    """Read an upload stream, aborting as soon as it exceeds ``max_bytes``."""
    buf = bytearray()
    while True:
        chunk = stream.read(chunk_size)
        if not chunk:
            break
        buf.extend(chunk)
        if len(buf) > max_bytes:
            raise UploadTooLargeError(
                f"File exceeds the maximum upload size of {max_bytes // (1024 * 1024)} MB.",
                details={"max_bytes": max_bytes},
            )
    if not buf:
        raise UploadError("The uploaded file is empty.", code="EMPTY_FILE")
    return bytes(buf)


def parse_csv(raw: bytes, filename: str) -> RawCsv:
    """read_frame + required-column validation (used by the analyze pipeline)."""
    parsed = read_frame(raw, filename)
    validate_columns(parsed.frame)
    return parsed


def read_frame(raw: bytes, filename: str) -> RawCsv:
    """Decode and parse CSV bytes WITHOUT checking required columns. Everything is read
    as text; numeric conversion happens in :mod:`preprocessing` so bad cells can be
    counted, not crash parsing."""
    if b"\x00" in raw[:4096]:
        raise CsvValidationError("File does not look like a text CSV (binary content).")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = raw.decode("latin-1")
        except UnicodeDecodeError as exc:  # pragma: no cover - latin-1 cannot fail
            raise CsvValidationError("Could not decode file as text.") from exc
    try:
        frame = pd.read_csv(io.StringIO(text), dtype=str, skipinitialspace=True)
    except pd.errors.EmptyDataError as exc:
        raise CsvValidationError("CSV contains no data.", code="EMPTY_CSV") from exc
    except (pd.errors.ParserError, ValueError) as exc:
        raise CsvValidationError(f"CSV could not be parsed: {exc}") from exc
    if frame.empty:
        raise CsvValidationError("CSV has a header but no data rows.", code="EMPTY_CSV")
    original = tuple(str(c).strip() for c in frame.columns)
    frame.columns = [_canonical(c) for c in frame.columns]
    return RawCsv(filename=filename, frame=frame, original_columns=original)


def _canonical(col: object) -> str:
    """Trim whitespace and map case-insensitive matches onto canonical names."""
    name = str(col).strip()
    lookup = {c.lower(): c for c in REQUIRED_COLUMNS + ("ambientTemperature", "measurement_valid")}
    return lookup.get(name.lower(), name)


def validate_columns(frame: pd.DataFrame) -> None:
    missing = [c for c in REQUIRED_COLUMNS if c not in frame.columns]
    if missing:
        raise MissingColumnsError(
            f"CSV is missing required column(s): {', '.join(missing)}.",
            details={
                "missing_columns": missing,
                "required_columns": list(REQUIRED_COLUMNS),
                "found_columns": [str(c) for c in frame.columns],
            },
        )
    dup = [c for c in REQUIRED_COLUMNS if list(frame.columns).count(c) > 1]
    if dup:
        raise CsvValidationError(
            f"Duplicate column(s) in CSV header: {', '.join(dup)}.",
            details={"duplicate_columns": dup},
        )
