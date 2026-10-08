from burninwatch.schemas.screening import ScreeningResponse, TimelineResponse


def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok" and r.json()["models"] == {"response_focused": True, "expanded": True}


def test_models_endpoint(client):
    r = client.get("/api/v1/models").json()
    assert r["default_model"] == "response_focused"
    counts = {m["name"]: m["feature_count"] for m in r["models"]}
    assert counts == {"response_focused": 20, "expanded": 31}


def test_analyze_end_to_end_matches_schema(client, upload, anomalous_frame):
    r = client.post(
        "/api/v1/screenings/analyze",
        files=upload(anomalous_frame),
        data={"device_id": "IGBT-001", "model": "response_focused"},
    )
    assert r.status_code == 201, r.text
    body = ScreeningResponse.model_validate(r.json())
    assert body.model.window_size == 100 and body.model.stride == 25 and body.model.feature_count == 20
    assert body.input.total_rows == 1000 and body.input.windows == 37 == len(body.timeline)
    s = body.summary
    assert s.normal_windows + s.review_windows + s.anomalous_windows == s.total_windows
    assert s.anomaly_fraction == round(s.anomalous_windows / s.total_windows, 4)
    assert [p.window_index for p in body.timeline] == list(range(37))
    assert body.thresholds.isolation_forest > 0

    sid = body.screening_id
    assert ScreeningResponse.model_validate(client.get(f"/api/v1/screenings/{sid}").json())
    tl = TimelineResponse.model_validate(client.get(f"/api/v1/screenings/{sid}/timeline").json())
    assert tl.total_windows == 37


def test_default_model_when_omitted(client, upload, frame):
    r = client.post("/api/v1/screenings/analyze", files=upload(frame), data={"device_id": "D1"})
    assert r.status_code == 201 and r.json()["model"]["name"] == "response_focused"


def test_expanded_model(client, upload, frame):
    r = client.post(
        "/api/v1/screenings/analyze", files=upload(frame), data={"device_id": "D1", "model": "expanded"}
    )
    assert r.status_code == 201 and r.json()["model"]["feature_count"] == 31


def test_unknown_model_and_path_injection(client, upload, frame):
    for m in ("nope", "../../models/x.joblib"):
        r = client.post("/api/v1/screenings/analyze", files=upload(frame), data={"device_id": "D", "model": m})
        assert r.status_code == 422 and r.json()["error"]["code"] == "UNKNOWN_MODEL"


def test_missing_column_error(client, upload, frame):
    r = client.post(
        "/api/v1/screenings/analyze",
        files=upload(frame.drop(columns=["node1Voltage"])),
        data={"device_id": "D"},
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "MISSING_COLUMNS"
    assert r.json()["error"]["details"]["missing_columns"] == ["node1Voltage"]


def test_too_few_rows(client, upload, frame):
    r = client.post("/api/v1/screenings/analyze", files=upload(frame.head(60)), data={"device_id": "D"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "INSUFFICIENT_DATA"


def test_non_csv_rejected(client, upload, frame):
    r = client.post("/api/v1/screenings/analyze", files=upload(frame, name="x.exe"), data={"device_id": "D"})
    assert r.status_code == 415


def test_bad_device_id(client, upload, frame):
    r = client.post("/api/v1/screenings/analyze", files=upload(frame), data={"device_id": "../x y"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "INVALID_DEVICE_ID"


def test_missing_device_id_is_envelope(client, upload, frame):
    r = client.post("/api/v1/screenings/analyze", files=upload(frame))
    assert r.status_code == 422 and r.json()["error"]["code"] == "REQUEST_VALIDATION_ERROR"


def test_unknown_screening_404(client):
    assert client.get("/api/v1/screenings/scr_missing").status_code == 404


def test_upload_too_large(settings, upload, frame):
    from fastapi.testclient import TestClient

    from burninwatch.config import Settings
    from burninwatch.main import create_app

    tiny = Settings(models_dir=settings.models_dir, max_upload_mb=0)
    r = TestClient(create_app(tiny)).post(
        "/api/v1/screenings/analyze", files=upload(frame), data={"device_id": "D"}
    )
    assert r.status_code == 413


def test_missing_model_artifacts_503(tmp_path, upload, frame):
    from fastapi.testclient import TestClient

    from burninwatch.config import Settings
    from burninwatch.main import create_app

    r = TestClient(create_app(Settings(models_dir=tmp_path))).post(
        "/api/v1/screenings/analyze", files=upload(frame), data={"device_id": "D"}
    )
    assert r.status_code == 503 and r.json()["error"]["code"] == "MODEL_UNAVAILABLE"


def test_cors_header(client):
    r = client.options(
        "/api/v1/health",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"
