"""Orchestrates the full inference pipeline. Routes call only this."""
from __future__ import annotations

import re
import time
import uuid
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from ..config import DISCLAIMER, EPISODES, MEASURED_SIGNALS, PIPELINE, Settings
from ..errors import BurnInWatchError
from ..ml.model_registry import ModelRegistry
from ..schemas.details import (
    ScreeningListItem,
    ScreeningListResponse,
    SignalSeriesResponse,
    WindowDetailResponse,
)
from ..schemas.screening import (
    Agreement,
    BaselineSummary,
    DistributionCheck,
    InputInfo,
    ModelInfo,
    PeakWindow,
    ScreeningResponse,
    ScreeningStatus,
    StageTimings,
    Summary,
    Thresholds,
    TimelinePoint,
    TimelineResponse,
)
from . import csv_service, details, episodes as episodes_mod, preprocessing, windowing, xai
from .features import extract_features
from .inference import WindowScores, aggregate_status, score_windows
from .repository import ScreeningDetail, ScreeningRepository

_DEVICE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._\-]{0,63}$")
_STATUS_RANK = {ScreeningStatus.NORMAL: 0, ScreeningStatus.REVIEW: 1, ScreeningStatus.ANOMALY: 2}
BASELINE_METHOD = (
    "Training rule (notebook 12): median of node2Voltage, collectorEmitterCurrent and packageTemperature over the "
    "first max(20, 10 % of the first 20 % of rows) cleaned rows of THIS upload."
)


def validate_device_id(device_id: str | None) -> str:
    value = (device_id or "").strip()
    if not _DEVICE_ID.match(value):
        raise BurnInWatchError(
            "device_id must be 1-64 characters: letters, digits, '.', '_' or '-'.",
            code="INVALID_DEVICE_ID",
            status_code=422,
        )
    return value


def pick_peak(scores: WindowScores, ae_threshold: float) -> int:
    """Most severe window: highest status, then highest AE error / threshold, then IF score."""
    rank = np.array([_STATUS_RANK[s] for s in scores.statuses])
    return int(np.lexsort((scores.if_scores, scores.ae_scores / ae_threshold, rank))[-1])


def distribution_check(scores: WindowScores, ae_threshold: float) -> DistributionCheck:
    """Flag input that is implausibly far from the training distribution.

    Training validation thresholds are 95th percentiles, so an AE/IF flag rate far above ~5-30 %
    or a median AE error many times the threshold means preprocessing/units differ from training
    - not that every window is genuinely abnormal.
    """
    ratio = float(np.median(scores.ae_scores) / ae_threshold)
    ae_frac, if_frac = float(scores.ae_flags.mean()), float(scores.if_flags.mean())
    suspect = ratio > 5.0 or ae_frac > 0.9 or if_frac > 0.9
    msg = (
        "Median autoencoder error or flag rates are far outside what the trained models produce on their own "
        "training tests. The upload probably differs from the training data (units, scaling, wrong signal columns); "
        "treat these results as NOT reliable."
        if suspect else
        "Score levels are consistent with the range the models produced on their validation data."
    )
    return DistributionCheck(
        status="suspect" if suspect else "ok", median_ae_to_threshold=round(ratio, 4),
        ae_flag_fraction=round(ae_frac, 4), if_flag_fraction=round(if_frac, 4), message=msg,
    )


