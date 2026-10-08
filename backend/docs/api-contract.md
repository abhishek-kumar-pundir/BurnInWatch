# BurnInWatch API contract (v1)

Base URL (dev): `http://localhost:8000/api/v1` · JSON · CORS for `http://localhost:5173`.

## Errors

All errors share one envelope:

```json
{"error": {"code": "MISSING_COLUMNS", "message": "CSV is missing required column(s): node1Voltage.", "details": {"missing_columns": ["node1Voltage"]}}}
```

| HTTP | code | When |
|---|---|---|
| 400 | `INVALID_UPLOAD`, `NO_FILE`, `EMPTY_FILE` | no/empty file |
| 413 | `UPLOAD_TOO_LARGE` | over `max_upload_mb` |
| 415 | `UNSUPPORTED_FILE_TYPE` | not `.csv` / wrong MIME |
| 422 | `MISSING_COLUMNS`, `INVALID_CSV`, `EMPTY_CSV`, `INSUFFICIENT_DATA` | CSV problems (`< 100` usable rows etc.) |
| 422 | `UNKNOWN_MODEL`, `INVALID_DEVICE_ID`, `REQUEST_VALIDATION_ERROR` | bad form fields |
| 422 | `NON_FINITE_FEATURES` | features could not be scored |
| 404 | `SCREENING_NOT_FOUND` | unknown id |
| 404 | `WINDOW_NOT_FOUND`, `DETAIL_UNAVAILABLE` | window index out of range; drill-down data evicted (only the 25 most recent screenings keep it) |
| 422 | `UNKNOWN_SIGNAL` | signal not one of the five measured series |
| 503 | `MODEL_UNAVAILABLE`, `FEATURE_MISMATCH` | artifacts missing / inconsistent |
| 500 | `INTERNAL_ERROR` | unexpected |

## GET /health → 200

```json
{"status": "ok", "app": "BurnInWatch API", "version": "0.1.0", "time": "2026-10-01T09:00:00Z",
 "models": {"response_focused": true, "expanded": true}}
```
`status` is `"degraded"` if any model's artifact files are missing. Models are not loaded by this call.

## GET /models → 200

```json
{"default_model": "response_focused",
 "models": [{"name": "response_focused", "version": "v2", "description": "...", "is_default": true,
   "feature_count": 20, "features": ["node2Voltage_std", "..."], "window_size": 100, "stride": 25,
   "artifacts_available": true, "missing_artifacts": [], "loaded": false, "thresholds": null}]}
```
`thresholds` is `{"isolation_forest": n, "autoencoder": n}` once the model has been loaded.

## POST /datasets/validate → 200

Pre-flight check with the **same parsing and cleaning rules as analysis**, no model involved.
`multipart/form-data` with `file` only. Problems *inside* the file are reported as `valid: false` with
per-check results (HTTP 200); only upload-level problems (type, size, empty) raise HTTP errors.

```json
{
  "valid": false, "filename": "burnin.csv", "size_bytes": 405312,
  "total_rows": 3000, "valid_rows": null, "dropped_rows": null,
  "columns_found": ["timeEpoch", "collectorCurrent", "..."],
  "required_columns": ["timeEpoch", "supplyVoltage", "..."],
  "missing_columns": ["collectorEmitterCurrent"],
  "column_hints": {"collectorEmitterCurrent": ["collectorCurrent"]},
  "time_start": 1000.0, "time_end": 1599.8, "duration": 599.8, "expected_windows": null,
  "window_size": 100, "stride": 25, "min_rows": 100,
  "checks": [
    {"id": "readable", "label": "CSV readable", "status": "pass", "detail": "3,000 records, 8 columns."},
    {"id": "columns", "label": "Required columns detected", "status": "fail", "detail": "Missing required column(s): collectorEmitterCurrent."},
    {"id": "numeric", "label": "Numeric measurements valid", "status": "skipped", "detail": "Not evaluated because an earlier check failed."}
  ]
}
```
Check ids: `readable`, `columns`, `numeric`, `timestamp`, `order`, `records`. Status: `pass | warn | fail | skipped`.
`valid` is true only when no check failed and at least 100 usable rows exist (warnings do not block analysis).

## POST /screenings/analyze → 201

`multipart/form-data`

| field | type | notes |
|---|---|---|
| `file` | file | `.csv`, ≤ 25 MB |
| `device_id` | string | 1–64 chars `[A-Za-z0-9._-]`, starts alphanumeric |
| `model` | string, optional | `response_focused` (default) \| `expanded` |

Required CSV columns: `timeEpoch, supplyVoltage, node1Voltage, node2Voltage,
collectorEmitterCurrent, heatSinkTemperature, packageTemperature, internalTemperature`.

Response (`ScreeningResponse`):

