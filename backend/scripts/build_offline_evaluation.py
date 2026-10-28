"""Build backend/evaluation/offline_evaluation.json from the research artifacts.

This is OFFLINE evaluation (static, from the research notebooks) and is shown on a page
separate from Live Screening. It reads ONLY files that exist; anything not computable
(e.g. precision/recall - there are no ground-truth failure labels) is listed under
``unavailable_metrics`` with the reason instead of being invented.

    python scripts/build_offline_evaluation.py [--research-root ..]

It also RE-SCORES the notebook windows with the saved artifacts through the backend's
inference code and records the max |difference| to the scores stored in the notebook output,
as a cross-check that the artifacts and the backend agree.
"""
import argparse, json, sys, warnings
from pathlib import Path

warnings.simplefilter("ignore")
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from burninwatch.config import Settings  # noqa: E402
from burninwatch.ml.model_registry import ModelRegistry  # noqa: E402
from burninwatch.services.inference import score_windows  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--research-root", default=str(ROOT.parent))
a = ap.parse_args()
R = Path(a.research_root)
proc = R / "processed"
W = pd.read_csv(proc / "burninwatch_expanded_overlapping_windows_v2.csv")
C = pd.read_csv(proc / "burninwatch_expanded_model_comparison_v2.csv").set_index("experiment")
reg = ModelRegistry(Settings())

models, check = [], {}
for name in ("response_focused", "expanded"):
    b = reg.get(name)
    ev = W[W.split == "evaluation"].copy()
    # re-score with the backend inference code (artifacts + imputer/scaler + exact AE)
    sc = score_windows(b, W[W.split.isin(["validation", "evaluation"])][list(b.features)].reset_index(drop=True), Settings())
    ref = W[W.split.isin(["validation", "evaluation"])].reset_index(drop=True)
    check[name] = {
        "max_abs_if_score_diff": float(np.abs(sc.if_scores - ref[f"{name}_IF_score"]).max()),
        "max_abs_ae_score_diff": float(np.abs(sc.ae_scores - ref[f"{name}_AE_score"]).max()),
        "windows_rescored": int(len(ref)),
    }
    ev["if_f"] = ev[f"{name}_IF_score"] > b.if_threshold
    ev["ae_f"] = ev[f"{name}_AE_score"] > b.ae_threshold
    per_dev = []
    for (dev, fn, role), g in ev.groupby(["device_id", "file_name", "file_role"]):
        per_dev.append({
            "device_id": dev, "file": fn.strip(), "role": role, "evaluation_windows": int(len(g)),
            "if_flag_fraction": float(g.if_f.mean()), "ae_flag_fraction": float(g.ae_f.mean()),
            "both_flagged": int((g.if_f & g.ae_f).sum()),
        })
    row = C.loc[name]
    models.append({
        "model": name, "feature_set": name, "feature_count": int(row.feature_count),
        "threshold_if": b.if_threshold, "threshold_ae": b.ae_threshold,
        "train_windows": int(row.train_windows), "validation_windows": int(row.validation_windows),
        "evaluation_windows": int(row.evaluation_windows),
        "if_flag_fraction": float(row.IF_flag_fraction), "ae_flag_fraction": float(row.AE_flag_fraction),
        "both_flagged": int(row.both_models_flagged), "if_only": int(row.IF_only), "ae_only": int(row.AE_only),
        "score_correlation": float(row.score_correlation), "ae_final_training_loss": float(row.AE_final_loss),
        "per_device": per_dev,
    })

files = W.groupby(["device_id", "file_name", "file_role"]).size().reset_index(name="windows")
out = {
    "title": "Offline Model Evaluation",
    "generated_from": [
        "processed/burninwatch_expanded_model_comparison_v2.csv",
        "processed/burninwatch_expanded_overlapping_windows_v2.csv",
        "backend/models/* (thresholds and artifacts)",
        "notebooks/05_expanded_overlapping_modeling.ipynb (methodology)",
    ],
    "validation_methodology": (
        "Per file, raw records are split chronologically (no shuffling, split BEFORE windowing so windows never "
        "straddle splits): first 20 % baseline_train (fits imputer, RobustScaler, Isolation Forest, Autoencoder), "
        "next 20 % validation (sets thresholds), last 60 % evaluation. 'check' files are held out entirely. "
        "Windows: 100 records, stride 25."
    ),
    "threshold_method": "Each detector's threshold = 95th percentile of its validation-window scores, so ~5 % of "
                        "validation windows are flagged by construction.",
    "models": models,
    "available_metrics": [
        "feature set and count", "thresholds", "train/validation/evaluation window counts",
        "evaluation flag fractions (IF, AE)", "IF/AE agreement counts", "IF-AE score correlation",
        "AE final training loss", "per-device / per-file evaluation flag rates",
    ],
    "unavailable_metrics": {
        "precision": "No ground-truth failure/anomaly labels exist in the provided artifacts; the models are unsupervised.",
        "recall": "Requires labelled anomalies (not available).",
        "F1": "Requires labelled anomalies (not available).",
        "specificity": "Requires labelled anomalies (not available).",
        "false_positive_rate": "Requires labels. Only the validation flag rate (5 % by construction) and evaluation flag fractions exist.",
        "ROC-AUC": "Requires labelled anomalies (not available).",
        "PR-AUC": "Requires labelled anomalies (not available).",
    },
    "dataset": {
        "independent_devices": int(W.device_id.nunique()),
        "devices": sorted(W.device_id.unique().tolist()),
        "files": [{"device_id": r.device_id, "file": r.file_name.strip(), "role": r.file_role, "windows": int(r.windows)}
                  for r in files.itertuples()],
        "total_windows": int(len(W)),
    },
    "limitations": [
        "The current dataset is sufficient for demonstrating the pipeline but is limited for establishing "
        "cross-device generalization.",
        f"Only {W.device_id.nunique()} independent devices are present; overlapping windows from one test are "
        "highly correlated and are not independent samples.",
        "Models are trained on the first 20 % of each test and evaluated on later portions of the SAME devices - "
        "there is no held-out device.",
        "No failure labels: flag rates describe deviation from learned early-life behaviour, not detection accuracy.",
        "Thresholds are validation 95th percentiles; a flagged window is a screening signal, not a failure prediction.",
    ],
    "artifact_rescoring_check": check,
}
dest = ROOT / "evaluation" / "offline_evaluation.json"
dest.write_text(json.dumps(out, indent=2), encoding="utf-8")
print("wrote", dest); print(json.dumps(check, indent=2))
