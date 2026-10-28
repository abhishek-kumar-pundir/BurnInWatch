import numpy as np
import pytest

from burninwatch.errors import InsufficientDataError
from burninwatch.services import preprocessing as pp


def test_numeric_conversion_and_inf(frame):
    f = frame.astype(str)
    f.loc[3, "node2Voltage"] = "abc"
    f.loc[4, "supplyVoltage"] = "inf"
    out = pp.to_numeric(f)
    assert out["node2Voltage"].dtype == "float64"
    assert np.isnan(out.loc[3, "node2Voltage"]) and np.isnan(out.loc[4, "supplyVoltage"])


def test_clean_drops_invalid_rows_and_counts(frame):
    f = frame.astype(str)
    f.loc[3, "node2Voltage"] = "oops"
    f.loc[10, "timeEpoch"] = ""
    c = pp.clean(f)
    assert c.dropped_rows == 2 and c.valid_rows == len(frame) - 2
    assert c.total_rows == len(frame)
    assert c.dropped_by_reason["non_numeric_or_missing_node2Voltage"] == 1


def test_any_required_column_nan_drops_row_like_training(frame):
    """Notebook 05 (formerly 12) used dropna over all 8 numeric columns, so heatSink/internal NaN rows are dropped too."""
    f = frame.copy()
    f.loc[5, "internalTemperature"] = np.nan
    c = pp.clean(f)
    assert c.dropped_rows == 1 and c.dropped_by_reason["non_numeric_or_missing_internalTemperature"] == 1


def test_measurement_valid_false_dropped(frame):
    f = frame.copy()
    f["measurement_valid"] = True
    f.loc[:9, "measurement_valid"] = False
    assert pp.clean(f.astype(str)).dropped_rows == 10


def test_sorted_chronologically(frame):
    shuffled = frame.sample(frac=1.0, random_state=1)
    c = pp.clean(shuffled)
    assert c.was_reordered and c.frame["timeEpoch"].is_monotonic_increasing


def test_too_few_rows(frame):
    with pytest.raises(InsufficientDataError):
        pp.clean(frame.head(50))


def test_baseline_follows_training_rule(frame):
    """train_n = floor(0.2 n); reference = first max(20, int(0.1 * train_n)) rows (~2 % of the file)."""
    c = pp.clean(frame)  # 1000 rows -> train 200 -> reference 20
    b = pp.compute_baseline(c.frame)
    assert (b.train_rows, b.n_rows) == (200, 20)
    assert b.values["node2Voltage"] == pytest.approx(c.frame["node2Voltage"].iloc[:20].median())


def test_baseline_row_counts_match_notebook_for_device4():
    assert pp.baseline_row_counts(10770) == (2154, 215)  # verified against the notebook baseline


def test_baseline_minimum_20_rows(frame):
    assert pp.compute_baseline(frame.head(120)).n_rows == 20
