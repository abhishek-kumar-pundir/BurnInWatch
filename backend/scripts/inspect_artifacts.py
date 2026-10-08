"""Report what is inside models/ and whether the registry can load each model.

    python scripts/inspect_artifacts.py [--models-dir models]

Run this FIRST against your real artifacts and keep the output: it shows the artifact
formats, the autoencoder layer shapes, and where each threshold was found.
"""
import argparse
import sys
import warnings
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import joblib  # noqa: E402
import torch  # noqa: E402

from burninwatch.config import Settings  # noqa: E402
from burninwatch.errors import BurnInWatchError  # noqa: E402
from burninwatch.ml.model_registry import MODEL_SPECS, ModelRegistry  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--models-dir", default=str(Settings().models_dir))
args = ap.parse_args()
settings = Settings(models_dir=Path(args.models_dir))
reg = ModelRegistry(settings)


def describe(obj, indent="    "):
    print(f"{indent}type: {type(obj).__module__}.{type(obj).__name__}")
    if isinstance(obj, dict):
        for k, v in obj.items():
            shown = v if isinstance(v, (int, float, str, bool)) else type(v).__name__
            if isinstance(v, (list, tuple)):
                shown = f"{type(v).__name__}[{len(v)}]"
            print(f"{indent}  [{k!r}] -> {shown}")
    for attr in ("n_estimators", "contamination", "random_state", "n_features_in_", "offset_", "threshold_"):
        if hasattr(obj, attr):
            print(f"{indent}  .{attr} = {getattr(obj, attr)}")


for name, spec in MODEL_SPECS.items():
    print(f"\n=== {name} ({spec.feature_count} features) ===")
    for f, p in reg.artifact_paths(spec).items():
        print(f"- {f}: {'FOUND' if p.is_file() else 'MISSING'}")
        if not p.is_file():
            continue
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            try:
                if p.suffix == ".joblib":
                    describe(joblib.load(p))
                else:
                    obj = torch.load(p, map_location="cpu", weights_only=True)
                    sd = obj if all(isinstance(v, torch.Tensor) for v in obj.values()) else obj.get("state_dict", obj)
                    print(f"    checkpoint keys: {[k for k in obj][:8] if not sd is obj else '(bare state_dict)'}")
                    for k, v in sd.items():
                        if isinstance(v, torch.Tensor):
                            print(f"    {k}: {tuple(v.shape)}")
            except Exception as exc:  # noqa: BLE001
                print(f"    FAILED TO READ: {exc}")
        for w in caught:
            print(f"    warning: {w.category.__name__}: {w.message}")
    try:
        b = reg.get(name)
        print(f"-> LOADED OK. IF threshold={b.if_threshold:.6f}  AE threshold={b.ae_threshold:.6f}")
    except BurnInWatchError as exc:
        print(f"-> LOAD FAILED: [{exc.code}] {exc.message}")
