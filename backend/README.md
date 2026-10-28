# BurnInWatch backend

Inference-only FastAPI service for **BurnInWatch**, an unsupervised anomaly-screening
platform for electronic components during burn-in / aging tests. An operator uploads one
burn-in CSV; the backend owns the whole pipeline (cleaning → windowing → feature
engineering → Isolation Forest + Autoencoder → status) and returns a dashboard-ready JSON.

> BurnInWatch outputs **anomaly-screening signals**, not failure predictions. There are no
> probabilities, no "failure %", and listed abnormal signals are descriptive, not causal.

Nothing is trained, fitted, or calibrated at runtime. Only the serialized artifacts in
`models/` are needed; the original dataset and notebooks are not.

## Architecture

```
src/burninwatch/
  main.py            app factory, CORS, error envelope, upload-size guard
  config.py          PIPELINE contract (100/25, baseline rule, columns) + env Settings
  errors.py          typed errors -> {"error": {code, message, details}}
  api/               routes (thin) + dependencies
  schemas/           Pydantic contracts (screening.py)
  services/
    csv_service.py        upload checks, decoding, header/column validation
    preprocessing.py      numeric conversion, NaN/inf, cleaning, sorting, baseline
    windowing.py          overlapping 100/25 windows (vectorised)
    features.py           engineered features (full universe; models select subsets)
    inference.py          IF + AE scoring, thresholds, per-window & overall status
    xai.py                explainability (AE per-feature error, IF reference-substitution, deviation from learned normal)
    episodes.py           anomaly-episode merging
    screening_service.py  orchestration (the only thing routes call)
    repository.py         ScreeningRepository protocol + in-memory implementation
  ml/
    model_registry.py     model specs, strict artifact loading, feature-order/threshold checks
    autoencoder.py        exact BurnInAutoencoder (strict state_dict load), reconstruction + per-feature error
scripts/   inspect_artifacts.py · verify_parity.py · build_offline_evaluation.py · make_sample_csv.py
```

## Setup (Windows, PowerShell)

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install -e .
copy .env.example .env
```

If PowerShell blocks activation: `Set-ExecutionPolicy -Scope Process Bypass`.
The artifacts were pickled with **scikit-learn 1.9.0** (`requirements.txt` keeps the 1.9.x line);
a different minor version may load with warnings or fail. CPU-only PyTorch is fine:
`pip install torch --index-url https://download.pytorch.org/whl/cpu`.

## Model artifacts

Copy the trained files into `backend/models/`:

| Model | Files |
|---|---|
| `response_focused` (default, 20 features) | `burninwatch_expanded_response_focused_IF.joblib`, `..._AE.pt`, `..._AE_preprocess.joblib` |
| `expanded` (31 features) | `burninwatch_expanded_expanded_IF.joblib`, `..._AE.pt`, `..._AE_preprocess.joblib` |

Then inspect them (do this first):

```powershell
python scripts\inspect_artifacts.py
```

Artifact formats (exactly what notebook 05, formerly 12, saves; loaded strictly, nothing is guessed):

| File | Content |
|---|---|
| `..._IF.joblib` | dict `{imputer, scaler (RobustScaler), model (IsolationForest), features, threshold}` - the IF was fitted on imputer→scaler output |
| `..._AE_preprocess.joblib` | dict `{imputer, scaler, features}` |
| `..._AE.pt` | dict `{state_dict, input_dim, features, threshold}` - `BurnInAutoencoder` (Linear-ReLU-Linear / Linear-ReLU-Linear, **no activation on the bottleneck**) |

The feature list and order come from the artifacts, must be identical in all three files and equal the
configured spec, otherwise the model refuses to load (`FEATURE_MISMATCH`). **Thresholds are read from the
artifacts, never computed.** Models load lazily and are cached; set `BURNINWATCH_PRELOAD_MODELS=true` to load
at startup. `scripts/inspect_artifacts.py` prints what was found.

## Run

```powershell
uvicorn burninwatch.main:app --reload --port 8000
```

Docs: http://localhost:8000/docs · Tests: `pytest` · Sample data:
`python scripts\make_sample_csv.py sample.csv --rows 2000 --anomaly`

