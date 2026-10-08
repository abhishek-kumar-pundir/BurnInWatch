"""Run the trained detectors on engineered windows. No fitting, no new thresholds.

Training-identical flow for BOTH detectors::

    features[ordered by artifact] -> SimpleImputer(median) -> RobustScaler -> model
    IF : score = -decision_function(X_scaled)           flag = score > IF threshold
    AE : score = mean((X_scaled - recon)^2)             flag = score > AE threshold
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from ..config import Settings
from ..errors import ModelArtifactError
from ..ml import autoencoder as ae_mod
from ..ml.model_registry import ModelBundle
from ..schemas.screening import ScreeningStatus


@dataclass(frozen=True)
class WindowScores:
    x: np.ndarray  # (n, F) raw engineered features, artifact column order
    if_scaled: np.ndarray  # (n, F) imputed + scaled input of the Isolation Forest
    ae_scaled: np.ndarray  # (n, F) imputed + scaled input of the Autoencoder
    ae_recon: np.ndarray  # (n, F) reconstruction in scaled space
    ae_feature_errors: np.ndarray  # (n, F) squared error per feature (scaled space)
    if_scores: np.ndarray
    ae_scores: np.ndarray
    if_flags: np.ndarray
    ae_flags: np.ndarray
    statuses: list[ScreeningStatus]
    n_imputed_cells: int


def window_status(if_flag: bool, ae_flag: bool) -> ScreeningStatus:
    """NORMAL: no detector flags; REVIEW: exactly one; ANOMALY: both."""
    n = int(bool(if_flag)) + int(bool(ae_flag))
    return (ScreeningStatus.NORMAL, ScreeningStatus.REVIEW, ScreeningStatus.ANOMALY)[n]


def aggregate_status(statuses) -> ScreeningStatus:
    """ANOMALY if any window is ANOMALY, else REVIEW if any is REVIEW, else NORMAL."""
    s = set(statuses)
    if ScreeningStatus.ANOMALY in s:
        return ScreeningStatus.ANOMALY
    if ScreeningStatus.REVIEW in s:
        return ScreeningStatus.REVIEW
    return ScreeningStatus.NORMAL


def select_features(bundle: ModelBundle, features: pd.DataFrame) -> np.ndarray:
    """Order columns exactly as the artifacts were trained; fail loudly otherwise."""
    cols = list(bundle.features)
    missing = [c for c in cols if c not in features.columns]
    if missing:
        raise ModelArtifactError(f"Feature pipeline did not produce: {missing}", code="FEATURE_MISMATCH")
    x = features[cols].to_numpy(dtype="float64")
    if np.isinf(x).any():
        raise ModelArtifactError("Infinite engineered feature values; cannot score.",
                                 code="NON_FINITE_FEATURES", status_code=422)
    return x


def score_windows(bundle: ModelBundle, features: pd.DataFrame, settings: Settings) -> WindowScores:
    x = select_features(bundle, features)
    n_imputed = int(np.isnan(x).sum())  # the trained imputer fills these with training medians

    if_scaled = bundle.scale_if(x)
    ae_scaled = bundle.scale_ae(x)
    if not (np.isfinite(if_scaled).all() and np.isfinite(ae_scaled).all()):
        raise ModelArtifactError("Preprocessed features contain NaN/inf.", code="NON_FINITE_FEATURES", status_code=422)

    if_scores = -np.asarray(bundle.if_model.decision_function(if_scaled), dtype="float64")
    recon = ae_mod.reconstruct(bundle.ae_net, ae_scaled, settings.ae_batch_size)
    ferr = ae_mod.feature_errors(ae_scaled, recon)
    ae_scores = ferr.mean(axis=1)

    if_flags = if_scores > bundle.if_threshold
    ae_flags = ae_scores > bundle.ae_threshold
    statuses = [window_status(a, b) for a, b in zip(if_flags, ae_flags)]
    return WindowScores(x, if_scaled, ae_scaled, recon, ferr, if_scores, ae_scores,
                        if_flags, ae_flags, statuses, n_imputed)
