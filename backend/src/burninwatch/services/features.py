"""Window feature engineering - an exact vectorised port of notebook 12 ``extract_features``.

Computes the *full* feature universe once per upload; each model configuration then selects
its own ordered subset (artifact feature list). No fitting happens here.

Definitions (verified against ``burninwatch_expanded_overlapping_windows_v2.csv``, max
relative difference ~1e-12, see ``scripts/verify_parity.py``):

* mean / std / q05 / q95 / iqr - over the 100 records of a window. ``std`` is the
  POPULATION std (numpy ``ddof=0``). Quantiles use numpy's default linear interpolation.
  ``iqr = q75 - q25``.
* slope   - least-squares slope of value vs. record index 0..99.
* supply_node1_mean_diff = supplyVoltage_mean - node1Voltage_mean
* node1_node2_mean_diff  = node1Voltage_mean  - node2Voltage_mean
* node_voltage_drop      = node1Voltage_mean  - node2Voltage_mean   (NOT supply - node2)
* current_per_node2V     = collectorEmitterCurrent_mean / max(|node2Voltage_mean|, 1e-9)
* estimated_power_proxy  = node2Voltage_mean * collectorEmitterCurrent_mean   (NOT supply * I)
* <sig>_delta_from_baseline      = window mean - baseline median
* <sig>_pct_change_from_baseline = delta / max(|baseline median|, 1e-9)       (a FRACTION, not %)
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .preprocessing import Baseline
from .windowing import WindowSet

EPS = 1e-9

STAT_SIGNALS: tuple[str, ...] = (
    "supplyVoltage",
    "node2Voltage",
    "collectorEmitterCurrent",
    "packageTemperature",
)
BASELINE_RELATIVE_SIGNALS: tuple[str, ...] = (
    "node2Voltage",
    "collectorEmitterCurrent",
    "packageTemperature",
)


def _slope(values: np.ndarray) -> np.ndarray:
    """Vectorised least-squares slope vs. record index, per window (row)."""
    n = values.shape[1]
    xc = np.arange(n, dtype="float64") - (n - 1) / 2.0
    vc = values - values.mean(axis=1, keepdims=True)
    denom = float((xc * xc).sum())
    return (vc * xc).sum(axis=1) / denom if denom > 0 else np.zeros(len(values))


def extract_features(windows: WindowSet, baseline: Baseline) -> pd.DataFrame:
    """Return a DataFrame (one row per window) with every engineered feature."""
    a = windows.arrays
    feats: dict[str, np.ndarray] = {}

    for sig in STAT_SIGNALS:
        v = a[sig]
        q05, q25, q75, q95 = np.quantile(v, [0.05, 0.25, 0.75, 0.95], axis=1)
        feats[f"{sig}_mean"] = v.mean(axis=1)
        feats[f"{sig}_std"] = v.std(axis=1)  # ddof=0, as in training
        feats[f"{sig}_q05"] = q05
        feats[f"{sig}_q95"] = q95
        feats[f"{sig}_iqr"] = q75 - q25
        feats[f"{sig}_slope"] = _slope(v)

    n1 = a["node1Voltage"].mean(axis=1)
    sup, n2 = feats["supplyVoltage_mean"], feats["node2Voltage_mean"]
    cur = feats["collectorEmitterCurrent_mean"]
    feats["supply_node1_mean_diff"] = sup - n1
    feats["node1_node2_mean_diff"] = n1 - n2
    feats["node_voltage_drop"] = n1 - n2
    feats["current_per_node2V"] = cur / np.maximum(np.abs(n2), EPS)
    feats["estimated_power_proxy"] = n2 * cur

    for sig in BASELINE_RELATIVE_SIGNALS:
        ref = baseline.values[sig]
        delta = feats[f"{sig}_mean"] - ref
        feats[f"{sig}_delta_from_baseline"] = delta
        feats[f"{sig}_pct_change_from_baseline"] = delta / max(abs(ref), EPS)

    return pd.DataFrame(feats)
