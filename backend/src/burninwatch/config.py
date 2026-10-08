"""Configuration.

Two kinds of configuration live here:

1. ``PIPELINE`` constants - the *model contract* (window size, stride, baseline
   rule, required columns). These are fixed by how the models were trained and
   are deliberately NOT overridable through environment variables.
2. ``Settings`` - deployment settings (paths, CORS, upload limit, ...) that can be
   overridden with ``BURNINWATCH_*`` environment variables or a ``.env`` file.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# backend/src/burninwatch/config.py -> parents[2] == backend/
BACKEND_ROOT = Path(__file__).resolve().parents[2]

# --------------------------------------------------------------------------- #
# Pipeline contract (fixed by the trained models)
# --------------------------------------------------------------------------- #
REQUIRED_COLUMNS: tuple[str, ...] = (
    "timeEpoch",
    "supplyVoltage",
    "node1Voltage",
    "node2Voltage",
    "collectorEmitterCurrent",
    "heatSinkTemperature",
    "packageTemperature",
    "internalTemperature",
)
OPTIONAL_COLUMNS: tuple[str, ...] = ("ambientTemperature", "measurement_valid")

# Signals used by the trained feature extractor. NOTE: the training notebook (12) dropped
# every row with a missing value in ANY of the 8 required numeric columns, so cleaning
# here does the same (see preprocessing.filter_rows) even though heatSink / internal
# temperature feed no feature.
FEATURE_SIGNALS: tuple[str, ...] = (
    "supplyVoltage",
    "node1Voltage",
    "node2Voltage",
    "collectorEmitterCurrent",
    "packageTemperature",
)
# Measured signals shown on the raw-signal timeline (timeEpoch excluded).
MEASURED_SIGNALS: tuple[str, ...] = tuple(c for c in REQUIRED_COLUMNS if c != "timeEpoch")
BASELINE_SIGNALS: tuple[str, ...] = (
    "node2Voltage",
    "collectorEmitterCurrent",
    "packageTemperature",
)


class PipelineConfig:
    """Fixed by notebook 12 (BurnInWatch_Expanded_Modeling) - NOT configurable.

    Baseline rule used in training, per file: ``train_n = floor(0.20 * n)`` rows form the
    baseline-train segment; the reference region is its first
    ``max(20, int(0.10 * train_n))`` rows; baseline = median of node2Voltage,
    collectorEmitterCurrent and packageTemperature over that region.
    """

    window_size: int = 100
    stride: int = 25
    train_fraction: float = 0.20
    baseline_fraction: float = 0.10  # of the train segment (i.e. ~2 % of the file)
    baseline_min_rows: int = 20
    # Minimum cleaned rows needed to form at least one window.
    min_rows: int = 100
    # Training skipped files shorter than 3 windows; shorter uploads get a warning.
    recommended_min_rows: int = 300


class EpisodeConfig:
    """Anomaly-episode merging rule (documented, not learned)."""

    # Windows with status ANOMALY (both detectors flag) are merged into one episode when
    # at most this many non-ANOMALY windows lie between them. With stride 25 and window
    # 100, adjacent windows share 75 % of their rows, so 2 windows ~ 50 rows of tolerance.
    max_gap_windows: int = 2


PIPELINE = PipelineConfig()
EPISODES = EpisodeConfig()

DISCLAIMER = (
    "BurnInWatch produces unsupervised anomaly-screening signals. A REVIEW or ANOMALY "
    "status means the measurements deviate from what the models learned as typical; "
    "it is not a prediction or guarantee of component failure, and listed abnormal "
    "signals are not causal explanations."
)


# --------------------------------------------------------------------------- #
# Deployment settings
# --------------------------------------------------------------------------- #
class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="BURNINWATCH_",
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "BurnInWatch API"
    api_prefix: str = "/api/v1"
    log_level: str = "INFO"

    models_dir: Path = BACKEND_ROOT / "models"
    default_model: str = "response_focused"
    evaluation_file: Path = BACKEND_ROOT / "evaluation" / "offline_evaluation.json"
    preload_models: bool = False

    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    max_upload_mb: int = 25
    repository_max_items: int = 500

    # Reserved for artifacts that contain non-tensor pickled objects (off by default).
    allow_unsafe_torch_load: bool = False
    ae_batch_size: int = 2048

    # Explainability limits.
    xai_top_features: int = 10
    xai_max_if_windows: int = 4000  # cap for IF occlusion attribution on very large uploads

    @field_validator("models_dir", mode="after")
    @classmethod
    def _resolve_models_dir(cls, v: Path) -> Path:
        return v if v.is_absolute() else (BACKEND_ROOT / v).resolve()

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str):
            s = v.strip()
            if s.startswith("["):
                return json.loads(s)
            return [o.strip() for o in s.split(",") if o.strip()]
        return v

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
