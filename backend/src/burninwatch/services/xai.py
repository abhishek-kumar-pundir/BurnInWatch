"""Explainability computed from the actual run (nothing fitted, nothing precomputed).

Three complementary, mathematically explicit views per window; all are DESCRIPTIVE
("associated with", "contributed to the score") and never causal claims about failure:

1. **Deviation from learned normal** - ``(value - training median) / training IQR`` using the
   fitted ``RobustScaler`` stored in the artifacts (the model's own definition of normal).
2. **Autoencoder per-feature reconstruction error** - ``(scaled actual - scaled reconstruction)^2``;
   the window's AE score is exactly the mean of these, so shares sum to 1.
3. **Isolation Forest reference-substitution (occlusion) attribution** - for feature j,
   ``score(x) - score(x with feature j replaced by its training median)``. Positive = that
   feature pushed the window towards "anomalous". This is a single-feature counterfactual
   against the learned-normal reference, NOT SHAP: contributions are not guaranteed to sum to
   the score (interactions are ignored). SHAP's TreeExplainer was not used to keep the
   runtime dependency set small; the method is exact for what it states.
"""
from __future__ import annotations

import numpy as np

from ..ml.model_registry import ModelBundle
from ..schemas.screening import FeatureExplanation
from .inference import WindowScores

PCT_MIN_REFERENCE = 1e-6  # |learned normal| below this -> percentage deviation undefined

_SUFFIXES = (
    ("_pct_change_from_baseline", "relative change from baseline"),
    ("_delta_from_baseline", "absolute change from baseline"),
    ("_iqr", "spread (IQR)"),
    ("_std", "variation (std)"),
    ("_slope", "trend (slope) within window"),
    ("_q05", "lower-tail level (q05)"),
    ("_q95", "upper-tail level (q95)"),
    ("_mean", "window level (mean)"),
)


def describe_feature(feature: str) -> tuple[str, str]:
    """Return (base signal, indicator label)."""
    for suffix, label in _SUFFIXES:
        if feature.endswith(suffix):
            return feature[: -len(suffix)], label
    return feature, "derived relationship"


def if_occlusion(bundle: ModelBundle, if_scaled: np.ndarray, chunk: int = 400) -> np.ndarray:
    """IF reference-substitution attribution for each row of ``if_scaled`` -> (m, F)."""
    m, f = if_scaled.shape
    out = np.empty((m, f), dtype="float64")
    for s in range(0, m, chunk):
        rows = if_scaled[s : s + chunk]
        k = len(rows)
        base = -bundle.if_model.decision_function(rows)
        variants = np.repeat(rows[:, None, :], f, axis=1)  # (k, F, F)
        idx = np.arange(f)
        variants[:, idx, idx] = 0.0  # scaled 0 == training median (RobustScaler centre)
        sub = -bundle.if_model.decision_function(variants.reshape(k * f, f)).reshape(k, f)
        out[s : s + k] = base[:, None] - sub
    return out


def if_contributions_for_flagged(
    bundle: ModelBundle, scores: WindowScores, max_windows: int
) -> np.ndarray:
    """(n, F) matrix; NaN for windows that were not computed (not flagged / over the cap)."""
    n, f = scores.if_scaled.shape
    out = np.full((n, f), np.nan)
    flagged = np.flatnonzero(scores.if_flags | scores.ae_flags)
    if flagged.size > max_windows:  # keep the highest-scoring ones
        flagged = flagged[np.argsort(-scores.if_scores[flagged])[:max_windows]]
    if flagged.size:
        out[flagged] = if_occlusion(bundle, scores.if_scaled[flagged])
    return out


def explain_window(
    bundle: ModelBundle,
    scores: WindowScores,
    w: int,
    if_contrib_row: np.ndarray | None,
) -> list[FeatureExplanation]:
    """All model features for window ``w`` (unsorted, artifact order)."""
    med, scale = bundle.reference_median, bundle.reference_scale
    x = scores.x[w]
    # a NaN feature was imputed with the training median -> zero deviation by construction
    cur = np.where(np.isnan(x), med, x)
    err = scores.ae_feature_errors[w]
    tot = float(err.sum())
    recon_orig = scores.ae_recon[w].astype("float64") * scale + med
    out: list[FeatureExplanation] = []
    for j, name in enumerate(bundle.features):
        dev = float(cur[j] - med[j])
        base, label = describe_feature(name)
        out.append(
            FeatureExplanation(
                feature=name,
                signal=base,
                indicator=label,
                current_value=float(cur[j]),
                learned_normal_value=float(med[j]),
                reconstructed_value=float(recon_orig[j]),
                deviation=dev,
                pct_deviation=(100.0 * dev / abs(med[j])) if abs(med[j]) >= PCT_MIN_REFERENCE else None,
                normalized_deviation=float(dev / scale[j]) if scale[j] > 0 else 0.0,
                ae_error=float(err[j]),
                ae_error_share=float(err[j] / tot) if tot > 0 else 0.0,
                if_contribution=(
                    None if if_contrib_row is None or np.isnan(if_contrib_row[j]) else float(if_contrib_row[j])
                ),
                direction="above" if dev >= 0 else "below",
            )
        )
    return out


def rank(features: list[FeatureExplanation], by: str = "ae_error_share", limit: int | None = None):
    keys = {
        "ae_error_share": lambda f: f.ae_error_share,
        "normalized_deviation": lambda f: abs(f.normalized_deviation),
        "if_contribution": lambda f: f.if_contribution if f.if_contribution is not None else -np.inf,
    }
    out = sorted(features, key=keys[by], reverse=True)
    return out[:limit] if limit else out


def why_flagged(
    *, if_score: float, if_thr: float, ae_score: float, ae_thr: float,
    features: list[FeatureExplanation], status: str,
) -> list[str]:
    """Plain-language, data-derived reasons. Wording is deliberately non-causal."""
    lines: list[str] = []
    if status == "NORMAL":
        lines.append("Neither detector flagged this window.")
    if if_score > if_thr:
        lines.append(f"Isolation Forest score {if_score:.3f} is above its threshold {if_thr:.3f}.")
    else:
        lines.append(f"Isolation Forest score {if_score:.3f} is within its threshold {if_thr:.3f}.")
    ratio = ae_score / ae_thr if ae_thr > 0 else float("nan")
    if ae_score > ae_thr:
        lines.append(f"Autoencoder reconstruction error {ae_score:.3f} is above its threshold {ae_thr:.3f} ({ratio:.1f}x).")
    else:
        lines.append(f"Autoencoder reconstruction error {ae_score:.3f} is within its threshold {ae_thr:.3f}.")
    for f in rank(features, "ae_error_share", 3):
        if f.ae_error_share < 0.05:
            continue
        lines.append(
            f"{f.indicator.capitalize()} of {f.signal} contributed {100 * f.ae_error_share:.0f}% of the "
            f"autoencoder reconstruction error and deviated from learned normal behavior "
            f"({f.normalized_deviation:+.1f} training-IQR units, {f.direction} the learned-normal value)."
        )
    ifc = [f for f in features if f.if_contribution is not None and f.if_contribution > 0]
    for f in sorted(ifc, key=lambda f: -f.if_contribution)[:2]:
        lines.append(
            f"{f.indicator.capitalize()} of {f.signal} contributed {f.if_contribution:+.3f} to the "
            f"Isolation Forest anomaly score (reference-substitution)."
        )
    return lines
