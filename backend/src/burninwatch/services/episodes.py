"""Anomaly-episode detection: merge overlapping/near-consecutive ANOMALY windows.

Windows overlap by 75 % (size 100, stride 25), so N consecutive anomalous windows are ONE
event, not N failures. Rule (documented in ``config.EpisodeConfig``): windows with status
ANOMALY (flagged by BOTH detectors) belong to the same episode when at most
``max_gap_windows`` other windows lie between them. Episode time spans from the first
window's first record to the last window's last record.
"""
from __future__ import annotations

import numpy as np

from ..config import EPISODES
from ..ml.model_registry import ModelBundle
from ..schemas.screening import Episode, EpisodeFeature, EpisodeSignal, ScreeningStatus
from .inference import WindowScores
from .windowing import WindowSet
from .xai import describe_feature


def group_windows(idx: np.ndarray, max_gap: int) -> list[np.ndarray]:
    """Split sorted window indices into groups whose consecutive gap is <= max_gap + 1."""
    if idx.size == 0:
        return []
    breaks = np.flatnonzero(np.diff(idx) > max_gap + 1) + 1
    return [g for g in np.split(idx, breaks) if g.size]


def detect_episodes(
    bundle: ModelBundle,
    windows: WindowSet,
    scores: WindowScores,
    if_contrib: np.ndarray,
    max_gap: int = EPISODES.max_gap_windows,
    top_n: int = 5,
) -> list[Episode]:
    anomalous = np.flatnonzero([s == ScreeningStatus.ANOMALY for s in scores.statuses])
    med, scale = bundle.reference_median, bundle.reference_scale
    names = list(bundle.features)
    episodes: list[Episode] = []
    for k, grp in enumerate(group_windows(anomalous, max_gap), start=1):
        first, last = int(grp[0]), int(grp[-1])
        span = np.arange(first, last + 1)
        t0, t1 = float(windows.start_times[first]), float(windows.end_times[last])
        both = scores.if_flags[span] & scores.ae_flags[span]
        review_in_span = int(sum(scores.statuses[i] == ScreeningStatus.REVIEW for i in span))

        # most affected features: mean AE error share over the episode's ANOMALY windows
        err = scores.ae_feature_errors[grp]
        tot = err.sum(axis=1, keepdims=True)
        share = np.divide(err, tot, out=np.zeros_like(err), where=tot > 0).mean(axis=0)
        ifc = if_contrib[grp]
        ifc_mean = np.where(np.isnan(ifc).all(axis=0), np.nan, np.nanmean(np.where(np.isnan(ifc), 0, ifc), axis=0))
        z = (scores.x[grp] - med) / np.where(scale > 0, scale, 1.0)
        z = np.where(np.isnan(z), 0.0, z)
        mean_z = z.mean(axis=0)
        order = np.argsort(-share)[:top_n]
        top_features = []
        for j in order:
            sig, label = describe_feature(names[j])
            top_features.append(
                EpisodeFeature(
                    feature=names[j], signal=sig, indicator=label,
                    mean_ae_error_share=float(share[j]),
                    mean_if_contribution=None if np.isnan(ifc_mean[j]) else float(ifc_mean[j]),
                    mean_abs_normalized_deviation=float(np.abs(z[:, j]).mean()),
                    direction="above" if mean_z[j] >= 0 else "below",
                )
            )
        by_signal: dict[str, float] = {}
        for j, nme in enumerate(names):
            s_, _ = describe_feature(nme)
            by_signal[s_] = by_signal.get(s_, 0.0) + float(share[j])
        top_signals = [EpisodeSignal(signal=s_, mean_ae_error_share=v)
                       for s_, v in sorted(by_signal.items(), key=lambda kv: -kv[1])[:top_n]]

        ae_ratio = scores.ae_scores[grp] / bundle.ae_threshold
        peak = int(grp[np.argmax(ae_ratio)])
        episodes.append(
            Episode(
                id=k, first_window=first, last_window=last,
                start_row=int(windows.start_rows[first]), end_row=int(windows.end_rows[last]),
                start_time=t0, end_time=t1, duration_s=t1 - t0,
                windows=int(grp.size), span_windows=int(span.size), review_windows_in_span=review_in_span,
                max_if_score=float(scores.if_scores[grp].max()), mean_if_score=float(scores.if_scores[grp].mean()),
                max_ae_score=float(scores.ae_scores[grp].max()), mean_ae_score=float(scores.ae_scores[grp].mean()),
                max_ae_to_threshold=float(ae_ratio.max()),
                max_if_margin=float(scores.if_scores[grp].max() - bundle.if_threshold),
                agreement_pct=float(100.0 * both.mean()),
                peak_window=peak, top_features=top_features, top_signals=top_signals,
            )
        )
    return episodes


def episode_rule_text(max_gap: int = EPISODES.max_gap_windows) -> str:
    return (
        "An anomaly episode merges windows flagged by BOTH detectors (status ANOMALY) when at most "
        f"{max_gap} other window(s) separate them. Windows overlap by 75 %, so consecutive anomalous "
        "windows describe one event. Severity = peak autoencoder error / its threshold."
    )
