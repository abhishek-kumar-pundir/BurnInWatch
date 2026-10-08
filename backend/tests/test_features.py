import numpy as np
import pandas as pd
import pytest

from burninwatch.ml.model_registry import EXPANDED_FEATURES, RESPONSE_FOCUSED_FEATURES
from burninwatch.services import preprocessing as pp
from burninwatch.services import windowing as w
from burninwatch.services.features import extract_features


@pytest.fixture
def prepared(frame):
    c = pp.clean(frame)
    b = pp.compute_baseline(c.frame)
    ws = w.build_windows(c.frame)
    return c.frame, b, ws


def test_all_model_features_are_produced_and_finite(prepared):
    _, b, ws = prepared
    f = extract_features(ws, b)
    assert set(EXPANDED_FEATURES) <= set(f.columns)
    assert set(RESPONSE_FOCUSED_FEATURES) <= set(f.columns)
    assert len(RESPONSE_FOCUSED_FEATURES) == 20 and len(EXPANDED_FEATURES) == 31
    assert np.isfinite(f.to_numpy()).all()


def test_values_match_pandas_reference(prepared):
    df, b, ws = prepared
    f = extract_features(ws, b)
    seg = df.iloc[50:150]  # window 2
    r = f.loc[2]
    assert r["node2Voltage_mean"] == pytest.approx(seg.node2Voltage.mean())
    assert r["node2Voltage_std"] == pytest.approx(seg.node2Voltage.std(ddof=0))  # population std, as in training
    assert r["collectorEmitterCurrent_q05"] == pytest.approx(seg.collectorEmitterCurrent.quantile(0.05))
    assert r["collectorEmitterCurrent_q95"] == pytest.approx(seg.collectorEmitterCurrent.quantile(0.95))
    assert r["packageTemperature_iqr"] == pytest.approx(
        seg.packageTemperature.quantile(0.75) - seg.packageTemperature.quantile(0.25)
    )
    assert r["packageTemperature_slope"] == pytest.approx(
        np.polyfit(np.arange(100), seg.packageTemperature, 1)[0]
    )


def test_relationship_features_match_notebook_definitions(prepared):
    df, b, ws = prepared
    f = extract_features(ws, b).loc[0]
    seg = df.iloc[:100]
    n1, n2, sup, cur = (seg.node1Voltage.mean(), seg.node2Voltage.mean(), seg.supplyVoltage.mean(),
                        seg.collectorEmitterCurrent.mean())
    assert f["supply_node1_mean_diff"] == pytest.approx(sup - n1)
    assert f["node1_node2_mean_diff"] == pytest.approx(n1 - n2)
    assert f["node_voltage_drop"] == pytest.approx(n1 - n2)  # NOT supply - node2
    assert f["current_per_node2V"] == pytest.approx(cur / abs(n2))
    assert f["estimated_power_proxy"] == pytest.approx(n2 * cur)  # NOT supply * current


def test_baseline_relative_features_are_fractions(prepared):
    df, b, ws = prepared
    f = extract_features(ws, b)
    ref = b.values["collectorEmitterCurrent"]
    d = f["collectorEmitterCurrent_mean"] - ref
    assert f["collectorEmitterCurrent_delta_from_baseline"].to_numpy() == pytest.approx(d.to_numpy())
    assert f["collectorEmitterCurrent_pct_change_from_baseline"].to_numpy() == pytest.approx((d / ref).to_numpy())


def test_constant_signal_no_nan(frame):
    f = frame.copy()
    f["node2Voltage"] = 5.0
    c = pp.clean(f)
    out = extract_features(w.build_windows(c.frame), pp.compute_baseline(c.frame))
    assert np.isfinite(out.to_numpy()).all()
    assert (out["node2Voltage_slope"].abs() < 1e-12).all()
