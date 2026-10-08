import numpy as np
import pytest

from burninwatch.schemas.screening import ScreeningStatus as S
from burninwatch.services import preprocessing as pp
from burninwatch.services import windowing as w
from burninwatch.services.features import extract_features
from burninwatch.services.inference import aggregate_status, score_windows, window_status


def _features(df):
    c = pp.clean(df)
    return extract_features(w.build_windows(c.frame), pp.compute_baseline(c.frame))


@pytest.mark.parametrize("model", ["response_focused", "expanded"])
def test_inference_output(registry, settings, anomalous_frame, model):
    feats = _features(anomalous_frame)
    bundle = registry.get(model)
    s = score_windows(bundle, feats, settings)
    n = len(feats)
    assert len(s.if_scores) == len(s.ae_scores) == len(s.statuses) == n
    assert np.isfinite(s.if_scores).all() and (s.ae_scores >= 0).all()
    assert np.array_equal(s.if_flags, s.if_scores > bundle.if_threshold)
    assert np.array_equal(s.ae_flags, s.ae_scores > bundle.ae_threshold)


def test_inference_is_deterministic_and_does_not_mutate_models(registry, settings, frame):
    feats = _features(frame)
    b = registry.get("response_focused")
    thr = (b.if_threshold, b.ae_threshold)
    a1 = score_windows(b, feats, settings)
    a2 = score_windows(b, feats, settings)
    assert np.array_equal(a1.if_scores, a2.if_scores) and np.array_equal(a1.ae_scores, a2.ae_scores)
    assert thr == (b.if_threshold, b.ae_threshold)


def test_window_status_matrix():
    assert window_status(False, False) == S.NORMAL
    assert window_status(True, False) == S.REVIEW
    assert window_status(False, True) == S.REVIEW
    assert window_status(True, True) == S.ANOMALY


def test_aggregate_status():
    assert aggregate_status([S.NORMAL, S.NORMAL]) == S.NORMAL
    assert aggregate_status([S.NORMAL, S.REVIEW]) == S.REVIEW
    assert aggregate_status([S.REVIEW, S.ANOMALY, S.NORMAL]) == S.ANOMALY
