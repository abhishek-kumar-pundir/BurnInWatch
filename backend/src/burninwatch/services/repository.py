"""Screening persistence behind an interface (swap in MongoDB later).

Two kinds of data are kept per screening:

* the public :class:`ScreeningResponse` (small; what the API returns), and
* a :class:`ScreeningDetail` (cleaned time series + feature matrix) that powers window and
  signal drill-down. Details are large, so the in-memory implementation keeps only the
  most recent ones.
"""
from __future__ import annotations

import threading
from collections import OrderedDict
from dataclasses import dataclass
from typing import Protocol

import numpy as np
import pandas as pd

from ..errors import DetailUnavailableError, ScreeningNotFoundError
from ..schemas.screening import ScreeningResponse
from .preprocessing import Baseline


@dataclass(frozen=True)
class ScreeningDetail:
    times: np.ndarray  # cleaned, sorted timeEpoch
    signals: dict[str, np.ndarray]  # signal -> values aligned with ``times``
    baseline: Baseline
    start_rows: np.ndarray
    end_rows: np.ndarray  # inclusive
    features: pd.DataFrame  # the model's features, one row per window
    bundle: object = None  # ModelBundle used for this run (needed for on-demand XAI)
    scores: object = None  # inference.WindowScores (scaled inputs, reconstructions, errors)
    if_contrib: np.ndarray | None = None  # (n, F) IF occlusion attribution, NaN if not computed
    episodes: tuple = ()


class ScreeningRepository(Protocol):
    def save(self, screening: ScreeningResponse, detail: ScreeningDetail | None = None) -> None: ...

    def get(self, screening_id: str) -> ScreeningResponse:
        """Raise ScreeningNotFoundError if absent."""
        ...

    def get_detail(self, screening_id: str) -> ScreeningDetail:
        """Raise ScreeningNotFoundError / DetailUnavailableError."""
        ...

    def list_all(self) -> list[ScreeningResponse]:
        """Newest first."""
        ...


class InMemoryScreeningRepository:
    """Process-local and bounded (oldest evicted). Data is lost on restart."""

    def __init__(self, max_items: int = 500, max_details: int = 25) -> None:
        self._items: "OrderedDict[str, ScreeningResponse]" = OrderedDict()
        self._details: "OrderedDict[str, ScreeningDetail]" = OrderedDict()
        self._max = max_items
        self._max_details = max_details
        self._lock = threading.Lock()

    def save(self, screening: ScreeningResponse, detail: ScreeningDetail | None = None) -> None:
        with self._lock:
            self._items[screening.screening_id] = screening
            while len(self._items) > self._max:
                self._items.popitem(last=False)
            if detail is not None:
                self._details[screening.screening_id] = detail
            while len(self._details) > self._max_details:
                self._details.popitem(last=False)
            for stale in [k for k in self._details if k not in self._items]:
                del self._details[stale]

    def get(self, screening_id: str) -> ScreeningResponse:
        with self._lock:
            item = self._items.get(screening_id)
        if item is None:
            raise ScreeningNotFoundError(
                f"Screening '{screening_id}' was not found.", details={"screening_id": screening_id}
            )
        return item

    def get_detail(self, screening_id: str) -> ScreeningDetail:
        self.get(screening_id)
        with self._lock:
            detail = self._details.get(screening_id)
        if detail is None:
            raise DetailUnavailableError(
                "Detailed measurement data for this screening is no longer available "
                "(only the most recent screenings keep drill-down data). Re-run the screening to inspect it.",
                details={"screening_id": screening_id},
            )
        return detail

    def list_all(self) -> list[ScreeningResponse]:
        with self._lock:
            return list(reversed(self._items.values()))
