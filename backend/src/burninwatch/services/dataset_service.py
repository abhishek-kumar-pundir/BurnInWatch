"""Dataset pre-validation: the same parsing/cleaning rules as analysis, without any model.

Always returns a structured report (``valid`` true/false + per-check results) for problems
inside the file, so the UI can explain exactly what is wrong. Upload-level problems
(wrong extension, too large, empty) still raise typed errors.
"""
from __future__ import annotations

import difflib

import pandas as pd

from ..config import PIPELINE, REQUIRED_COLUMNS
from ..errors import CsvValidationError
from ..schemas.dataset import DatasetCheck, DatasetValidationResponse
from . import csv_service, preprocessing
from .windowing import n_windows_for


def _skipped(id_: str, label: str) -> DatasetCheck:
    return DatasetCheck(id=id_, label=label, status="skipped", detail="Not evaluated because an earlier check failed.")


def validate_dataset(raw: bytes, filename: str) -> DatasetValidationResponse:
    base = dict(
        filename=filename,
        size_bytes=len(raw),
        required_columns=list(REQUIRED_COLUMNS),
        window_size=PIPELINE.window_size,
        stride=PIPELINE.stride,
        min_rows=PIPELINE.min_rows,
    )
    labels = {
        "readable": "CSV readable",
        "columns": "Required columns detected",
        "numeric": "Numeric measurements valid",
        "timestamp": "Timestamp column usable",
        "order": "Chronological ordering",
        "records": "Sufficient records for windowing",
    }

    try:
        parsed = csv_service.read_frame(raw, filename)
    except CsvValidationError as exc:
        checks = [DatasetCheck(id="readable", label=labels["readable"], status="fail", detail=exc.message)]
        checks += [_skipped(k, v) for k, v in labels.items() if k != "readable"]
        return DatasetValidationResponse(valid=False, checks=checks, **base)

    frame = parsed.frame
    total = len(frame)
    checks = [
        DatasetCheck(
            id="readable", label=labels["readable"], status="pass", detail=f"{total:,} records, {len(parsed.original_columns)} columns."
        )
    ]

    # --- required columns
    missing = [c for c in REQUIRED_COLUMNS if c not in frame.columns]
    found = list(parsed.original_columns)
    hints: dict[str, list[str]] = {}
    for m in missing:
        close = difflib.get_close_matches(m.lower(), [f.lower() for f in found], n=3, cutoff=0.45)
        hints[m] = [f for f in found if f.lower() in close]
    if missing:
        checks.append(
            DatasetCheck(
                id="columns",
                label=labels["columns"],
                status="fail",
                detail=f"Missing required column(s): {', '.join(missing)}.",
            )
        )
    else:
        checks.append(DatasetCheck(id="columns", label=labels["columns"], status="pass", detail="All 8 required columns present."))

    # --- time range (works whenever timeEpoch exists)
    time_start = time_end = duration = None
    time_num = None
    if "timeEpoch" in frame.columns:
        time_num = preprocessing.to_numeric(frame[["timeEpoch"]])["timeEpoch"].dropna()
        if len(time_num):
            time_start, time_end = float(time_num.min()), float(time_num.max())
            duration = time_end - time_start

    if missing:
        checks += [_skipped(k, labels[k]) for k in ("numeric", "timestamp", "order", "records")]
        return DatasetValidationResponse(
            valid=False,
            checks=checks,
            total_rows=total,
            columns_found=found,
            missing_columns=missing,
            column_hints=hints,
            time_start=time_start,
            time_end=time_end,
            duration=duration,
            **base,
        )

    usable, reasons = preprocessing.filter_rows(frame)
    dropped = total - len(usable)

    # --- numeric
    if dropped == 0:
        checks.append(DatasetCheck(id="numeric", label=labels["numeric"], status="pass", detail="All rows contain valid numeric measurements."))
    else:
        parts = ", ".join(f"{k.replace('non_numeric_or_missing_', '')}: {v}" for k, v in reasons.items())
        checks.append(
            DatasetCheck(
                id="numeric",
                label=labels["numeric"],
                status="warn",
                detail=f"{dropped:,} row(s) are unusable and will be dropped ({parts}).",
            )
        )

    # --- timestamp
    if time_num is None or len(time_num) == 0:
        checks.append(DatasetCheck(id="timestamp", label=labels["timestamp"], status="fail", detail="timeEpoch contains no numeric values."))
    else:
        checks.append(
            DatasetCheck(
                id="timestamp", label=labels["timestamp"], status="pass", detail=f"{len(time_num):,} numeric timestamps found."
            )
        )

    # --- ordering
    if len(usable):
        ordered = bool(usable["timeEpoch"].is_monotonic_increasing)
        dups = int(usable["timeEpoch"].duplicated().sum())
        if ordered and dups == 0:
            checks.append(DatasetCheck(id="order", label=labels["order"], status="pass", detail="Timestamps are strictly increasing."))
        else:
            msg = []
            if not ordered:
                msg.append("rows are not in chronological order and will be sorted by timeEpoch")
            if dups:
                msg.append(f"{dups:,} duplicate timestamp(s)")
            checks.append(DatasetCheck(id="order", label=labels["order"], status="warn", detail="; ".join(msg).capitalize() + "."))
    else:
        checks.append(_skipped("order", labels["order"]))

    # --- records
    n = len(usable)
    windows = n_windows_for(n)
    if n >= PIPELINE.min_rows:
        checks.append(
            DatasetCheck(
                id="records",
                label=labels["records"],
                status="pass",
                detail=f"{n:,} usable records produce {windows:,} windows of {PIPELINE.window_size} (stride {PIPELINE.stride}).",
            )
        )
    else:
        checks.append(
            DatasetCheck(
                id="records",
                label=labels["records"],
                status="fail",
                detail=f"{n:,} usable record(s); at least {PIPELINE.min_rows} are needed for one window.",
            )
        )

    valid = not missing and n >= PIPELINE.min_rows and not any(c.status == "fail" for c in checks)
    if len(usable):
        time_start, time_end = float(usable["timeEpoch"].min()), float(usable["timeEpoch"].max())
        duration = time_end - time_start
    return DatasetValidationResponse(
        valid=valid,
        checks=checks,
        total_rows=total,
        valid_rows=n,
        dropped_rows=dropped,
        columns_found=found,
        missing_columns=[],
        column_hints={},
        time_start=time_start,
        time_end=time_end,
        duration=duration,
        expected_windows=windows,
        **base,
    )
