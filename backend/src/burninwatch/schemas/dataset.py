"""Contracts for dataset pre-validation (no model involved)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class DatasetCheck(BaseModel):
    id: str
    label: str
    status: Literal["pass", "warn", "fail", "skipped"]
    detail: str | None = None


class DatasetValidationResponse(BaseModel):
    valid: bool = Field(description="True when an analysis can be started with this file.")
    filename: str
    size_bytes: int
    total_rows: int | None = None
    valid_rows: int | None = None
    dropped_rows: int | None = None
    columns_found: list[str] = Field(default_factory=list, description="Header names as written in the file.")
    required_columns: list[str]
    missing_columns: list[str] = Field(default_factory=list)
    column_hints: dict[str, list[str]] = Field(
        default_factory=dict, description="missing column -> similar column names found in the file"
    )
    time_start: float | None = None
    time_end: float | None = None
    duration: float | None = Field(default=None, description="time_end - time_start, in timeEpoch units")
    expected_windows: int | None = None
    window_size: int
    stride: int
    min_rows: int
    checks: list[DatasetCheck]
