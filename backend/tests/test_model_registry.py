import pytest

from burninwatch.config import Settings
from burninwatch.errors import ModelArtifactError, UnknownModelError
from burninwatch.ml.model_registry import MODEL_SPECS, ModelRegistry
from conftest import build_artifacts


def test_known_models_and_default(registry):
    assert set(MODEL_SPECS) == {"response_focused", "expanded"}
    assert registry.spec(None).name == "response_focused"


def test_unknown_model_rejected(registry):
    with pytest.raises(UnknownModelError):
        registry.spec("../../etc/passwd")


def test_load_and_cache(registry):
    assert not registry.is_loaded("response_focused")
    a = registry.get("response_focused")
    assert registry.get("response_focused") is a  # cached, not reloaded
    assert a.spec.feature_count == 20 and a.if_threshold > 0 and a.ae_threshold > 0
    assert registry.get("expanded").spec.feature_count == 31


def test_missing_artifacts_reported(tmp_path):
    reg = ModelRegistry(Settings(models_dir=tmp_path))
    with pytest.raises(ModelArtifactError) as e:
        reg.get("expanded")
    assert e.value.status_code == 503 and e.value.details["missing_artifacts"]


def test_thresholds_come_from_artifacts_and_are_not_recomputed(tmp_path):
    import joblib

    build_artifacts(tmp_path, names=("response_focused",))
    p = tmp_path / MODEL_SPECS["response_focused"].if_file
    obj = joblib.load(p)
    obj["threshold"] = 0.123456
    joblib.dump(obj, p)
    b = ModelRegistry(Settings(models_dir=tmp_path)).get("response_focused")
    assert b.if_threshold == 0.123456


def test_missing_threshold_refuses_to_load(tmp_path):
    import joblib

    build_artifacts(tmp_path, names=("response_focused",))
    p = tmp_path / MODEL_SPECS["response_focused"].if_file
    obj = joblib.load(p)
    obj["threshold"] = float("nan")
    joblib.dump(obj, p)
    with pytest.raises(ModelArtifactError) as e:
        ModelRegistry(Settings(models_dir=tmp_path)).get("response_focused")
    assert "never recomputed" in e.value.message


def test_feature_list_mismatch_rejected(tmp_path):
    import joblib

    build_artifacts(tmp_path, names=("response_focused",))
    p = tmp_path / MODEL_SPECS["response_focused"].if_file
    obj = joblib.load(p)
    obj["features"] = list(reversed(obj["features"]))  # same set, different ORDER must be refused
    joblib.dump(obj, p)
    with pytest.raises(ModelArtifactError) as e:
        ModelRegistry(Settings(models_dir=tmp_path)).get("response_focused")
    assert e.value.code == "FEATURE_MISMATCH"


def test_autoencoder_architecture_mismatch_rejected(tmp_path):
    import torch

    build_artifacts(tmp_path, names=("response_focused",))
    p = tmp_path / MODEL_SPECS["response_focused"].ae_file
    ck = torch.load(p, weights_only=True)
    ck["state_dict"] = {k.replace("encoder.2", "encoder.3"): v for k, v in ck["state_dict"].items()}
    torch.save(ck, p)
    with pytest.raises(ModelArtifactError) as e:
        ModelRegistry(Settings(models_dir=tmp_path)).get("response_focused")
    assert e.value.code == "MODEL_ARCHITECTURE_MISMATCH"
