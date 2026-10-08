import io

import pytest

from burninwatch.errors import (
    CsvValidationError,
    MissingColumnsError,
    UnsupportedFileTypeError,
    UploadError,
    UploadTooLargeError,
)
from burninwatch.services import csv_service
from conftest import to_csv_bytes


def test_valid_csv_parses(frame):
    parsed = csv_service.parse_csv(to_csv_bytes(frame), "x.csv")
    assert len(parsed.frame) == len(frame)


def test_missing_columns_reports_names(frame):
    bad = frame.drop(columns=["node2Voltage", "packageTemperature"])
    with pytest.raises(MissingColumnsError) as e:
        csv_service.parse_csv(to_csv_bytes(bad), "x.csv")
    assert set(e.value.details["missing_columns"]) == {"node2Voltage", "packageTemperature"}


def test_header_case_and_whitespace_tolerated(frame):
    raw = to_csv_bytes(frame).decode().replace("timeEpoch", " timeepoch ", 1).encode()
    assert "timeEpoch" in csv_service.parse_csv(raw, "x.csv").frame.columns


def test_ambient_optional(frame):
    assert csv_service.parse_csv(to_csv_bytes(frame), "x.csv")  # no ambientTemperature column


def test_non_csv_extension_rejected():
    with pytest.raises(UnsupportedFileTypeError):
        csv_service.validate_upload_metadata("data.xlsx", "text/csv")


def test_bad_content_type_rejected():
    with pytest.raises(UnsupportedFileTypeError):
        csv_service.validate_upload_metadata("data.csv", "image/png")


def test_filename_path_stripped():
    assert csv_service.validate_upload_metadata("..\\..\\evil/test.csv", "text/csv") == "test.csv"


def test_size_limit():
    with pytest.raises(UploadTooLargeError):
        csv_service.read_limited(io.BytesIO(b"a" * 2000), max_bytes=1000)


def test_empty_upload():
    with pytest.raises(UploadError):
        csv_service.read_limited(io.BytesIO(b""), 1000)


def test_binary_rejected():
    with pytest.raises(CsvValidationError):
        csv_service.parse_csv(b"\x00\x01\x02" * 100, "x.csv")
