"""Prove the backend reproduces the training notebook (features AND scores).

Uses the research outputs shipped with the project:
  * a raw upload-format CSV of one test (default: processed/sample_burnin_device4_main.csv = Device_4 main)
  * processed/burninwatch_expanded_overlapping_windows_v2.csv - notebook 12's own windows, features and scores

    python scripts/verify_parity.py [--raw ...] [--windows ...] [--device Device_4] [--file "Device4  1.mat"]

Checks (exit code 1 if any fails):
  1. Baseline from the backend preprocessing == notebook baseline implied by the notebook's windows.
  2. For EVERY notebook window of that test (train/validation/evaluation), the backend feature extractor
     applied to the same 100 records reproduces every notebook feature (max relative diff).
  3. Whole-file backend windowing reproduces the notebook's baseline_train windows (same alignment).
  4. Backend IF and AE scores on those features equal the scores stored by the notebook (validation+evaluation).
"""
import argparse, sys, warnings
from pathlib import Path

warnings.simplefilter("ignore")
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from burninwatch.config import Settings  # noqa: E402
from burninwatch.ml.model_registry import ModelRegistry  # noqa: E402
from burninwatch.services import csv_service, preprocessing, windowing  # noqa: E402
from burninwatch.services.features import extract_features  # noqa: E402
from burninwatch.services.inference import score_windows  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--raw", default=str(ROOT.parent / "processed" / "sample_burnin_device4_main.csv"))
ap.add_argument("--windows", default=str(ROOT.parent / "processed" / "burninwatch_expanded_overlapping_windows_v2.csv"))
ap.add_argument("--device", default="Device_4")
ap.add_argument("--file", default="Device4  1.mat")
ap.add_argument("--tol", type=float, default=1e-9)
a = ap.parse_args()

raw = Path(a.raw)
cleaned = preprocessing.clean(csv_service.parse_csv(raw.read_bytes(), raw.name).frame)
frame = cleaned.frame
baseline = preprocessing.compute_baseline(frame)
W = pd.read_csv(a.windows)
ref = W[(W.device_id == a.device) & (W.file_name == a.file)].reset_index(drop=True)
if ref.empty:
    sys.exit(f"No notebook windows for {a.device} / {a.file!r}")
ok = True

print(f"rows={len(frame)}  baseline rows={baseline.n_rows} (train segment {baseline.train_rows}) values={baseline.values}")

# map notebook windows -> row positions by exact start timestamp
t = frame["timeEpoch"].to_numpy()
starts = np.searchsorted(t, ref["start_time"].to_numpy())
assert np.allclose(t[starts], ref["start_time"]), "notebook window start times not found in CSV"
ws = windowing.windows_at(frame, starts)
feats = extract_features(ws, baseline)
end_ok = np.allclose(ws.end_times, ref["end_time"])
print(f"windows compared: {len(ref)}   end timestamps match: {end_ok}")
ok &= end_ok

reg = ModelRegistry(Settings())
all_feats = sorted(set(reg.get("expanded").features))
worst = ("", 0.0)
for c in all_feats:
    d = (np.abs(feats[c].to_numpy() - ref[c].to_numpy()) / np.maximum(np.abs(ref[c].to_numpy()), 1e-12)).max()
    if d > worst[1]:
        worst = (c, d)
print(f"[2] feature parity over {len(all_feats)} features: max relative diff = {worst[1]:.2e} ({worst[0]})")
ok &= worst[1] <= a.tol

# whole-file windowing vs notebook baseline_train windows (same alignment: segment starts at row 0)
train_ref = ref[ref.split == "baseline_train"].sort_values("window_index")
ws_all = windowing.build_windows(frame)
f_all = extract_features(ws_all, baseline)
k = len(train_ref)
d3 = max(
    (np.abs(f_all[c].to_numpy()[:k] - train_ref[c].to_numpy()) / np.maximum(np.abs(train_ref[c].to_numpy()), 1e-12)).max()
    for c in all_feats
)
print(f"[3] whole-file windowing vs notebook baseline_train windows ({k}): max relative diff = {d3:.2e}")
ok &= d3 <= a.tol

for name in ("response_focused", "expanded"):
    b = reg.get(name)
    sc = score_windows(b, feats, Settings())
    m = ref.split.isin(["validation", "evaluation"]).to_numpy()
    d_if = np.abs(sc.if_scores[m] - ref.loc[m, f"{name}_IF_score"].to_numpy()).max()
    d_ae = np.abs(sc.ae_scores[m] - ref.loc[m, f"{name}_AE_score"].to_numpy()).max()
    flag_if = ((sc.if_scores[m] > b.if_threshold).astype(int) == ref.loc[m, f"{name}_IF_flag"].astype(int).to_numpy()).all()
    flag_ae = ((sc.ae_scores[m] > b.ae_threshold).astype(int) == ref.loc[m, f"{name}_AE_flag"].astype(int).to_numpy()).all()
    print(f"[4] {name:17s} max|dIF|={d_if:.2e}  max|dAE|={d_ae:.2e}  flags identical: IF={flag_if} AE={flag_ae}")
    ok &= d_if < 1e-9 and d_ae < 1e-4 and flag_if and flag_ae  # AE is float32 (as in training)

print("\nPARITY:", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
