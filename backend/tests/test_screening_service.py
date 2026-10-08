from burninwatch.schemas.screening import ScreeningStatus as S
from burninwatch.services.repository import InMemoryScreeningRepository
from burninwatch.services.screening_service import ScreeningService
from conftest import to_csv_bytes


def _svc(settings, registry):
    return ScreeningService(settings, registry, InMemoryScreeningRepository())


def test_anomaly_is_detected_in_late_windows(settings, registry, anomalous_frame):
    r = _svc(settings, registry).analyze(
        raw=to_csv_bytes(anomalous_frame), filename="a.csv", device_id="D1", model_name=None
    )
    assert r.summary.status in (S.REVIEW, S.ANOMALY)
    assert r.peak.window_index >= r.summary.total_windows // 2
    assert r.top_features and r.episodes
    assert abs(sum(f.ae_error_share for f in r.top_features) - 1.0) < 1.0  # shares are fractions
    assert "not a prediction" in r.disclaimer


def test_summary_consistent_with_timeline(settings, registry, frame):
    r = _svc(settings, registry).analyze(
        raw=to_csv_bytes(frame), filename="n.csv", device_id="D1", model_name="expanded"
    )
    st = [p.status for p in r.timeline]
    assert r.summary.normal_windows == st.count(S.NORMAL)
    assert r.summary.review_windows == st.count(S.REVIEW)
    assert r.summary.anomalous_windows == st.count(S.ANOMALY)
    for p in r.timeline:
        assert (p.isolation_forest_flag + p.autoencoder_flag) == [S.NORMAL, S.REVIEW, S.ANOMALY].index(p.status)
