"""Drill-down views (window inspector, signal series) built from the stored run."""
from __future__ import annotations

import numpy as np

from ..config import MEASURED_SIGNALS, Settings
from ..errors import UnknownSignalError, WindowNotFoundError
from ..schemas.details import (
    BaselineInfo, EpisodeInterval, FlaggedInterval, NeighborWindow, SignalLevel,
    SignalSeriesResponse, WindowDetailResponse,
)
from ..schemas.screening import ScreeningResponse, ScreeningStatus
from . import xai
from .repository import ScreeningDetail
from .series import downsample_minmax

NEIGHBORS = 6
IF_METHOD = ("Reference-substitution (occlusion): IF score minus the IF score with the feature replaced by its "
             "training median. Single-feature counterfactual; not SHAP and not additive.")
AE_METHOD = "Per-feature squared reconstruction error in the scaled feature space; shares sum to 100 %."


def signal_series(
    response: ScreeningResponse, detail: ScreeningDetail, signal: str, max_points: int,
    start: float | None = None, end: float | None = None,
) -> SignalSeriesResponse:
    if signal not in detail.signals:
        raise UnknownSignalError(
            f"Unknown signal '{signal}'. Available: {', '.join(detail.signals)}.",
            details={"available_signals": list(detail.signals)},
        )
    times, values = detail.times, detail.signals[signal]
    lo = 0 if start is None else int(np.searchsorted(times, start, side="left"))
    hi = len(times) if end is None else int(np.searchsorted(times, end, side="right"))
    hi = max(hi, lo + 1)
    t, v = downsample_minmax(times[lo:hi], values[lo:hi], max_points)
    ref = detail.baseline.values.get(signal)
    baseline = (
        BaselineInfo(
            value=ref, rows=detail.baseline.n_rows,
            time_start=float(times[0]), time_end=float(times[detail.baseline.n_rows - 1]),
        )
        if ref is not None else None
    )
    flagged = [
        FlaggedInterval(window_index=p.window_index, start_time=p.start_time, end_time=p.end_time, status=p.status)
        for p in response.timeline if p.status != ScreeningStatus.NORMAL
    ]
    return SignalSeriesResponse(
        screening_id=response.screening_id, signal=signal,
        total_points=int(hi - lo), returned_points=int(len(t)), downsampled=len(t) < (hi - lo),
        range_start=float(times[lo]), range_end=float(times[hi - 1]),
        time=[float(x) for x in t], value=[float(x) for x in v],
        baseline=baseline, flagged_windows=flagged,
        episodes=[EpisodeInterval(id=e.id, start_time=e.start_time, end_time=e.end_time) for e in response.episodes],
    )


def window_detail(
    response: ScreeningResponse, detail: ScreeningDetail, window_index: int, settings: Settings
) -> WindowDetailResponse:
    n = len(response.timeline)
    if not 0 <= window_index < n:
        raise WindowNotFoundError(
            f"Window {window_index} does not exist (this screening has {n} windows).",
            details={"total_windows": n},
        )
    point = response.timeline[window_index]
    bundle, scores = detail.bundle, detail.scores
    a, b = int(detail.start_rows[window_index]), int(detail.end_rows[window_index]) + 1

    contrib = detail.if_contrib[window_index] if detail.if_contrib is not None else None
    if contrib is None or np.isnan(contrib).all():  # not flagged at run time -> compute now, same method
        contrib = xai.if_occlusion(bundle, scores.if_scaled[window_index : window_index + 1])[0]
    feats = xai.explain_window(bundle, scores, window_index, contrib)
    why = xai.why_flagged(
        if_score=point.isolation_forest_score, if_thr=response.thresholds.isolation_forest,
        ae_score=point.autoencoder_score, ae_thr=response.thresholds.autoencoder,
        features=feats, status=point.status.value,
    )

    levels = []
    for sig in MEASURED_SIGNALS:
        seg = detail.signals[sig][a:b]
        ref = detail.baseline.values.get(sig)
        mean = float(seg.mean())
        levels.append(
            SignalLevel(
                signal=sig, window_mean=mean, window_min=float(seg.min()), window_max=float(seg.max()),
                baseline_median=ref,
                delta_from_baseline=(mean - ref) if ref is not None else None,
                pct_from_baseline=(100.0 * (mean - ref) / abs(ref)) if ref is not None and abs(ref) > 1e-9 else None,
            )
        )

    flags = (point.isolation_forest_flag, point.autoencoder_flag)
    detection = "both" if all(flags) else "isolation_forest" if flags[0] else "autoencoder" if flags[1] else "none"
    lo, hi = max(0, window_index - NEIGHBORS), min(n, window_index + NEIGHBORS + 1)
    nearby = [
        NeighborWindow(
            window_index=p.window_index, start_time=p.start_time, end_time=p.end_time,
            isolation_forest_score=p.isolation_forest_score, autoencoder_score=p.autoencoder_score,
            isolation_forest_flag=p.isolation_forest_flag, autoencoder_flag=p.autoencoder_flag,
            status=p.status, is_selected=p.window_index == window_index,
        )
        for p in response.timeline[lo:hi]
    ]
    episode_id = next((e.id for e in response.episodes if e.first_window <= window_index <= e.last_window), None)
    return WindowDetailResponse(
        screening_id=response.screening_id, window_index=window_index,
        start_row=int(a), end_row=int(b - 1), start_time=point.start_time, end_time=point.end_time,
        record_count=b - a,
        isolation_forest_score=point.isolation_forest_score,
        isolation_forest_threshold=response.thresholds.isolation_forest,
        isolation_forest_flag=point.isolation_forest_flag,
        autoencoder_score=point.autoencoder_score,
        autoencoder_threshold=response.thresholds.autoencoder,
        autoencoder_flag=point.autoencoder_flag,
        status=point.status, detection=detection, episode_id=episode_id, why_flagged=why,
        features=feats,
        raw_time=[float(x) for x in detail.times[a:b]],
        raw_measurements={s: [float(x) for x in detail.signals[s][a:b]] for s in MEASURED_SIGNALS},
        signal_levels=levels, nearby=nearby,
        if_attribution_method=IF_METHOD, ae_attribution_method=AE_METHOD,
    )