```json
{
  "screening_id": "scr_2c44eb1e54e7",
  "device_id": "IGBT-001",
  "created_at": "2026-10-01T09:11:54Z",
  "model": {"name": "response_focused", "version": "v2", "feature_count": 20, "window_size": 100, "stride": 25},
  "input": {
    "filename": "burnin_test.csv", "total_rows": 5200, "valid_rows": 5198, "dropped_rows": 2, "windows": 205,
    "time_start": 1000.0, "time_end": 2040.0, "baseline_rows": 519, "unused_tail_rows": 3,
    "was_reordered": false, "duplicate_timestamps": 0,
    "dropped_by_reason": {"non_numeric_or_missing_node2Voltage": 2}, "warnings": ["2 row(s) were dropped during cleaning."]
  },
  "summary": {"status": "REVIEW", "normal_windows": 174, "review_windows": 21, "anomalous_windows": 10,
              "total_windows": 205, "anomaly_fraction": 0.0488},
  "thresholds": {"isolation_forest": 0.069082, "autoencoder": 0.287608},
  "peak": {"window_index": 143, "start_time": 1735.2, "end_time": 1755.0,
           "isolation_forest_score": 0.1042, "autoencoder_score": 0.9124, "status": "ANOMALY",
           "top_features": [ /* FeatureExplanation, up to 10 */ ]},
  "episodes": [
    {"id": 1, "first_window": 396, "last_window": 411, "start_row": 9900, "end_row": 10274, "start_time": 3312989000.0,
     "end_time": 3312989100.0, "duration_s": 100.0, "windows": 16, "span_windows": 16, "review_windows_in_span": 0,
     "max_if_score": 0.21, "mean_if_score": 0.18, "max_ae_score": 4.2, "mean_ae_score": 2.9, "max_ae_to_threshold": 14.7,
     "max_if_margin": 0.14, "agreement_pct": 100.0, "peak_window": 405,
     "top_features": [{"feature": "packageTemperature_std", "signal": "packageTemperature", "indicator": "variation (std)",
                       "mean_ae_error_share": 0.31, "mean_if_contribution": 0.02, "mean_abs_normalized_deviation": 9.4, "direction": "above"}],
     "top_signals": [{"signal": "packageTemperature", "mean_ae_error_share": 0.42}]}
  ],
  "episode_rule": "An anomaly episode merges windows flagged by BOTH detectors ...",
  "top_features": [ /* FeatureExplanation[] of the strongest episode's peak window */ ],
  "distribution_check": {"status": "ok", "median_ae_to_threshold": 0.29, "ae_flag_fraction": 0.07, "if_flag_fraction": 0.08, "message": "..."},
  "timeline": [
    {"window_index": 0, "start_time": 1000.0, "end_time": 1019.8, "isolation_forest_score": 0.031,
     "autoencoder_score": 0.112, "isolation_forest_flag": false, "autoencoder_flag": false, "status": "NORMAL"}
  ],
  "timings_ms": {"parse_clean_ms": 55.0, "windowing_ms": 4.1, "features_ms": 6.2, "inference_ms": 40.3, "explanation_ms": 9.0, "total_ms": 114.6},
  "disclaimer": "BurnInWatch produces unsupervised anomaly-screening signals. ..."
}
```
(Numbers above are illustrative.) `summary` additionally contains

```json
"agreement": {"isolation_forest_flagged": 49, "autoencoder_flagged": 51, "both": 46, "isolation_forest_only": 3, "autoencoder_only": 5}
```
(`both` equals `anomalous_windows`; `isolation_forest_only + autoencoder_only` equals `review_windows`; `neither` = normal windows.)
`summary` also carries `total_samples`, `episodes`, `max_if_score`, `max_ae_score`, `max_ae_to_threshold`.
`input` carries `duration_s`, `median_sampling_interval_s`, `signals` and `baseline` (`rows`, `train_rows`, `values`, `method`).
`model` carries the ordered `features` read from the artifacts.
`timings_ms` is measured server-side; the first call after a start includes model loading.

Semantics

* `status` ∈ `NORMAL | REVIEW | ANOMALY`. Window: no detector flags / exactly one / both. Overall: worst window.
* Flags: IF `score = -decision_function > threshold`; AE `reconstruction MSE > threshold`. Higher = more anomalous.
* `start_time`/`end_time` are the `timeEpoch` of the first/last record of the window (units as in the CSV).
* `anomaly_fraction = anomalous_windows / total_windows`.
* `FeatureExplanation`: `current_value`, `learned_normal_value` (training median from the fitted scaler),
  `reconstructed_value` (AE, original units), `deviation`, `pct_deviation` (null when |learned normal| < 1e-6),
  `normalized_deviation` ((value - median)/training IQR), `ae_error` / `ae_error_share` (squared reconstruction error
  per feature / its share of the total) and `if_contribution` (Isolation Forest reference-substitution attribution;
  null if not computed). All descriptive, not causal.
