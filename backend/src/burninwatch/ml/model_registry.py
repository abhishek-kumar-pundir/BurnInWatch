"""Model registry: known model configurations + lazy, cached artifact loading.

Artifact formats (written by notebook 12; loaded STRICTLY - nothing is guessed):

``burninwatch_expanded_<name>_IF.joblib``
    dict ``{imputer: SimpleImputer, scaler: RobustScaler, model: IsolationForest,
    features: [...], threshold: float}``. The Isolation Forest was fitted on the
    imputed + robust-scaled features, so inference MUST apply imputer -> scaler first.
``burninwatch_expanded_<name>_AE_preprocess.joblib``
    dict ``{imputer, scaler, features}`` (identical fit to the one inside the IF bundle).
``burninwatch_expanded_<name>_AE.pt``
    dict ``{state_dict, input_dim, features, threshold}``.

The feature list (and ORDER) is read from the artifacts, must be identical in all three,
and must equal the configured spec; thresholds are READ, never recomputed.
"""
from __future__ import annotations

import logging
import threading
import warnings
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from ..config import PIPELINE, Settings
from ..errors import ModelArtifactError, UnknownModelError
from . import autoencoder as ae_mod

log = logging.getLogger(__name__)

RESPONSE_FOCUSED_FEATURES: tuple[str, ...] = (
    "node2Voltage_std", "node2Voltage_iqr", "node2Voltage_slope",
    "collectorEmitterCurrent_mean", "collectorEmitterCurrent_std", "collectorEmitterCurrent_q05",
    "collectorEmitterCurrent_q95", "collectorEmitterCurrent_iqr", "collectorEmitterCurrent_slope",
    "packageTemperature_std", "packageTemperature_iqr", "packageTemperature_slope",
    "node2Voltage_delta_from_baseline", "node2Voltage_pct_change_from_baseline",
    "collectorEmitterCurrent_delta_from_baseline", "collectorEmitterCurrent_pct_change_from_baseline",
    "packageTemperature_delta_from_baseline", "packageTemperature_pct_change_from_baseline",
    "current_per_node2V", "node_voltage_drop",
)

EXPANDED_FEATURES: tuple[str, ...] = (
    "supplyVoltage_mean", "supplyVoltage_std",
    "node2Voltage_mean", "node2Voltage_std", "node2Voltage_q05", "node2Voltage_q95",
    "node2Voltage_iqr", "node2Voltage_slope",
    "collectorEmitterCurrent_mean", "collectorEmitterCurrent_std", "collectorEmitterCurrent_q05",
    "collectorEmitterCurrent_q95", "collectorEmitterCurrent_iqr", "collectorEmitterCurrent_slope",
    "packageTemperature_mean", "packageTemperature_std", "packageTemperature_q05",
    "packageTemperature_q95", "packageTemperature_iqr", "packageTemperature_slope",
    "supply_node1_mean_diff", "node1_node2_mean_diff", "node_voltage_drop",
    "current_per_node2V", "estimated_power_proxy",
    "node2Voltage_delta_from_baseline", "node2Voltage_pct_change_from_baseline",
    "collectorEmitterCurrent_delta_from_baseline", "collectorEmitterCurrent_pct_change_from_baseline",
    "packageTemperature_delta_from_baseline", "packageTemperature_pct_change_from_baseline",
)


@dataclass(frozen=True)
class ModelSpec:
    name: str
    version: str
    description: str
    features: tuple[str, ...]
    if_file: str
    ae_file: str
    ae_preprocess_file: str

    @property
    def feature_count(self) -> int:
        return len(self.features)

    @property
    def artifact_files(self) -> tuple[str, ...]:
        return (self.if_file, self.ae_file, self.ae_preprocess_file)


MODEL_SPECS: dict[str, ModelSpec] = {
    "response_focused": ModelSpec(
        name="response_focused", version="v2",
        description="20 response-focused features (node2 voltage, collector-emitter current, "
        "package temperature dynamics + baseline-relative deviation). Default.",
        features=RESPONSE_FOCUSED_FEATURES,
        if_file="burninwatch_expanded_response_focused_IF.joblib",
        ae_file="burninwatch_expanded_response_focused_AE.pt",
        ae_preprocess_file="burninwatch_expanded_response_focused_AE_preprocess.joblib",
    ),
    "expanded": ModelSpec(
        name="expanded", version="v2",
        description="31 features: adds supply voltage, distribution statistics and "
        "relationship / power-proxy features.",
        features=EXPANDED_FEATURES,
        if_file="burninwatch_expanded_expanded_IF.joblib",
        ae_file="burninwatch_expanded_expanded_AE.pt",
        ae_preprocess_file="burninwatch_expanded_expanded_AE_preprocess.joblib",
    ),
}


