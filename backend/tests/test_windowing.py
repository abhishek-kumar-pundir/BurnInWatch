import numpy as np
import pytest

from burninwatch.errors import InsufficientDataError
from burninwatch.services import preprocessing as pp
from burninwatch.services import windowing as w


def test_window_count_formula():
    assert w.n_windows_for(100) == 1
    assert w.n_windows_for(124) == 1
    assert w.n_windows_for(125) == 2
    assert w.n_windows_for(1000) == 37
    assert w.n_windows_for(99) == 0


def test_100_25_overlap(frame):
    c = pp.clean(frame)
    ws = w.build_windows(c.frame)
    assert ws.n_windows == 37
    assert ws.arrays["timeEpoch"].shape == (37, 100)
    assert list(ws.start_rows[:3]) == [0, 25, 50]
    # consecutive windows overlap by 75 records
    assert np.array_equal(ws.arrays["node2Voltage"][0][25:], ws.arrays["node2Voltage"][1][:75])
    assert ws.start_times[1] == c.frame["timeEpoch"].iloc[25]
    assert ws.end_times[0] == c.frame["timeEpoch"].iloc[99]
    assert ws.unused_tail_rows == 1000 - (36 * 25 + 100)


def test_too_short_raises(frame):
    with pytest.raises(InsufficientDataError):
        w.build_windows(frame.head(99))
