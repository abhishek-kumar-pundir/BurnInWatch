"""Contracts for history, window inspector, signal series and offline evaluation."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from .screening import FeatureExplanation, ScreeningStatus


class ScreeningListItem(BaseModel):
    screening_id: str
    device_id: str
    created_at: datetime
    filename: str
    model_name: str
    status: ScreeningStatus
    total_windows: int
    review_windows: int
    anomalous_windows: int
    anomaly_fraction: float
    episodes: int = 0


class ScreeningListResponse(BaseModel):
    items: list[ScreeningListItem]
    total: int
    storage: Literal["memory"] = "memory"


class SignalLevel(BaseModel):
    signal: str
    window_mean: float
    window_min: float
    window_max: float
    baseline_median: float | None = Field(
        default=None,
        description="Median over the reference region of the upload (training rule); only for node2Voltage, "
        "collectorEmitterCurrent, packageTemperature",
    )
    delta_from_baseline: float | None = None
    pct_from_baseline: float | None = Field(default=None, description="null when the baseline is ~0")


class NeighborWindow(BaseModel):
    window_index: int
    start_time: float
    end_time: float
    isolation_forest_score: float
    autoencoder_score: float
    isolation_forest_flag: bool
    autoencoder_flag: bool
    status: ScreeningStatus
    is_selected: bool = False


class WindowDetailResponse(BaseModel):
    screening_id: str
    window_index: int
    start_row: int
    end_row: int
    start_time: float
    end_time: float
    record_count: int
    isolation_forest_score: float
    isolation_forest_threshold: float
    isolation_forest_flag: bool
    autoencoder_score: float
    autoencoder_threshold: float
    autoencoder_flag: bool
    status: ScreeningStatus
    detection: Literal["both", "isolation_forest", "autoencoder", "none"]
    episode_id: int | None = None
    why_flagged: list[str]
    features: list[FeatureExplanation] = Field(description="All model features, artifact order")
    raw_time: list[float] = Field(description="timeEpoch of the window's records")
    raw_measurements: dict[str, list[float]] = Field(description="signal -> the window's records")
    signal_levels: list[SignalLevel]
    nearby: list[NeighborWindow]
    if_attribution_method: str
    ae_attribution_method: str


class BaselineInfo(BaseModel):
    value: float
    rows: int
    time_start: float
    time_end: float


class FlaggedInterval(BaseModel):
    window_index: int
    start_time: float
    end_time: float
    status: ScreeningStatus


class EpisodeInterval(BaseModel):
    id: int
    start_time: float
    end_time: float


class SignalSeriesResponse(BaseModel):
    screening_id: str
    signal: str
    unit_note: str = "Values are shown exactly as uploaded (no unit conversion)."
    total_points: int
    returned_points: int
    downsampled: bool
    range_start: float
    range_end: float
    time: list[float]
    value: list[float]
    baseline: BaselineInfo | None = None
    flagged_windows: list[FlaggedInterval]
    episodes: list[EpisodeInterval]


# --- offline evaluation (static research artifacts, NOT live screening) -------- #
class OfflineModelEvaluation(BaseModel):
    model: str
    feature_set: str
    feature_count: int
    threshold_if: float
    threshold_ae: float
    train_windows: int
    validation_windows: int
    evaluation_windows: int
    if_flag_fraction: float
    ae_flag_fraction: float
    both_flagged: int
    if_only: int
    ae_only: int
    score_correlation: float
    ae_final_training_loss: float | None = None
    per_device: list[dict]


class OfflineEvaluationResponse(BaseModel):
    title: str
    generated_from: list[str]
    validation_methodology: str
    threshold_method: str
    models: list[OfflineModelEvaluation]
    available_metrics: list[str]
    unavailable_metrics: dict[str, str]
    dataset: dict
    limitations: list[str]
    artifact_rescoring_check: dict
