"""Shared fixtures. All data is small and synthetic; the 68k-row dataset is never needed.

Synthetic model artifacts are built HERE (tests only) to exercise the loader/inference
code paths. Production code never trains or fits anything.
"""
from __future__ import annotations

import io
import joblib
import numpy as np
import pandas as pd
import pytest
import torch
from sklearn.ensemble import IsolationForest

from burninwatch.config import Settings
from burninwatch.main import create_app
from burninwatch.ml.model_registry import MODEL_SPECS, ModelRegistry
from burninwatch.services import preprocessing, windowing
from burninwatch.services.features import extract_features


def make_test_frame(n: int = 1000, anomaly: bool = False, seed: int = 0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    t = 1000.0 + np.arange(n) * 0.2
    df = pd.DataFrame(
        {
            "timeEpoch": t,
            "supplyVoltage": 12 + rng.normal(0, 0.01, n),
            "node1Voltage": 11 + rng.normal(0, 0.01, n),
            "node2Voltage": 5 + rng.normal(0, 0.01, n),
            "collectorEmitterCurrent": 2 + rng.normal(0, 0.01, n),
            "heatSinkTemperature": 40 + rng.normal(0, 0.05, n),
            "packageTemperature": 60 + rng.normal(0, 0.1, n),
            "internalTemperature": 70 + rng.normal(0, 0.1, n),
        }
    )
    if anomaly:
        s = int(n * 0.7)
        df.loc[s:, "collectorEmitterCurrent"] += np.linspace(0, 1.5, n - s) + rng.normal(0, 0.2, n - s)
        df.loc[s:, "packageTemperature"] += np.linspace(0, 25, n - s)
        df.loc[s:, "node2Voltage"] += rng.normal(0, 0.3, n - s)
    return df


def to_csv_bytes(df: pd.DataFrame) -> bytes:
    return df.to_csv(index=False).encode("utf-8")


@pytest.fixture
def frame():
    return make_test_frame()


@pytest.fixture
def anomalous_frame():
    return make_test_frame(anomaly=True)


def _feature_matrix(seed: int) -> pd.DataFrame:
    df = make_test_frame(2000, seed=seed)
    c = preprocessing.clean(df)
    return extract_features(windowing.build_windows(c.frame), preprocessing.compute_baseline(c.frame))


def build_artifacts(directory, names=("response_focused", "expanded")) -> None:
    """Write small synthetic artifacts in the EXACT format notebook 12 saves (tests only)."""
    from sklearn.impute import SimpleImputer
    from sklearn.preprocessing import RobustScaler

    from burninwatch.ml.autoencoder import BurnInAutoencoder

    feats = _feature_matrix(seed=1)
    torch.manual_seed(0)
    for name in names:
        spec = MODEL_SPECS[name]
        cols = list(spec.features)
        X = feats[cols].to_numpy()
        imp = SimpleImputer(strategy="median").fit(X)
        sc = RobustScaler().fit(imp.transform(X))
        Xs = sc.transform(imp.transform(X))
        iso = IsolationForest(n_estimators=50, random_state=42).fit(Xs)
        net = BurnInAutoencoder(len(cols)).eval()
        with torch.no_grad():
            t = torch.tensor(Xs, dtype=torch.float32)
            ae_err = ((net(t) - t) ** 2).mean(1).numpy()
        if_thr = float(np.quantile(-iso.decision_function(Xs), 0.95))
        ae_thr = float(np.quantile(ae_err, 0.95))
        joblib.dump({"imputer": imp, "scaler": sc, "model": iso, "features": cols, "threshold": if_thr},
                    directory / spec.if_file)
        joblib.dump({"imputer": imp, "scaler": sc, "features": cols}, directory / spec.ae_preprocess_file)
        torch.save({"state_dict": net.state_dict(), "input_dim": len(cols), "features": cols, "threshold": ae_thr},
                   directory / spec.ae_file)


@pytest.fixture(scope="session")
def artifact_dir(tmp_path_factory):
    d = tmp_path_factory.mktemp("models_dict")
    build_artifacts(d)
    return d


@pytest.fixture
def settings(artifact_dir):
    return Settings(models_dir=artifact_dir)


@pytest.fixture
def registry(settings):
    return ModelRegistry(settings)


@pytest.fixture
def client(settings):
    from fastapi.testclient import TestClient

    return TestClient(create_app(settings))


@pytest.fixture
def upload():
    def _upload(df, name="burnin_test.csv", ctype="text/csv"):
        return {"file": (name, io.BytesIO(to_csv_bytes(df)), ctype)}

    return _upload
