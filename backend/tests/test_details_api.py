import numpy as np
import pytest

from burninwatch.schemas.dataset import DatasetValidationResponse
from burninwatch.schemas.details import (
    ScreeningListResponse,
    SignalSeriesResponse,
    WindowDetailResponse,
)
from burninwatch.services.series import downsample_minmax


def _analyze(client, upload, df, device="IGBT-001", model="response_focused"):
    r = client.post(
        "/api/v1/screenings/analyze", files=upload(df), data={"device_id": device, "model": model}
    )
    assert r.status_code == 201, r.text
    return r.json()


# ---- dataset validation ----------------------------------------------------
def test_validate_ok(client, upload, frame):
    r = client.post("/api/v1/datasets/validate", files=upload(frame))
    assert r.status_code == 200
    v = DatasetValidationResponse.model_validate(r.json())
    assert v.valid and v.total_rows == 1000 and v.expected_windows == 37
    assert [c.status for c in v.checks] == ["pass"] * 6
    assert v.duration == frame["timeEpoch"].max() - frame["timeEpoch"].min()


def test_validate_missing_column_reports_hint(client, upload, frame):
    bad = frame.rename(columns={"collectorEmitterCurrent": "collectorCurrent"})
    v = DatasetValidationResponse.model_validate(
        client.post("/api/v1/datasets/validate", files=upload(bad)).json()
    )
    assert not v.valid and v.missing_columns == ["collectorEmitterCurrent"]
    assert "collectorCurrent" in v.columns_found
    assert "collectorCurrent" in v.column_hints["collectorEmitterCurrent"]
    assert {c.id: c.status for c in v.checks}["columns"] == "fail"
    assert {c.id: c.status for c in v.checks}["records"] == "skipped"


def test_validate_too_few_rows_and_warnings(client, upload, frame):
    v = DatasetValidationResponse.model_validate(
        client.post("/api/v1/datasets/validate", files=upload(frame.head(60))).json()
    )
    assert not v.valid and {c.id: c.status for c in v.checks}["records"] == "fail"
    shuffled = frame.sample(frac=1.0, random_state=2)
    v2 = DatasetValidationResponse.model_validate(
        client.post("/api/v1/datasets/validate", files=upload(shuffled)).json()
    )
    assert v2.valid and {c.id: c.status for c in v2.checks}["order"] == "warn"


def test_validate_upload_level_errors(client, upload, frame):
    assert client.post("/api/v1/datasets/validate", files=upload(frame, name="x.txt")).status_code == 415


def test_analyze_missing_columns_error_lists_found_columns(client, upload, frame):
    r = client.post(
        "/api/v1/screenings/analyze",
        files=upload(frame.drop(columns=["node1Voltage"])),
        data={"device_id": "D"},
    )
    assert "node2Voltage" in r.json()["error"]["details"]["found_columns"]


# ---- history ---------------------------------------------------------------
def test_history_lists_newest_first(client, upload, frame, anomalous_frame):
    assert client.get("/api/v1/screenings").json()["total"] == 0
    a = _analyze(client, upload, frame, "A")
    b = _analyze(client, upload, anomalous_frame, "B")
    lst = ScreeningListResponse.model_validate(client.get("/api/v1/screenings").json())
    assert [i.screening_id for i in lst.items] == [b["screening_id"], a["screening_id"]]
    assert lst.items[0].device_id == "B" and lst.storage == "memory"


# ---- summary additions ------------------------------------------------------
def test_agreement_and_timings(client, upload, anomalous_frame):
    body = _analyze(client, upload, anomalous_frame)
    ag, tl = body["summary"]["agreement"], body["timeline"]
    both = sum(p["isolation_forest_flag"] and p["autoencoder_flag"] for p in tl)
    assert ag["both"] == both
    assert ag["isolation_forest_flagged"] == ag["both"] + ag["isolation_forest_only"]
    assert ag["autoencoder_flagged"] == ag["both"] + ag["autoencoder_only"]
    assert body["summary"]["anomalous_windows"] == both
    t = body["timings_ms"]
    assert t["total_ms"] >= t["inference_ms"] >= 0