* Episodes merge ANOMALY windows (both detectors) separated by at most 2 windows; `max_ae_to_threshold` is severity.
* `peak.window_index` indexes into `timeline`.

## GET /screenings/{screening_id} → 200

Same body as the POST response. 404 `SCREENING_NOT_FOUND` if unknown (storage is in-memory and cleared on restart).

## GET /screenings/{screening_id}/timeline → 200

```json
{"screening_id": "scr_...", "device_id": "IGBT-001", "total_windows": 205,
 "thresholds": {"isolation_forest": 0.069082, "autoencoder": 0.287608},
 "timeline": [ /* TimelinePoint[] */ ]}
```

## GET /screenings → 200

Screenings currently held by the repository, newest first (in-memory: cleared on backend restart).

```json
{"items": [{"screening_id": "scr_...", "device_id": "IGBT-001", "created_at": "2026-10-01T09:11:54Z",
            "filename": "burnin_test.csv", "model_name": "response_focused", "status": "ANOMALY",
            "total_windows": 117, "review_windows": 8, "anomalous_windows": 46, "anomaly_fraction": 0.3932}],
 "total": 1, "storage": "memory"}
```

## GET /screenings/{screening_id}/windows/{window_index} → 200

Drill-down for one window (`window_index` indexes the screening's `timeline`).

```json
{"screening_id": "scr_...", "window_index": 99, "start_time": 1495.0, "end_time": 1514.8, "record_count": 100,
 "isolation_forest_score": 0.185, "isolation_forest_threshold": 0.02958, "isolation_forest_flag": true,
 "autoencoder_score": 360177.0, "autoencoder_threshold": 1.926, "autoencoder_flag": true,
 "status": "ANOMALY", "detection": "both",
 "episode_id": 1, "why_flagged": ["Isolation Forest score 0.185 is above its threshold 0.069.", "..."],
 "features": [ /* every model feature (artifact order) as FeatureExplanation */ ],
 "raw_time": [ /* 100 timeEpoch values */ ], "raw_measurements": {"packageTemperature": [ /* 100 values */ ]},
 "signal_levels": [{"signal": "collectorEmitterCurrent", "window_mean": 2.692, "window_min": 2.4, "window_max": 3.0,
                    "baseline_median": 2.0, "delta_from_baseline": 0.692, "pct_from_baseline": 34.6}],
 "nearby": [ /* up to 13 windows around this one with scores and status */ ],
 "if_attribution_method": "...", "ae_attribution_method": "..."}
```
`detection` ∈ `both | isolation_forest | autoencoder | none`. `baseline_median` / `delta_from_baseline` / `pct_from_baseline` are `null` for
signals without a baseline (only `node2Voltage`, `collectorEmitterCurrent`, `packageTemperature` have one). 404 `WINDOW_NOT_FOUND` if out of range.

## GET /screenings/{screening_id}/signals/{signal}?max_points=1500&start=&end= → 200

Measured series of one signal: `supplyVoltage | node1Voltage | node2Voltage | collectorEmitterCurrent | heatSinkTemperature | packageTemperature | internalTemperature`.
`start`/`end` (timeEpoch) zoom into a range, which is re-down-sampled.
Down-sampled to at most `max_points` (50–5000) by keeping the minimum and maximum of each interval, so spikes survive.

```json
{"screening_id": "scr_...", "signal": "packageTemperature", "total_points": 3000, "returned_points": 1498, "downsampled": true,
 "time": [1000.0, 1000.4], "value": [60.01, 60.2],
 "baseline": {"value": 60.002, "rows": 300, "time_start": 1000.0, "time_end": 1059.8},
 "flagged_windows": [{"window_index": 1, "start_time": 1005.0, "end_time": 1024.8, "status": "ANOMALY"}],
 "episodes": [{"id": 1, "start_time": 1005.0, "end_time": 1100.0}]}
```
`baseline` is `null` for signals without a baseline. Drill-down data is kept for the 25 most recent screenings
(`DETAIL_UNAVAILABLE` afterwards).

## GET /evaluation → 200

**Offline Model Evaluation** (static research results, not a live result). Built by `scripts/build_offline_evaluation.py`
into `evaluation/offline_evaluation.json`. Contains thresholds, split sizes, flag fractions, IF/AE agreement,
per-device flag rates, limitations and `unavailable_metrics` (precision/recall/F1/ROC-AUC/PR-AUC ... with the reason:
no ground-truth labels). 404 `EVALUATION_UNAVAILABLE` if the file is missing.

## Frontend snippet

```ts
const fd = new FormData();
fd.append("file", file);
fd.append("device_id", deviceId);
fd.append("model", "response_focused");
const res = await fetch("http://localhost:8000/api/v1/screenings/analyze", { method: "POST", body: fd });
const body = await res.json();
if (!res.ok) throw new Error(body.error.message);   // do NOT set Content-Type manually
```
