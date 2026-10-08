"""Down-sampling helper for signal charts."""
from __future__ import annotations

import numpy as np


def downsample_minmax(t: np.ndarray, v: np.ndarray, max_points: int) -> tuple[np.ndarray, np.ndarray]:
    """Reduce to <= max_points keeping each bucket's min and max (preserves spikes).

    Order is chronological. Returns inputs unchanged when already small enough.
    """
    n = len(t)
    if n <= max_points or max_points < 4:
        return t, v
    buckets = max_points // 2
    edges = np.linspace(0, n, buckets + 1, dtype=int)
    idx: list[int] = []
    for a, b in zip(edges[:-1], edges[1:]):
        if b <= a:
            continue
        seg = v[a:b]
        lo, hi = a + int(seg.argmin()), a + int(seg.argmax())
        idx.extend(sorted({lo, hi}))
    sel = np.array(idx, dtype=int)
    return t[sel], v[sel]
