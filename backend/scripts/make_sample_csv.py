"""Write a synthetic burn-in CSV for manual API testing:
    python scripts/make_sample_csv.py sample.csv --rows 2000 --anomaly
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tests"))
from conftest import make_test_frame  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("out")
ap.add_argument("--rows", type=int, default=2000)
ap.add_argument("--anomaly", action="store_true", help="inject drift in the last 30%% of rows")
a = ap.parse_args()
make_test_frame(a.rows, anomaly=a.anomaly).to_csv(a.out, index=False)
print(f"wrote {a.out} ({a.rows} rows)")