@dataclass
class ModelBundle:
    spec: ModelSpec
    features: tuple[str, ...]  # artifact order == model input order
    # Isolation Forest (fitted on imputer -> scaler output)
    if_model: Any
    if_imputer: Any
    if_scaler: Any
    if_threshold: float
    # Autoencoder
    ae_net: ae_mod.BurnInAutoencoder
    ae_imputer: Any
    ae_scaler: Any
    ae_threshold: float
    trained_sklearn_version: str | None = None
    load_notes: list[str] = field(default_factory=list)

    # --- learned-normal reference (training median / IQR) ------------------ #
    @property
    def reference_median(self) -> np.ndarray:
        """Per-feature training median (what the imputer/scaler centre on)."""
        return np.asarray(self.ae_scaler.center_, dtype="float64")

    @property
    def reference_scale(self) -> np.ndarray:
        """Per-feature training IQR (RobustScaler scale)."""
        return np.asarray(self.ae_scaler.scale_, dtype="float64")

    def scale_if(self, x: np.ndarray) -> np.ndarray:
        return np.asarray(self.if_scaler.transform(self.if_imputer.transform(x)), dtype="float64")

    def scale_ae(self, x: np.ndarray) -> np.ndarray:
        return np.asarray(self.ae_scaler.transform(self.ae_imputer.transform(x)), dtype="float64")


def _need(d: Any, keys: tuple[str, ...], fname: str) -> None:
    if not isinstance(d, dict) or any(k not in d for k in keys):
        found = sorted(map(str, d)) if isinstance(d, dict) else type(d).__name__
        raise ModelArtifactError(
            f"'{fname}' must be a dict with keys {list(keys)}; found {found}.", details={"artifact": fname}
        )


def _joblib(path: Path) -> Any:
    try:
        return joblib.load(path)
    except Exception as exc:  # noqa: BLE001
        raise ModelArtifactError(
            f"Could not load '{path.name}': {exc}. Ensure scikit-learn in this environment matches "
            "the version used to train/save the artifact (1.9.x).",
            details={"artifact": path.name},
        ) from exc


def _thr(value: Any, what: str, fname: str) -> float:
    try:
        f = float(value)
    except (TypeError, ValueError):
        f = float("nan")
    if not np.isfinite(f):
        raise ModelArtifactError(
            f"'{fname}' has no valid {what} threshold. Thresholds are never recomputed at inference.",
            details={"artifact": fname},
        )
    return f


