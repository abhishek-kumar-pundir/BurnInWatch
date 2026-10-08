"""Overlapping window generation (vectorised, no per-window Python loops)."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from numpy.lib.stride_tricks import sliding_window_view

from ..config import FEATURE_SIGNALS, PIPELINE
from ..errors import InsufficientDataError

WINDOW_COLUMNS: tuple[str, ...] = ("timeEpoch",) + FEATURE_SIGNALS


@dataclass(frozen=True)
class WindowSet:
    """All windows of one test. ``arrays[col]`` has shape (n_windows, window_size)."""

    arrays: dict[str, np.ndarray]
    start_rows: np.ndarray
    end_rows: np.ndarray  # inclusive
    start_times: np.ndarray
    end_times: np.ndarray
    window_size: int
    stride: int
    unused_tail_rows: int

    @property
    def n_windows(self) -> int:
        return len(self.start_rows)


def n_windows_for(n_rows: int, size: int = PIPELINE.window_size, stride: int = PIPELINE.stride) -> int:
    """Number of full windows; a trailing partial window is not scored."""
    if n_rows < size:
        return 0
    return (n_rows - size) // stride + 1


def windows_at(frame: pd.DataFrame, start_rows: np.ndarray, size: int = PIPELINE.window_size,
               stride: int = PIPELINE.stride, unused_tail_rows: int = 0) -> WindowSet:
    """Windows beginning at arbitrary row positions (used by parity checks)."""
    start_rows = np.asarray(start_rows, dtype=int)
    arrays = {
        col: sliding_window_view(frame[col].to_numpy(dtype="float64"), size)[start_rows]
        for col in WINDOW_COLUMNS
    }
    end_rows = start_rows + size - 1
    times = arrays["timeEpoch"]
    return WindowSet(
        arrays=arrays,
        start_rows=start_rows,
        end_rows=end_rows,
        start_times=times[:, 0].copy(),
        end_times=times[:, -1].copy(),
        window_size=size,
        stride=stride,
        unused_tail_rows=unused_tail_rows,
    )


def build_windows(
    frame: pd.DataFrame,
    size: int = PIPELINE.window_size,
    stride: int = PIPELINE.stride,
) -> WindowSet:
    n = len(frame)
    count = n_windows_for(n, size, stride)
    if count == 0:
        raise InsufficientDataError(
            f"Need at least {size} rows to build a window; got {n}.",
            details={"valid_rows": n, "window_size": size},
        )
    starts = np.arange(count) * stride
    return windows_at(frame, starts, size, stride, unused_tail_rows=int(n - (starts[-1] + size)))
