"""
Export Digital Twin Replay Data
Generates a verified, real-data replay JSON file from the backend pipeline
for the 3D Digital Twin visualization.

Input: processed/sample_burnin_device4_main.csv
Models: backend/models/ (response_focused model: IF + AE)
Output: frontend/public/digitalTwin/replay.json
"""

import json
import sys
from pathlib import Path

# Add backend/src to path
root_dir = Path(__file__).resolve().parents[1]
backend_src = root_dir / "backend" / "src"
sys.path.insert(0, str(backend_src))

from burninwatch.config import Settings, PIPELINE  # noqa: E402
from burninwatch.ml.model_registry import ModelRegistry  # noqa: E402
from burninwatch.services.repository import InMemoryScreeningRepository  # noqa: E402
from burninwatch.services.screening_service import ScreeningService  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402


def export_replay_data():
    models_dir = root_dir / "backend" / "models"
    data_path = root_dir / "processed" / "sample_burnin_device4_main.csv"
    output_dir = root_dir / "frontend" / "public" / "digitalTwin"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "replay.json"

    print(f"Reading dataset: {data_path}")
    raw_df = pd.read_csv(data_path)
    total_raw_rows = len(raw_df)
    print(f"Loaded {total_raw_rows} rows from dataset")

    # Run actual backend analysis pipeline
    settings = Settings(models_dir=models_dir)
    reg = ModelRegistry(settings)
    repo = InMemoryScreeningRepository()
    service = ScreeningService(settings, reg, repo)

    print("Running backend analysis pipeline (model: response_focused)...")
    csv_bytes = data_path.read_bytes()
    res = service.analyze(
        raw=csv_bytes,
        filename=data_path.name,
        device_id="device_4",
        model_name="response_focused",
    )

    detail = repo.get_detail(res.screening_id)
    if detail is None:
        raise RuntimeError("Screening detail unavailable from repository")

    # Precompute per-window mean sensor values from raw sliding windows
    times = detail.times
    signals = detail.signals
    start_rows = detail.start_rows
    end_rows = detail.end_rows
    scores = detail.scores

    windows_data = []
    n_windows = len(start_rows)
    print(f"Exporting {n_windows} sliding windows...")

    for i in range(n_windows):
        s_row = int(start_rows[i])
        e_row = int(end_rows[i]) + 1  # slice exclusive

        w_v_drop = float(signals["node1Voltage"][s_row:e_row].mean() - signals["node2Voltage"][s_row:e_row].mean())
        w_sensors = {
            "supplyVoltage": float(signals["supplyVoltage"][s_row:e_row].mean()),
            "node1Voltage": float(signals["node1Voltage"][s_row:e_row].mean()),
            "node2Voltage": float(signals["node2Voltage"][s_row:e_row].mean()),
            "node_voltage_drop": max(0.0, w_v_drop),
            "collectorEmitterCurrent": float(signals["collectorEmitterCurrent"][s_row:e_row].mean()),
            "heatSinkTemperature": float(signals["heatSinkTemperature"][s_row:e_row].mean()),
            "packageTemperature": float(signals["packageTemperature"][s_row:e_row].mean()),
            "internalTemperature": float(signals["internalTemperature"][s_row:e_row].mean()),
        }

        # Top feature errors for XAI attribution in this window
        top_feats = []
        fe_indices = np.argsort(scores.ae_feature_errors[i])[::-1][:4]
        for f_idx in fe_indices:
            feat_name = detail.bundle.features[f_idx]
            err = float(scores.ae_feature_errors[i][f_idx])
            top_feats.append({
                "feature": feat_name,
                "squared_error": err,
            })

        # Identify top contributing signals
        sig_errors = {}
        for f_idx, feat_name in enumerate(detail.bundle.features):
            sig = feat_name.split("_")[0]
            err = float(scores.ae_feature_errors[i][f_idx])
            sig_errors[sig] = sig_errors.get(sig, 0.0) + err
        top_sigs = sorted(sig_errors.keys(), key=lambda s: sig_errors[s], reverse=True)[:3]

        windows_data.append({
            "window_index": i,
            "start_row": s_row,
            "end_row": e_row - 1,
            "start_time": float(times[s_row]),
            "end_time": float(times[e_row - 1]),
            "sensors": w_sensors,
            "if_score": float(scores.if_scores[i]),
            "ae_error": float(scores.ae_scores[i]),
            "if_flag": bool(scores.if_flags[i]),
            "ae_flag": bool(scores.ae_flags[i]),
            "consensus": str(scores.statuses[i].value),
            "top_features": top_feats,
            "top_signals": top_sigs,
        })

    # Prepare episode data
    episodes_data = []
    for ep in res.episodes:
        episodes_data.append({
            "id": ep.id,
            "first_window": ep.first_window,
            "last_window": ep.last_window,
            "start_row": ep.start_row,
            "end_row": ep.end_row,
            "start_time": ep.start_time,
            "end_time": ep.end_time,
            "duration_s": ep.duration_s,
            "windows_count": ep.windows,
            "span_windows": ep.span_windows,
            "max_if_score": ep.max_if_score,
            "max_ae_score": ep.max_ae_score,
            "max_ae_to_threshold": ep.max_ae_to_threshold,
            "agreement_pct": ep.agreement_pct,
            "peak_window": ep.peak_window,
            "top_signals": [s.signal for s in ep.top_signals],
        })

    # Dataset signal statistics
    stats_data = {}
    for col in [
        "supplyVoltage", "node1Voltage", "node2Voltage",
        "collectorEmitterCurrent", "heatSinkTemperature",
        "packageTemperature", "internalTemperature"
    ]:
        v = raw_df[col].values
        stats_data[col] = {
            "min": float(v.min()),
            "mean": float(v.mean()),
            "std": float(v.std()),
            "p01": float(np.percentile(v, 1)),
            "p99": float(np.percentile(v, 99)),
        }

    replay_payload = {
        "metadata": {
            "source": "BurnInWatch real pipeline run",
            "file": data_path.name,
            "device_id": "device_4",
            "model_name": "response_focused",
            "total_rows": total_raw_rows,
            "window_size": PIPELINE.window_size,
            "stride": PIPELINE.stride,
            "total_windows": n_windows,
            "duration_s": float(times[-1] - times[0]),
            "citation": "Trained on NASA IGBT aging data (notebook 05, models/burninwatch_expanded_artifacts_v2.json)",
        },
        "thresholds": {
            "isolation_forest": float(res.thresholds.isolation_forest),
            "autoencoder": float(res.thresholds.autoencoder),
        },
        "summary": {
            "status": str(res.summary.status.value),
            "total_windows": res.summary.total_windows,
            "normal_windows": res.summary.normal_windows,
            "review_windows": res.summary.review_windows,
            "anomalous_windows": res.summary.anomalous_windows,
            "anomaly_fraction": float(res.summary.anomaly_fraction),
            "max_if_score": float(res.summary.max_if_score),
            "max_ae_score": float(res.summary.max_ae_score),
        },
        "episodes": episodes_data,
        "signal_stats": stats_data,
        "windows": windows_data,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(replay_payload, f, indent=2)

    print(f"Successfully exported replay data: {output_path} ({output_path.stat().st_size} bytes)")


if __name__ == "__main__":
    export_replay_data()