class ModelRegistry:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._bundles: dict[str, ModelBundle] = {}
        self._locks = {name: threading.Lock() for name in MODEL_SPECS}

    @property
    def default_name(self) -> str:
        return self._settings.default_model

    def names(self) -> list[str]:
        return list(MODEL_SPECS)

    def spec(self, name: str | None) -> ModelSpec:
        key = name or self.default_name
        if key not in MODEL_SPECS:
            raise UnknownModelError(
                f"Unknown model '{key}'. Available models: {', '.join(MODEL_SPECS)}.",
                details={"available_models": list(MODEL_SPECS)},
            )
        return MODEL_SPECS[key]

    def artifact_paths(self, spec: ModelSpec) -> dict[str, Path]:
        d = self._settings.models_dir
        return {f: d / f for f in spec.artifact_files}

    def missing_artifacts(self, spec: ModelSpec) -> list[str]:
        return [f for f, p in self.artifact_paths(spec).items() if not p.is_file()]

    def is_loaded(self, name: str) -> bool:
        return name in self._bundles

    def get(self, name: str | None) -> ModelBundle:
        spec = self.spec(name)
        bundle = self._bundles.get(spec.name)
        if bundle is not None:
            return bundle
        with self._locks[spec.name]:
            bundle = self._bundles.get(spec.name)
            if bundle is None:
                bundle = self._load(spec)
                self._bundles[spec.name] = bundle
        return bundle

    def preload(self) -> None:
        for n in self.names():
            self.get(n)

    def _load(self, spec: ModelSpec) -> ModelBundle:
        missing = self.missing_artifacts(spec)
        if missing:
            raise ModelArtifactError(
                f"Model '{spec.name}' is unavailable; missing artifact file(s) in "
                f"'{self._settings.models_dir}': {', '.join(missing)}.",
                details={"model": spec.name, "missing_artifacts": missing},
            )
        paths = self.artifact_paths(spec)
        notes: list[str] = []
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            if_raw = _joblib(paths[spec.if_file])
            pre_raw = _joblib(paths[spec.ae_preprocess_file])
        for w in caught:
            if "InconsistentVersion" in w.category.__name__ and any("Inconsistent" in n for n in notes):
                continue  # one note is enough; sklearn emits one per estimator
            notes.append(f"{w.category.__name__}: {str(w.message).splitlines()[0]}")
            log.warning("Loading %s: %s", spec.name, w.message)

        _need(if_raw, ("imputer", "scaler", "model", "features", "threshold"), spec.if_file)
        _need(pre_raw, ("imputer", "scaler", "features"), spec.ae_preprocess_file)
        ckpt = ae_mod.load_checkpoint(paths[spec.ae_file], self._settings.allow_unsafe_torch_load)
        _need(ckpt, ("state_dict", "features", "threshold"), spec.ae_file)

        feats = tuple(if_raw["features"])
        for fname, other in ((spec.ae_preprocess_file, pre_raw["features"]), (spec.ae_file, ckpt["features"])):
            if tuple(other) != feats:
                raise ModelArtifactError(
                    f"Feature list/order in '{fname}' differs from the Isolation Forest bundle for "
                    f"'{spec.name}'. Refusing to run with mismatched features.",
                    code="FEATURE_MISMATCH", details={"artifact": fname},
                )
        if feats != spec.features:
            raise ModelArtifactError(
                f"Artifact feature list for '{spec.name}' does not match the configured spec "
                f"({len(feats)} vs {spec.feature_count}).", code="FEATURE_MISMATCH",
            )
        for obj, what in ((if_raw["imputer"], "IF imputer"), (if_raw["scaler"], "IF scaler"),
                          (pre_raw["imputer"], "AE imputer"), (pre_raw["scaler"], "AE scaler"),
                          (if_raw["model"], "Isolation Forest")):
            n_in = getattr(obj, "n_features_in_", None)
            if n_in is not None and n_in != len(feats):
                raise ModelArtifactError(
                    f"{what} expects {n_in} features but '{spec.name}' defines {len(feats)}.",
                    code="FEATURE_MISMATCH",
                )
        if not np.allclose(if_raw["scaler"].center_, pre_raw["scaler"].center_) or not np.allclose(
            if_raw["scaler"].scale_, pre_raw["scaler"].scale_
        ):
            notes.append("IF and AE scalers differ; each detector uses its own (as trained).")

        ae_net = ae_mod.build_model(ckpt, f"{spec.name} autoencoder")
        if ae_mod.input_dim(ae_net) != len(feats):
            raise ModelArtifactError("Autoencoder input_dim differs from the feature count.", code="FEATURE_MISMATCH")

        import sklearn

        # sklearn does not keep the pickling version on the object; a mismatch is reported
        # through InconsistentVersionWarning, otherwise the versions are equal.
        trained_v = next(
            (v for w in caught if (v := getattr(w.message, "original_sklearn_version", None))),
            sklearn.__version__,
        )
        bundle = ModelBundle(
            spec=spec, features=feats,
            if_model=if_raw["model"], if_imputer=if_raw["imputer"], if_scaler=if_raw["scaler"],
            if_threshold=_thr(if_raw["threshold"], "Isolation Forest", spec.if_file),
            ae_net=ae_net, ae_imputer=pre_raw["imputer"], ae_scaler=pre_raw["scaler"],
            ae_threshold=_thr(ckpt["threshold"], "Autoencoder", spec.ae_file),
            trained_sklearn_version=trained_v, load_notes=notes,
        )
        log.info("Loaded model '%s' (IF thr=%.6g, AE thr=%.6g)", spec.name, bundle.if_threshold, bundle.ae_threshold)
        return bundle


def window_contract() -> dict[str, int]:
    return {"window_size": PIPELINE.window_size, "stride": PIPELINE.stride}