```powershell
curl.exe -X POST http://localhost:8000/api/v1/screenings/analyze `
  -F "file=@sample.csv;type=text/csv" -F "device_id=IGBT-001" -F "model=response_focused"
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/health` | liveness + artifact presence (doesn't load models) |
| GET | `/api/v1/models` | known configurations, features, availability |
| POST | `/api/v1/datasets/validate` | pre-flight dataset checks (same rules as analysis, no model) |
| POST | `/api/v1/screenings/analyze` | upload CSV → full screening (201) |
| GET | `/api/v1/screenings` | screenings held in memory, newest first |
| GET | `/api/v1/screenings/{id}` | stored screening |
| GET | `/api/v1/screenings/{id}/timeline` | timeline only |
| GET | `/api/v1/screenings/{id}/windows/{index}` | window inspector: scores, thresholds, all features with XAI, raw records, nearby windows |
| GET | `/api/v1/screenings/{id}/signals/{signal}` | measured series (min/max down-sampled, optional `start`/`end` zoom) + baseline + flagged windows + episodes |
| GET | `/api/v1/evaluation` | **Offline** model evaluation (static research results, separate from live screening) |

Exact contract: [docs/api-contract.md](docs/api-contract.md).

## CSV input contract

Required columns (case-insensitive header match, whitespace trimmed): `timeEpoch`,
`supplyVoltage`, `node1Voltage`, `node2Voltage`, `collectorEmitterCurrent`,
`heatSinkTemperature`, `packageTemperature`, `internalTemperature`. Optional:
`ambientTemperature` (ignored), `measurement_valid` (false rows dropped). `.csv` only,
max 25 MB (`BURNINWATCH_MAX_UPLOAD_MB`), at least 100 usable rows.

## Inference pipeline (identical to training - see `scripts/verify_parity.py`)

1. Validate upload (extension, MIME, size) and required columns.
2. Convert to numeric; unparseable cells and ±inf → NaN.
3. Drop rows where **any of the 8 required numeric columns** is non-finite (training's `dropna`) or `measurement_valid` is false.
4. Sort by `timeEpoch` (stable).
5. **Baseline (training rule):** `train_n = floor(0.20·n)`; reference = first `max(20, int(0.10·train_n))` cleaned
   rows (≈2 % of the file; 215 rows for the 10 770-row sample); baseline = median of `node2Voltage`,
   `collectorEmitterCurrent`, `packageTemperature`. A test already degraded at its start gets a degraded baseline.
6. Windows: 100 records, stride 25; a trailing partial window is not scored.
7. Features (`services/features.py`, exact port of notebook 12; std is ddof=0, `node_voltage_drop = node1 − node2`,
   `estimated_power_proxy = node2·I`, pct-change is a fraction).
8. Select the model's ordered features → `SimpleImputer(median)` → `RobustScaler` (separately fitted copies for IF and AE, identical values).
9. Isolation Forest: `score = −decision_function(X_scaled)`; flag if `score > threshold`.
10. Autoencoder: `score = mean((X_scaled − recon)²)`; flag if `score > threshold`.
11. Window status: none flagged = `NORMAL`; exactly one = `REVIEW`; both = `ANOMALY`. Overall: worst window.
12. Episodes (`services/episodes.py`): ANOMALY windows separated by ≤ 2 windows are merged into one episode.
13. XAI (`services/xai.py`): deviation from learned normal, AE per-feature reconstruction error, IF reference-substitution attribution.
14. `distribution_check`: warns when median AE error is > 5× its threshold or a detector flags > 90 % of windows
    (typical sign of a units/column mismatch, not a genuine result).

## Verification

```powershell
python scripts\verify_parity.py            # backend vs. notebook 12 windows: features, IF scores, AE scores, flags
python scripts\build_offline_evaluation.py # regenerate evaluation/offline_evaluation.json (GET /api/v1/evaluation)
pytest
```

## Persistence

`InMemoryScreeningRepository` (bounded, lost on restart; the 25 most recent screenings also keep the
cleaned series and feature matrix used for window/signal drill-down). Implement
`ScreeningRepository.save/get` with MongoDB later and pass it to `create_app(repository=...)`;
routes and services don't change.

## Security

CSV-only, size-capped (Content-Length guard + streaming cap), filename never used as a path,
model chosen from a closed set, artifact paths come only from server config, CORS restricted to
configured origins. Artifacts are pickle-based (joblib / torch) and must come from a trusted
source; `torch.load` runs with `weights_only=True`.