class ScreeningService:
    def __init__(self, settings: Settings, registry: ModelRegistry, repository: ScreeningRepository):
        self.settings = settings
        self.registry = registry
        self.repository = repository

    # -- main use case ------------------------------------------------------ #
    def analyze(
        self, *, raw: bytes, filename: str, device_id: str, model_name: str | None
    ) -> ScreeningResponse:
        t0 = time.perf_counter()
        device_id = validate_device_id(device_id)
        spec = self.registry.spec(model_name)

        parsed = csv_service.parse_csv(raw, filename)
        cleaned = preprocessing.clean(parsed.frame)
        baseline = preprocessing.compute_baseline(cleaned.frame)
        t1 = time.perf_counter()
        windows = windowing.build_windows(cleaned.frame)
        t2 = time.perf_counter()
        s = self.settings
        features = extract_features(windows, baseline)
        t3 = time.perf_counter()

        bundle = self.registry.get(spec.name)  # first call loads + caches artifacts
        scores = score_windows(bundle, features, s)
        t4 = time.perf_counter()

        statuses = scores.statuses
        n = windows.n_windows
        n_anom = sum(x == ScreeningStatus.ANOMALY for x in statuses)
        n_rev = sum(x == ScreeningStatus.REVIEW for x in statuses)
        overall = aggregate_status(statuses)

        if_contrib = xai.if_contributions_for_flagged(bundle, scores, s.xai_max_if_windows)
        episodes = episodes_mod.detect_episodes(bundle, windows, scores, if_contrib)
        dist = distribution_check(scores, bundle.ae_threshold)

        timeline = [
            TimelinePoint(
                window_index=i,
                start_row=int(windows.start_rows[i]),
                end_row=int(windows.end_rows[i]),
                start_time=float(windows.start_times[i]),
                end_time=float(windows.end_times[i]),
                isolation_forest_score=float(scores.if_scores[i]),
                autoencoder_score=float(scores.ae_scores[i]),
                isolation_forest_flag=bool(scores.if_flags[i]),
                autoencoder_flag=bool(scores.ae_flags[i]),
                status=statuses[i],
            )
            for i in range(n)
        ]

        p = pick_peak(scores, bundle.ae_threshold)
        peak_feats = xai.explain_window(bundle, scores, p, None if np.isnan(if_contrib[p]).all() else if_contrib[p])
        peak = PeakWindow(
            window_index=p,
            start_time=timeline[p].start_time,
            end_time=timeline[p].end_time,
            isolation_forest_score=timeline[p].isolation_forest_score,
            autoencoder_score=timeline[p].autoencoder_score,
            status=statuses[p],
            top_features=xai.rank(peak_feats, "ae_error_share", s.xai_top_features),
        )
        t5 = time.perf_counter()

        warnings: list[str] = []
        if cleaned.dropped_rows:
            warnings.append(f"{cleaned.dropped_rows} row(s) were dropped during cleaning.")
        if cleaned.was_reordered:
            warnings.append("Rows were not chronological and were sorted by timeEpoch.")
        if cleaned.duplicate_timestamps:
            warnings.append(f"{cleaned.duplicate_timestamps} duplicate timeEpoch value(s) found.")
        if windows.unused_tail_rows:
            warnings.append(
                f"The last {windows.unused_tail_rows} row(s) do not fill a complete window and were not scored."
            )
        if cleaned.valid_rows < PIPELINE.recommended_min_rows:
            warnings.append(
                f"Only {cleaned.valid_rows} usable rows: shorter than the {PIPELINE.recommended_min_rows}-row minimum "
                "used for training files; the baseline region is tiny and results are less reliable."
            )
        if scores.n_imputed_cells:
            warnings.append(f"{scores.n_imputed_cells} feature value(s) were NaN and imputed with training medians.")
        if dist.status == "suspect":
            warnings.append(dist.message)
        warnings.extend(f"Model load: {w}" for w in bundle.load_notes)

        times = cleaned.frame["timeEpoch"].to_numpy(dtype="float64")
        dt = np.diff(times)
        dt = dt[dt > 0]
        t_start, t_end = float(times[0]), float(times[-1])
        pk_if = float(scores.if_scores.max())
        pk_ae = float(scores.ae_scores.max())

        result = ScreeningResponse(
            screening_id=f"scr_{uuid.uuid4().hex[:12]}",
            device_id=device_id,
            created_at=datetime.now(timezone.utc),
            model=ModelInfo(
                name=spec.name,
                version=spec.version,
                description=spec.description,
                feature_count=len(bundle.features),
                features=list(bundle.features),
                window_size=PIPELINE.window_size,
                stride=PIPELINE.stride,
                trained_sklearn_version=bundle.trained_sklearn_version,
            ),
            input=InputInfo(
                filename=parsed.filename,
                total_rows=cleaned.total_rows,
                valid_rows=cleaned.valid_rows,
                dropped_rows=cleaned.dropped_rows,
                windows=n,
                time_start=t_start,
                time_end=t_end,
                duration_s=t_end - t_start,
                median_sampling_interval_s=float(np.median(dt)) if dt.size else None,
                signals=list(MEASURED_SIGNALS),
                baseline_rows=baseline.n_rows,
                baseline=BaselineSummary(
                    rows=baseline.n_rows, train_rows=baseline.train_rows,
                    values=baseline.values, method=BASELINE_METHOD,
                ),
                unused_tail_rows=windows.unused_tail_rows,
                was_reordered=cleaned.was_reordered,
                duplicate_timestamps=cleaned.duplicate_timestamps,
                dropped_by_reason=cleaned.dropped_by_reason,
                warnings=warnings,
            ),
            summary=Summary(
                status=overall,
                normal_windows=n - n_rev - n_anom,
                review_windows=n_rev,
                anomalous_windows=n_anom,
                total_windows=n,
                anomaly_fraction=round(n_anom / n, 4),
                total_samples=cleaned.valid_rows,
                episodes=len(episodes),
                max_if_score=pk_if,
                max_ae_score=pk_ae,
                max_ae_to_threshold=pk_ae / bundle.ae_threshold,
                agreement=Agreement(
                    isolation_forest_flagged=int(scores.if_flags.sum()),
                    autoencoder_flagged=int(scores.ae_flags.sum()),
                    both=int((scores.if_flags & scores.ae_flags).sum()),
                    isolation_forest_only=int((scores.if_flags & ~scores.ae_flags).sum()),
                    autoencoder_only=int((~scores.if_flags & scores.ae_flags).sum()),
                    neither=int((~scores.if_flags & ~scores.ae_flags).sum()),
                ),
            ),
            thresholds=Thresholds(isolation_forest=bundle.if_threshold, autoencoder=bundle.ae_threshold),
            episodes=episodes,
            episode_rule=episodes_mod.episode_rule_text(),
            peak=peak,
            top_features=peak_feats_for_overview(bundle, scores, if_contrib, episodes, p, s.xai_top_features),
            distribution_check=dist,
            timeline=timeline,
            timings_ms=StageTimings(
                parse_clean_ms=round((t1 - t0) * 1000, 1),
                windowing_ms=round((t2 - t1) * 1000, 1),
                features_ms=round((t3 - t2) * 1000, 1),
                inference_ms=round((t4 - t3) * 1000, 1),
                explanation_ms=round((t5 - t4) * 1000, 1),
                total_ms=round((t5 - t0) * 1000, 1),
            ),
            disclaimer=DISCLAIMER,
        )
        detail = ScreeningDetail(
            times=times,
            signals={c: cleaned.frame[c].to_numpy(dtype="float64") for c in MEASURED_SIGNALS},
            baseline=baseline,
            start_rows=windows.start_rows,
            end_rows=windows.end_rows,
            features=features[list(bundle.features)].reset_index(drop=True),
            bundle=bundle,
            scores=scores,
            if_contrib=if_contrib,
            episodes=tuple(episodes),
        )
        self.repository.save(result, detail)
        return result

    # -- read side ---------------------------------------------------------- #
    def get(self, screening_id: str) -> ScreeningResponse:
        return self.repository.get(screening_id)

    def timeline(self, screening_id: str) -> TimelineResponse:
        r = self.repository.get(screening_id)
        return TimelineResponse(
            screening_id=r.screening_id,
            device_id=r.device_id,
            total_windows=r.summary.total_windows,
            thresholds=r.thresholds,
            timeline=r.timeline,
        )

    def list_screenings(self) -> ScreeningListResponse:
        items = [
            ScreeningListItem(
                screening_id=r.screening_id,
                device_id=r.device_id,
                created_at=r.created_at,
                filename=r.input.filename,
                model_name=r.model.name,
                status=r.summary.status,
                total_windows=r.summary.total_windows,
                review_windows=r.summary.review_windows,
                anomalous_windows=r.summary.anomalous_windows,
                anomaly_fraction=r.summary.anomaly_fraction,
                episodes=r.summary.episodes,
            )
            for r in self.repository.list_all()
        ]
        return ScreeningListResponse(items=items, total=len(items))

    def window(self, screening_id: str, window_index: int) -> WindowDetailResponse:
        r = self.repository.get(screening_id)
        return details.window_detail(r, self.repository.get_detail(screening_id), window_index, self.settings)

    def signal(
        self, screening_id: str, signal: str, max_points: int,
        start: float | None = None, end: float | None = None,
    ) -> SignalSeriesResponse:
        r = self.repository.get(screening_id)
        return details.signal_series(r, self.repository.get_detail(screening_id), signal, max_points, start, end)


def peak_feats_for_overview(bundle, scores, if_contrib, episodes, peak_window: int, limit: int):
    """Top features of the strongest episode's peak window (else of the overall peak window)."""
    w = max(episodes, key=lambda e: e.max_ae_to_threshold).peak_window if episodes else peak_window
    row = None if np.isnan(if_contrib[w]).all() else if_contrib[w]
    return xai.rank(xai.explain_window(bundle, scores, w, row), "ae_error_share", limit)
