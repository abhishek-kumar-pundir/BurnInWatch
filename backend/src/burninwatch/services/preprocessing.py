"""Numeric conversion, cleaning, chronological sorting and baseline calculation.

Everything here mirrors notebook 12 (training): rows with a missing value in ANY of the
eight required numeric columns are dropped, ``measurement_valid == False`` rows are
dropped, and the baseline uses the training rule (see ``PipelineConfig``).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from ..config import BASELINE_SIGNALS, PIPELINE, REQUIRED_COLUMNS
from ..errors import InsufficientDataError

NUMERIC_COLUMNS: tuple[str, ...] = REQUIRED_COLUMNS + ("ambientTemperature",)
_TRUE = {"1", "true", "t", "yes", "y"}


@dataclass(frozen=True)
class CleanedData:
    frame: pd.DataFrame  # sorted by timeEpoch, all REQUIRED_COLUMNS finite
    total_rows: int
    dropped_rows: int
    dropped_by_reason: dict[str, int]
    was_reordered: bool
    duplicate_timestamps: int

    @property
    def valid_rows(self) -> int:
        return len(self.frame)


@dataclass(frozen=True)
class Baseline:
    """Reference values taken from the earliest part of the uploaded test (training rule)."""

    n_rows: int  # rows in the reference region
    train_rows: int  # rows in the baseline-train segment the reference is cut from
    values: dict[str, float] = field(default_factory=dict)  # signal -> median


def to_numeric(frame: pd.DataFrame) -> pd.DataFrame:
    """Convert measurement columns to float; unparseable cells and +/-inf become NaN."""
    out = frame.copy()
    for col in NUMERIC_COLUMNS:
        if col in out.columns:
            out[col] = pd.to_numeric(out[col], errors="coerce").astype("float64")
            out[col] = out[col].replace([np.inf, -np.inf], np.nan)
    return out


def filter_rows(frame: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    """Numeric conversion + row filtering. Never raises; returns (usable rows, reasons).

    A row is dropped when ``measurement_valid`` (if present) is false, or when any of the
    required numeric columns is not finite (identical to training's ``dropna``).
    """
    df = to_numeric(frame)
    reasons: dict[str, int] = {}
    keep = pd.Series(True, index=df.index)

    if "measurement_valid" in df.columns:
        flag = df["measurement_valid"].astype(str).str.strip().str.lower().isin(_TRUE)
        bad = keep & ~flag
        if bad.any():
            reasons["measurement_valid_false"] = int(bad.sum())
        keep &= flag

    for col in REQUIRED_COLUMNS:
        bad = keep & df[col].isna()
        if bad.any():
            reasons[f"non_numeric_or_missing_{col}"] = int(bad.sum())
        keep &= df[col].notna()
    return df.loc[keep], reasons


def clean(frame: pd.DataFrame) -> CleanedData:
    """Drop unusable rows and sort chronologically (see :func:`filter_rows`)."""
    total = len(frame)
    df, reasons = filter_rows(frame)
    if len(df) < PIPELINE.min_rows:
        raise InsufficientDataError(
            f"Only {len(df)} usable row(s) after cleaning; at least {PIPELINE.min_rows} "
            f"are required to form one {PIPELINE.window_size}-record window.",
            details={
                "total_rows": total,
                "valid_rows": int(len(df)),
                "min_rows": PIPELINE.min_rows,
                "dropped_by_reason": reasons,
            },
        )

    was_reordered = not df["timeEpoch"].is_monotonic_increasing
    df = df.sort_values("timeEpoch", kind="stable").reset_index(drop=True)
    duplicates = int(df["timeEpoch"].duplicated().sum())
    return CleanedData(
        frame=df,
        total_rows=total,
        dropped_rows=total - len(df),
        dropped_by_reason=reasons,
        was_reordered=was_reordered,
        duplicate_timestamps=duplicates,
    )


def baseline_row_counts(n_rows: int) -> tuple[int, int]:
    """(train_rows, reference_rows) exactly as notebook 12 computes them for a file."""
    train_rows = int(np.floor(n_rows * PIPELINE.train_fraction))
    ref_rows = max(PIPELINE.baseline_min_rows, int(train_rows * PIPELINE.baseline_fraction))
    return train_rows, min(ref_rows, n_rows)


def compute_baseline(frame: pd.DataFrame) -> Baseline:
    """Training baseline rule applied to the uploaded test.

    ``train_n = floor(0.20 n)``; reference = first ``max(20, int(0.10 * train_n))`` rows;
    baseline = median of each baseline signal over the reference. For a 10 770-row file this
    is 215 rows (2 %). Production assumption: the upload starts in a reference-like state;
    a test that is already degraded at its start will have a degraded baseline.
    """
    train_rows, ref_rows = baseline_row_counts(len(frame))
    ref = frame.iloc[:ref_rows]
    return Baseline(
        n_rows=ref_rows,
        train_rows=train_rows,
        values={s: float(ref[s].median()) for s in BASELINE_SIGNALS},
    )
