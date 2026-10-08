"""Pydantic contracts shared with the React frontend."""
from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class ScreeningStatus(str, Enum):
    NORMAL = "NORMAL"
    REVIEW = "REVIEW"
    ANOMALY = "ANOMALY"


class ModelInfo(BaseModel):
    name: str
    version: str
    description: str = ""
    feature_count: int
    features: list[str] = Field(default_factory=list, description="Ordered model input features (from the artifacts)")
    window_size: int
    stride: int
    trained_sklearn_version: str | None = None


class BaselineSummary(BaseModel):
    rows: int = Field(description="Rows in the reference region (training rule)")
    train_rows: int = Field(description="Rows of the baseline-train segment the reference is cut from")
    values: dict[str, float] = Field(description="signal -> median over the reference region")
    method: str


class InputInfo(BaseModel):
    filename: str
    total_rows: int
    valid_rows: int
    dropped_rows: int
    windows: int
    time_start: float
    time_end: float
    baseline_rows: int = Field(description="Earliest rows of the test used as the reference region.")
    baseline: BaselineSummary | None = None
    duration_s: float = Field(default=0.0, description="time_end - time_start (timeEpoch interpreted as seconds)")
    median_sampling_interval_s: float | None = None
    signals: list[str] = Field(default_factory=list)
    unused_tail_rows: int = Field(description="Trailing rows not covered by a full window.")
    was_reordered: bool = Field(description="True if rows were not chronological and were sorted.")
    duplicate_timestamps: int
    dropped_by_reason: dict[str, int] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)


class Agreement(BaseModel):
    isolation_forest_flagged: int
    autoencoder_flagged: int
    both: int
    isolation_forest_only: int
    autoencoder_only: int
    neither: int = 0


class StageTimings(BaseModel):
    """Server-measured wall time per pipeline stage, in milliseconds."""

    parse_clean_ms: float
    windowing_ms: float
    features_ms: float
    inference_ms: float
    explanation_ms: float
    total_ms: float


class Summary(BaseModel):
    status: ScreeningStatus
    normal_windows: int
    review_windows: int
    anomalous_windows: int
    total_windows: int
    anomaly_fraction: float = Field(description="anomalous_windows / total_windows")
    total_samples: int = 0
    episodes: int = 0
    max_if_score: float = 0.0
    max_ae_score: float = 0.0
    max_ae_to_threshold: float = Field(default=0.0, description="max AE error / AE threshold")
    agreement: Agreement


class Thresholds(BaseModel):
    isolation_forest: float
    autoencoder: float


class FeatureExplanation(BaseModel):
    """One model feature for one window, with every number taken from the actual run."""

    feature: str
    signal: str = Field(description="Base engineering signal, e.g. collectorEmitterCurrent")
    indicator: str = Field(description="e.g. 'variation (std)', 'relative change from baseline'")
    current_value: float
    learned_normal_value: float = Field(description="Training median of this feature (from the fitted scaler)")
    reconstructed_value: float | None = Field(default=None, description="Autoencoder reconstruction, original units")
    deviation: float = Field(description="current - learned normal")
    pct_deviation: float | None = Field(default=None, description="100*deviation/|learned normal|; null when the reference is ~0")
    normalized_deviation: float = Field(description="(current - median) / training IQR - signed, in training-IQR units")
    ae_error: float = Field(description="(scaled actual - scaled reconstruction)^2")
    ae_error_share: float = Field(description="ae_error / sum of ae_error over features (0..1)")
    if_contribution: float | None = Field(
        default=None,
        description="IF score minus IF score with this feature replaced by its training median; "
        "positive = pushed the window towards anomalous. null if not computed.",
    )
    direction: str = Field(description="'above' or 'below' the learned-normal value")


class EpisodeFeature(BaseModel):
    feature: str
    signal: str
    indicator: str
    mean_ae_error_share: float
    mean_if_contribution: float | None = None
    mean_abs_normalized_deviation: float
    direction: str


class EpisodeSignal(BaseModel):
    signal: str
    mean_ae_error_share: float


class Episode(BaseModel):
    id: int
    first_window: int
    last_window: int
    start_row: int
    end_row: int
    start_time: float
    end_time: float
    duration_s: float
    windows: int = Field(description="ANOMALY windows (both detectors) in the episode")
    span_windows: int = Field(description="All windows between first and last, incl. merged gaps")
    review_windows_in_span: int
    max_if_score: float
    mean_if_score: float
    max_ae_score: float
    mean_ae_score: float
    max_ae_to_threshold: float = Field(description="Severity: peak AE error / AE threshold (>1 = flagged)")
    max_if_margin: float = Field(description="Peak IF score - IF threshold")
    agreement_pct: float = Field(description="% of windows in the span flagged by BOTH detectors")
    peak_window: int
    top_features: list[EpisodeFeature]
    top_signals: list[EpisodeSignal]


class PeakWindow(BaseModel):
    window_index: int
    start_time: float
    end_time: float
    isolation_forest_score: float
    autoencoder_score: float
    status: ScreeningStatus
    top_features: list[FeatureExplanation] = Field(default_factory=list)


class TimelinePoint(BaseModel):
    window_index: int
    start_row: int = 0
    end_row: int = 0
    start_time: float
    end_time: float
    isolation_forest_score: float
    autoencoder_score: float
    isolation_forest_flag: bool
    autoencoder_flag: bool
    status: ScreeningStatus


class DistributionCheck(BaseModel):
    """Guard against silently scoring data the models were never trained on."""

    status: str = Field(description="'ok' or 'suspect'")
    median_ae_to_threshold: float
    ae_flag_fraction: float
    if_flag_fraction: float
    message: str


class ScreeningResponse(BaseModel):
    screening_id: str
    device_id: str
    created_at: datetime
    model: ModelInfo
    input: InputInfo
    summary: Summary
    thresholds: Thresholds
    episodes: list[Episode]
    episode_rule: str
    peak: PeakWindow
    top_features: list[FeatureExplanation] = Field(
        description="Features most associated with the flagged windows (peak window of the strongest episode)"
    )
    distribution_check: DistributionCheck
    timeline: list[TimelinePoint]
    timings_ms: StageTimings
    disclaimer: str


class TimelineResponse(BaseModel):
    screening_id: str
    device_id: str
    total_windows: int
    thresholds: Thresholds
    timeline: list[TimelinePoint]


class ModelDescriptor(BaseModel):
    name: str
    version: str
    description: str
    is_default: bool
    feature_count: int
    features: list[str]
    window_size: int
    stride: int
    artifacts_available: bool
    missing_artifacts: list[str] = Field(default_factory=list)
    loaded: bool
    thresholds: Thresholds | None = Field(
        default=None, description="Present once the model has been loaded."
    )


class ModelListResponse(BaseModel):
    default_model: str
    models: list[ModelDescriptor]


class HealthResponse(BaseModel):
    status: str
    app: str
    version: str
    time: datetime
    models: dict[str, bool] = Field(description="model name -> artifacts present on disk")


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: ErrorBody
