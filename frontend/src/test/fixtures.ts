import type { DatasetValidation, ScreeningResult, TimelinePoint } from "../types/api";

export function point(i: number, ifFlag: boolean, aeFlag: boolean): TimelinePoint {
  return {
    window_index: i,
    start_row: i * 25,
    end_row: i * 25 + 99,
    start_time: 1000 + i * 5,
    end_time: 1019.8 + i * 5,
    isolation_forest_score: ifFlag ? 0.12 : 0.03,
    autoencoder_score: aeFlag ? 0.5 : 0.1,
    isolation_forest_flag: ifFlag,
    autoencoder_flag: aeFlag,
    status: ifFlag && aeFlag ? "ANOMALY" : ifFlag || aeFlag ? "REVIEW" : "NORMAL",
  };
}

export const validValidation: DatasetValidation = {
  valid: true,
  filename: "burnin_test.csv",
  size_bytes: 120_000,
  total_rows: 1000,
  valid_rows: 998,
  dropped_rows: 2,
  columns_found: ["timeEpoch", "supplyVoltage", "node1Voltage", "node2Voltage", "collectorEmitterCurrent", "heatSinkTemperature", "packageTemperature", "internalTemperature"],
  required_columns: ["timeEpoch", "supplyVoltage", "node1Voltage", "node2Voltage", "collectorEmitterCurrent", "heatSinkTemperature", "packageTemperature", "internalTemperature"],
  missing_columns: [],
  column_hints: {},
  time_start: 1000,
  time_end: 1199.8,
  duration: 199.8,
  expected_windows: 37,
  window_size: 100,
  stride: 25,
  min_rows: 100,
  checks: [
    { id: "readable", label: "CSV readable", status: "pass", detail: "1,000 records, 8 columns." },
    { id: "columns", label: "Required columns detected", status: "pass", detail: null },
    { id: "numeric", label: "Numeric measurements valid", status: "warn", detail: "2 row(s) are unusable and will be dropped." },
    { id: "records", label: "Sufficient records for windowing", status: "pass", detail: null },
  ],
};

export const invalidValidation: DatasetValidation = {
  ...validValidation,
  valid: false,
  columns_found: ["timeEpoch", "collectorCurrent", "temperature"],
  missing_columns: ["collectorEmitterCurrent"],
  column_hints: { collectorEmitterCurrent: ["collectorCurrent"] },
  checks: [
    { id: "readable", label: "CSV readable", status: "pass", detail: null },
    { id: "columns", label: "Required columns detected", status: "fail", detail: "Missing required column(s): collectorEmitterCurrent." },
    { id: "numeric", label: "Numeric measurements valid", status: "skipped", detail: "Not evaluated because an earlier check failed." },
  ],
};

export function makeResult(statuses: [boolean, boolean][]): ScreeningResult {
  const timeline = statuses.map(([a, b], i) => point(i, a, b));
  const both = timeline.filter((p) => p.status === "ANOMALY").length;
  const review = timeline.filter((p) => p.status === "REVIEW").length;
  const overall = both > 0 ? "ANOMALY" : review > 0 ? "REVIEW" : "NORMAL";
  return {
    screening_id: "scr_test",
    device_id: "IGBT-001",
    created_at: "2026-10-01T09:00:00Z",
    model: { name: "response_focused", version: "v2", description: "", feature_count: 20, features: [], window_size: 100, stride: 25, trained_sklearn_version: "1.9.0" },
    input: {
      filename: "burnin_test.csv", total_rows: 1000, valid_rows: 998, dropped_rows: 2, windows: timeline.length,
      time_start: 1000, time_end: 1200, duration_s: 200, median_sampling_interval_s: 0.5, signals: ["node2Voltage", "packageTemperature"],
      baseline_rows: 100, baseline: null, unused_tail_rows: 1, was_reordered: false,
      duplicate_timestamps: 0, dropped_by_reason: {}, warnings: ["2 row(s) were dropped during cleaning."],
    },
    summary: {
      status: overall, normal_windows: timeline.length - both - review, review_windows: review, anomalous_windows: both,
      total_windows: timeline.length, anomaly_fraction: timeline.length ? both / timeline.length : 0,
      total_samples: 998, episodes: 0, max_if_score: 0.1, max_ae_score: 0.4, max_ae_to_threshold: 1.4,
      agreement: { isolation_forest_flagged: both, autoencoder_flagged: both, both, isolation_forest_only: 0, autoencoder_only: 0, neither: timeline.length - both },
    },
    thresholds: { isolation_forest: 0.069, autoencoder: 0.2876 },
    peak: { window_index: 0, start_time: 1000, end_time: 1019.8, isolation_forest_score: 0.03, autoencoder_score: 0.1, status: timeline[0]?.status ?? "NORMAL", top_features: [] },
    episodes: [],
    episode_rule: "An anomaly episode merges windows flagged by BOTH detectors.",
    top_features: [],
    distribution_check: { status: "ok", median_ae_to_threshold: 0.3, ae_flag_fraction: 0.05, if_flag_fraction: 0.05, message: "ok" },
    timeline,
    timings_ms: { parse_clean_ms: 5, windowing_ms: 1, features_ms: 3, inference_ms: 40, explanation_ms: 2, total_ms: 51 },
    disclaimer: "BurnInWatch produces unsupervised anomaly-screening signals.",
  };
}
