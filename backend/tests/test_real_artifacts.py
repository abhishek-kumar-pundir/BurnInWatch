"""Against the REAL trained artifacts + research outputs (skipped if they are not present)."""
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
SAMPLE = BACKEND.parent / "processed" / "sample_burnin_device4_main.csv"
NB_WINDOWS = BACKEND.parent / "processed" / "burninwatch_expanded_overlapping_windows_v2.csv"
REAL = all((BACKEND / "models" / f).is_file() for f in (
    "burninwatch_expanded_response_focused_IF.joblib", "burninwatch_expanded_response_focused_AE.pt",
    "burninwatch_expanded_response_focused_AE_preprocess.joblib"))
pytestmark = pytest.mark.skipif(not (REAL and SAMPLE.is_file() and NB_WINDOWS.is_file()),
                                reason="real artifacts / research outputs not present")


def test_parity_with_training_notebook():
    """Features, IF scores, AE scores and flags equal the notebook's own outputs (see verify_parity.py)."""
    p = subprocess.run([sys.executable, str(BACKEND / "scripts" / "verify_parity.py")], capture_output=True, text=True)
    assert p.returncode == 0, p.stdout + p.stderr
    assert "PARITY: PASS" in p.stdout


@pytest.mark.parametrize("model", ["response_focused", "expanded"])
def test_sample_csv_is_not_all_anomalous(model):
    """Regression for the 'AE flags every window at 1000x threshold' bug."""
    from burninwatch.config import Settings
    from burninwatch.ml.model_registry import ModelRegistry
    from burninwatch.services.repository import InMemoryScreeningRepository
    from burninwatch.services.screening_service import ScreeningService

    s = Settings()
    r = ScreeningService(s, ModelRegistry(s), InMemoryScreeningRepository()).analyze(
        raw=SAMPLE.read_bytes(), filename=SAMPLE.name, device_id="Device-4", model_name=model)
    assert r.summary.total_windows == 427
    assert r.distribution_check.status == "ok"
    ag = r.summary.agreement
    assert ag.autoencoder_flagged / 427 < 0.2 and ag.isolation_forest_flagged / 427 < 0.2
    assert r.summary.normal_windows > 0.8 * 427
