"""Episodes, XAI maths and the live-pipeline invariants (synthetic artifacts)."""
import numpy as np
import pytest

from burninwatch.schemas.screening import ScreeningStatus as S
from burninwatch.services import xai
from burninwatch.services.episodes import group_windows
from burninwatch.services.repository import InMemoryScreeningRepository
from burninwatch.services.screening_service import ScreeningService
from conftest import make_test_frame, to_csv_bytes


def test_group_windows_merges_near_consecutive():
    assert [g.tolist() for g in group_windows(np.array([3, 4, 5, 9, 10, 20]), max_gap=2)] == [[3, 4, 5], [9, 10], [20]]
    # gap of exactly max_gap windows between 5 and 8 is merged; 3 windows between is not
    assert [g.tolist() for g in group_windows(np.array([5, 8]), max_gap=2)] == [[5, 8]]
    assert [g.tolist() for g in group_windows(np.array([5, 9]), max_gap=2)] == [[5], [9]]
    assert group_windows(np.array([], dtype=int), 2) == []


@pytest.fixture
def run(settings, registry):
    svc = ScreeningService(settings, registry, InMemoryScreeningRepository())
    r = svc.analyze(raw=to_csv_bytes(make_test_frame(3000, anomaly=True, seed=3)), filename="a.csv",
                    device_id="D1", model_name="response_focused")
    return svc, r


def test_episodes_are_consistent_with_timeline(run):
    svc, r = run
    anomaly_idx = [p.window_index for p in r.timeline if p.status == S.ANOMALY]
    assert r.episodes, "injected drift must create at least one episode"
    in_eps = sum(e.windows for e in r.episodes)
    assert in_eps == len(anomaly_idx) == r.summary.anomalous_windows
    assert r.summary.episodes == len(r.episodes) <= len(anomaly_idx)
    for e in r.episodes:
        tl = r.timeline[e.first_window : e.last_window + 1]
        assert e.start_time == tl[0].start_time and e.end_time == tl[-1].end_time
        assert e.duration_s == pytest.approx(e.end_time - e.start_time)
        anom = [p for p in tl if p.status == S.ANOMALY]
        assert e.windows == len(anom) and e.span_windows == len(tl)
        assert e.max_if_score == pytest.approx(max(p.isolation_forest_score for p in anom))
        assert e.max_ae_score == pytest.approx(max(p.autoencoder_score for p in anom))
        assert e.mean_ae_score == pytest.approx(np.mean([p.autoencoder_score for p in anom]), rel=1e-5)
        assert e.agreement_pct == pytest.approx(100 * np.mean([p.isolation_forest_flag and p.autoencoder_flag for p in tl]))
        assert e.top_features and e.top_features[0].mean_ae_error_share >= e.top_features[-1].mean_ae_error_share
        assert abs(sum(s.mean_ae_error_share for s in e.top_signals) - 1.0) < 1.0


def test_ae_feature_error_is_exact_decomposition(run):
    svc, r = run
    d = svc.repository.get_detail(r.screening_id)
    sc = d.scores
    assert np.allclose(sc.ae_feature_errors.mean(axis=1), sc.ae_scores)
    assert np.allclose(sc.ae_scores, [p.autoencoder_score for p in r.timeline], atol=1e-5)


def test_if_occlusion_matches_manual_substitution(run):
    svc, r = run
    d = svc.repository.get_detail(r.screening_id)
    b, sc = d.bundle, d.scores
    w = r.peak.window_index
    contrib = xai.if_occlusion(b, sc.if_scaled[w : w + 1])[0]
    row = sc.if_scaled[w].copy()
    base = -b.if_model.decision_function(row[None])[0]
    for j in (0, 5, len(row) - 1):
        alt = row.copy()
        alt[j] = 0.0  # training median in scaled space
        assert contrib[j] == pytest.approx(base - (-b.if_model.decision_function(alt[None])[0]))


def test_explanation_fields_are_consistent(run):
    svc, r = run
    w = svc.window(r.screening_id, r.peak.window_index)
    for f in w.features:
        assert f.deviation == pytest.approx(f.current_value - f.learned_normal_value)
        if f.pct_deviation is not None:
            assert f.pct_deviation == pytest.approx(100 * f.deviation / abs(f.learned_normal_value))
        assert f.direction == ("above" if f.deviation >= 0 else "below")
    text = " ".join(w.why_flagged).lower()
    assert "caus" not in text and "failure" not in text  # non-causal wording only


def test_flags_follow_thresholds_and_no_precomputed_results(run):
    svc, r = run
    for p in r.timeline:
        assert p.isolation_forest_flag == (p.isolation_forest_score > r.thresholds.isolation_forest)
        assert p.autoencoder_flag == (p.autoencoder_score > r.thresholds.autoencoder)


def test_different_uploads_give_different_results(settings, registry):
    svc = ScreeningService(settings, registry, InMemoryScreeningRepository())
    a = svc.analyze(raw=to_csv_bytes(make_test_frame(2000, seed=1)), filename="a.csv", device_id="A", model_name=None)
    b = svc.analyze(raw=to_csv_bytes(make_test_frame(2000, anomaly=True, seed=2)), filename="b.csv", device_id="B", model_name=None)
    assert [p.autoencoder_score for p in a.timeline] != [p.autoencoder_score for p in b.timeline]
    assert a.summary.max_ae_score != b.summary.max_ae_score


def test_distribution_check_flags_out_of_distribution_input(settings, registry):
    svc = ScreeningService(settings, registry, InMemoryScreeningRepository())
    df = make_test_frame(1500, seed=1)
    df["collectorEmitterCurrent"] = df["collectorEmitterCurrent"] * 1e4 + np.linspace(0, 5e4, len(df))  # wrong units
    r = svc.analyze(raw=to_csv_bytes(df), filename="u.csv", device_id="U", model_name=None)
    assert r.distribution_check.status == "suspect"
    assert any("NOT reliable" in w for w in r.input.warnings)
