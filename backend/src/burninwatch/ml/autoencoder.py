"""PyTorch autoencoder used for INFERENCE only.

The architecture is the exact ``BurnInAutoencoder`` from notebook 05 (formerly 12)::

    encoder = Linear(d, h) -> ReLU -> Linear(h, b)        # NO activation on the bottleneck
    decoder = Linear(b, h) -> ReLU -> Linear(h, d)        # linear output
    h = max(16, min(64, 2*d)),  b = max(4, min(12, d // 3))

The previous backend rebuilt a flat network from the state_dict and inserted a ReLU on the
bottleneck, which silently changed every reconstruction. Here the layer layout is fixed and
the checkpoint must match it key-for-key and shape-for-shape, otherwise loading fails.
"""
from __future__ import annotations

from collections import OrderedDict
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch import nn

from ..errors import ModelArtifactError

_EXPECTED_KEYS = (
    "encoder.0.weight", "encoder.0.bias", "encoder.2.weight", "encoder.2.bias",
    "decoder.0.weight", "decoder.0.bias", "decoder.2.weight", "decoder.2.bias",
)


class BurnInAutoencoder(nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int | None = None, bottleneck_dim: int | None = None):
        super().__init__()
        hidden_dim = hidden_dim or max(16, min(64, input_dim * 2))
        bottleneck_dim = bottleneck_dim or max(4, min(12, input_dim // 3))
        self.encoder = nn.Sequential(nn.Linear(input_dim, hidden_dim), nn.ReLU(), nn.Linear(hidden_dim, bottleneck_dim))
        self.decoder = nn.Sequential(nn.Linear(bottleneck_dim, hidden_dim), nn.ReLU(), nn.Linear(hidden_dim, input_dim))

    def forward(self, x: torch.Tensor) -> torch.Tensor:  # noqa: D102
        return self.decoder(self.encoder(x))


def load_checkpoint(path: Path, allow_unsafe: bool = False) -> dict[str, Any]:
    """Load the notebook's ``torch.save({state_dict, input_dim, features, threshold})``."""
    try:
        obj = torch.load(path, map_location="cpu", weights_only=not allow_unsafe)
    except Exception as exc:  # noqa: BLE001
        raise ModelArtifactError(
            f"Could not load autoencoder checkpoint '{path.name}': {exc}",
            details={"artifact": path.name},
        ) from exc
    if not isinstance(obj, dict) or "state_dict" not in obj:
        raise ModelArtifactError(
            f"'{path.name}' is not a BurnInWatch checkpoint (expected keys state_dict, input_dim, "
            f"features, threshold).",
            details={"artifact": path.name},
        )
    return obj


def build_model(checkpoint: dict[str, Any], name: str = "autoencoder") -> BurnInAutoencoder:
    sd: OrderedDict = OrderedDict((k.removeprefix("module."), v) for k, v in checkpoint["state_dict"].items())
    if sorted(sd) != sorted(_EXPECTED_KEYS):
        raise ModelArtifactError(
            f"{name}: state_dict layout {sorted(sd)} differs from the BurnInAutoencoder "
            f"(expected {sorted(_EXPECTED_KEYS)}).",
            code="MODEL_ARCHITECTURE_MISMATCH",
        )
    d = int(checkpoint.get("input_dim", sd["encoder.0.weight"].shape[1]))
    h, b = sd["encoder.0.weight"].shape[0], sd["encoder.2.weight"].shape[0]
    net = BurnInAutoencoder(d, h, b)
    try:
        net.load_state_dict(sd, strict=True)
    except RuntimeError as exc:
        raise ModelArtifactError(f"{name}: cannot load weights: {exc}", code="MODEL_ARCHITECTURE_MISMATCH") from exc
    net.eval()
    for p in net.parameters():
        p.requires_grad_(False)
    return net


def input_dim(net: BurnInAutoencoder) -> int:
    return net.encoder[0].in_features


@torch.no_grad()
def reconstruct(net: BurnInAutoencoder, x: np.ndarray, batch_size: int = 2048) -> np.ndarray:
    """Reconstruction in the model's (scaled) feature space, float32 like training."""
    if x.ndim != 2 or x.shape[1] != input_dim(net):
        raise ModelArtifactError(
            f"Autoencoder expects {input_dim(net)} input features but received shape {x.shape}.",
            code="FEATURE_MISMATCH",
        )
    out = np.empty(x.shape, dtype="float32")
    for s in range(0, len(x), batch_size):
        batch = torch.from_numpy(np.ascontiguousarray(x[s : s + batch_size], dtype="float32"))
        out[s : s + len(batch)] = net(batch).numpy()
    return out


def feature_errors(x: np.ndarray, recon: np.ndarray) -> np.ndarray:
    """Per-feature squared reconstruction error (n_windows, n_features), float64."""
    return (x.astype("float32") - recon).astype("float64") ** 2