# ---- window detail ----------------------------------------------------------
def test_window_detail(client, upload, anomalous_frame):
    body = _analyze(client, upload, anomalous_frame)
    idx = body["peak"]["window_index"]
    r = client.get(f"/api/v1/screenings/{body['screening_id']}/windows/{idx}")
    assert r.status_code == 200
    w = WindowDetailResponse.model_validate(r.json())
    p = body["timeline"][idx]
    assert w.status == p["status"] and w.record_count == 100
    assert w.isolation_forest_threshold == body["thresholds"]["isolation_forest"]
    assert w.detection == ("both" if w.status == "ANOMALY" else "none" if w.status == "NORMAL" else w.detection)
    assert len(w.signal_levels) == 7 and len(w.features) == 20
    assert len(w.raw_time) == 100 and set(w.raw_measurements) >= {"packageTemperature", "heatSinkTemperature"}
    assert w.why_flagged and any("threshold" in line for line in w.why_flagged)
    assert abs(sum(f.ae_error_share for f in w.features) - 1.0) < 1e-9  # AE shares sum to 1
    assert sum(f.ae_error for f in w.features) / len(w.features) == pytest.approx(w.autoencoder_score, rel=1e-4)
    assert [n.window_index for n in w.nearby if n.is_selected] == [idx]
    cur = next(s for s in w.signal_levels if s.signal == "collectorEmitterCurrent")
    assert cur.baseline_median is not None
    assert cur.delta_from_baseline == cur.window_mean - cur.baseline_median
    assert next(s for s in w.signal_levels if s.signal == "supplyVoltage").baseline_median is None


def test_window_not_found(client, upload, frame):
    sid = _analyze(client, upload, frame)["screening_id"]
    r = client.get(f"/api/v1/screenings/{sid}/windows/9999")
    assert r.status_code == 404 and r.json()["error"]["code"] == "WINDOW_NOT_FOUND"
    assert client.get("/api/v1/screenings/scr_nope/windows/0").status_code == 404


# ---- signal series ----------------------------------------------------------
def test_signal_series(client, upload, anomalous_frame):
    body = _analyze(client, upload, anomalous_frame)
    r = client.get(
        f"/api/v1/screenings/{body['screening_id']}/signals/packageTemperature", params={"max_points": 200}
    )
    s = SignalSeriesResponse.model_validate(r.json())
    assert s.total_points == 1000 and s.downsampled and s.returned_points <= 200
    assert len(s.time) == len(s.value) == s.returned_points
    assert s.time == sorted(s.time)
    assert s.baseline is not None and s.baseline.rows == 20  # training rule: max(20, 10 % of 20 %)
    assert len(s.flagged_windows) == body["summary"]["review_windows"] + body["summary"]["anomalous_windows"]
    assert max(s.value) == anomalous_frame["packageTemperature"].max()  # spikes preserved


def test_signal_series_zoom_and_all_measured_signals(client, upload, frame):
    sid = _analyze(client, upload, frame)["screening_id"]
    for sig in ("supplyVoltage", "node1Voltage", "heatSinkTemperature", "internalTemperature"):
        assert client.get(f"/api/v1/screenings/{sid}/signals/{sig}").status_code == 200
    t0 = float(frame["timeEpoch"].iloc[200])
    t1 = float(frame["timeEpoch"].iloc[399])
    z = client.get(f"/api/v1/screenings/{sid}/signals/node2Voltage", params={"start": t0, "end": t1}).json()
    assert z["total_points"] == 200 and z["range_start"] == t0 and z["range_end"] == t1


def test_unknown_signal(client, upload, frame):
    sid = _analyze(client, upload, frame)["screening_id"]
    r = client.get(f"/api/v1/screenings/{sid}/signals/ambientTemperature")
    assert r.status_code == 422 and r.json()["error"]["code"] == "UNKNOWN_SIGNAL"


def test_detail_evicted(settings, upload, frame):
    from fastapi.testclient import TestClient

    from burninwatch.main import create_app
    from burninwatch.services.repository import InMemoryScreeningRepository

    c = TestClient(create_app(settings, repository=InMemoryScreeningRepository(max_details=1)))
    first = _analyze(c, upload, frame, "A")["screening_id"]
    _analyze(c, upload, frame, "B")
    assert c.get(f"/api/v1/screenings/{first}").status_code == 200
    r = c.get(f"/api/v1/screenings/{first}/windows/0")
    assert r.status_code == 404 and r.json()["error"]["code"] == "DETAIL_UNAVAILABLE"


def test_downsample_keeps_extremes_and_order():
    t = np.arange(10000, dtype=float)
    v = np.zeros(10000)
    v[4321], v[777] = 9.0, -9.0
    dt, dv = downsample_minmax(t, v, 300)
    assert len(dt) <= 300 and (np.diff(dt) > 0).all() and dv.max() == 9.0 and dv.min() == -9.0
    assert downsample_minmax(t[:100], v[:100], 300)[0].shape == (100,)
