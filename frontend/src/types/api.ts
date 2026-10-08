/** Mirrors the FastAPI contracts in backend/src/burninwatch/schemas (source of truth). */

export type ScreeningStatus = "NORMAL" | "REVIEW" | "ANOMALY";
export type Detection = "both" | "isolation_forest" | "autoencoder" | "none";

export interface ModelInfo {
  name: string;
  version: string;
  description: string;
  feature_count: number;
  features: string[];
  window_size: number;
  stride: number;
  trained_sklearn_version: string | null;
}

export interface BaselineSummary {
  rows: number;
  train_rows: number;
  values: Record<string, number>;
  method: string;
}

export interface InputInfo {
  filename: string;
  total_rows: number;
  valid_rows: number;
  dropped_rows: number;
  windows: number;
  time_start: number;
  time_end: number;
  duration_s: number;
  median_sampling_interval_s: number | null;
  signals: string[];
  baseline_rows: number;
  baseline: BaselineSummary | null;
  unused_tail_rows: number;
  was_reordered: boolean;
  duplicate_timestamps: number;
  dropped_by_reason: Record<string, number>;
  warnings: string[];
}

export interface Agreement {
  isolation_forest_flagged: number;
  autoencoder_flagged: number;
  both: number;
  isolation_forest_only: number;
  autoencoder_only: number;
  neither: number;
}

export interface Summary {
  status: ScreeningStatus;
  normal_windows: number;
  review_windows: number;
  anomalous_windows: number;
  total_windows: number;
  anomaly_fraction: number;
  total_samples: number;
  episodes: number;
  max_if_score: number;
  max_ae_score: number;
  max_ae_to_threshold: number;
  agreement: Agreement;
}

export interface Thresholds {
  isolation_forest: number;
  autoencoder: number;
}

/** One model feature for one window; every number comes from the actual run. */
export interface FeatureExplanation {
  feature: string;
  signal: string;
  indicator: string;
  current_value: number;
  learned_normal_value: number;
  reconstructed_value: number | null;
  deviation: number;
  pct_deviation: number | null;
  normalized_deviation: number;
  ae_error: number;
  ae_error_share: number;
  if_contribution: number | null;
  direction: "above" | "below";
}

export interface EpisodeFeature {
  feature: string;
  signal: string;
  indicator: string;
  mean_ae_error_share: number;
  mean_if_contribution: number | null;
  mean_abs_normalized_deviation: number;
  direction: "above" | "below";
}

export interface EpisodeSignal {
  signal: string;
  mean_ae_error_share: number;
}

export interface Episode {
  id: number;
  first_window: number;
  last_window: number;
  start_row: number;
  end_row: number;
  start_time: number;
  end_time: number;
  duration_s: number;
  windows: number;
  span_windows: number;
  review_windows_in_span: number;
  max_if_score: number;
  mean_if_score: number;
  max_ae_score: number;
  mean_ae_score: number;
  max_ae_to_threshold: number;
  max_if_margin: number;
  agreement_pct: number;
  peak_window: number;
  top_features: EpisodeFeature[];
  top_signals: EpisodeSignal[];
}

export interface PeakWindow {
  window_index: number;
  start_time: number;
  end_time: number;
  isolation_forest_score: number;
  autoencoder_score: number;
  status: ScreeningStatus;
  top_features: FeatureExplanation[];
}

export interface TimelinePoint {
  window_index: number;
  start_row: number;
  end_row: number;
  start_time: number;
  end_time: number;
  isolation_forest_score: number;
  autoencoder_score: number;
  isolation_forest_flag: boolean;
  autoencoder_flag: boolean;
  status: ScreeningStatus;
}

export interface DistributionCheck {
  status: "ok" | "suspect";
  median_ae_to_threshold: number;
  ae_flag_fraction: number;
  if_flag_fraction: number;
  message: string;
}

export interface StageTimings {
  parse_clean_ms: number;
  windowing_ms: number;
  features_ms: number;
  inference_ms: number;
  explanation_ms: number;
  total_ms: number;
}

export interface ScreeningResult {
  screening_id: string;
  device_id: string;
  created_at: string;
  model: ModelInfo;
  input: InputInfo;
  summary: Summary;
  thresholds: Thresholds;
  episodes: Episode[];
  episode_rule: string;
  peak: PeakWindow;
  top_features: FeatureExplanation[];
  distribution_check: DistributionCheck;
  timeline: TimelinePoint[];
  timings_ms: StageTimings;
  disclaimer: string;
}

export interface ScreeningListItem {
  screening_id: string;
  device_id: string;
  created_at: string;
  filename: string;
  model_name: string;
  status: ScreeningStatus;
  total_windows: number;
  review_windows: number;
  anomalous_windows: number;
  anomaly_fraction: number;
  episodes: number;
}

export interface ScreeningListResponse {
  items: ScreeningListItem[];
  total: number;
  storage: "memory";
}

export interface SignalLevel {
  signal: string;
  window_mean: number;
  window_min: number;
  window_max: number;
  baseline_median: number | null;
  delta_from_baseline: number | null;
  pct_from_baseline: number | null;
}

export interface NeighborWindow {
  window_index: number;
  start_time: number;
  end_time: number;
  isolation_forest_score: number;
  autoencoder_score: number;
  isolation_forest_flag: boolean;
  autoencoder_flag: boolean;
  status: ScreeningStatus;
  is_selected: boolean;
}

export interface WindowDetail {
  screening_id: string;
  window_index: number;
  start_row: number;
  end_row: number;
  start_time: number;
  end_time: number;
  record_count: number;
  isolation_forest_score: number;
  isolation_forest_threshold: number;
  isolation_forest_flag: boolean;
  autoencoder_score: number;
  autoencoder_threshold: number;
  autoencoder_flag: boolean;
  status: ScreeningStatus;
  detection: Detection;
  episode_id: number | null;
  why_flagged: string[];
  features: FeatureExplanation[];
  raw_time: number[];
  raw_measurements: Record<string, number[]>;
  signal_levels: SignalLevel[];
  nearby: NeighborWindow[];
  if_attribution_method: string;
  ae_attribution_method: string;
}

export interface BaselineInfo {
  value: number;
  rows: number;
  time_start: number;
  time_end: number;
}

export interface FlaggedInterval {
  window_index: number;
  start_time: number;
  end_time: number;
  status: ScreeningStatus;
}

export interface EpisodeInterval {
  id: number;
  start_time: number;
  end_time: number;
}

export interface SignalSeries {
  screening_id: string;
  signal: string;
  unit_note: string;
  total_points: number;
  returned_points: number;
  downsampled: boolean;
  range_start: number;
  range_end: number;
  time: number[];
  value: number[];
  baseline: BaselineInfo | null;
  flagged_windows: FlaggedInterval[];
  episodes: EpisodeInterval[];
}

/** Offline (research) evaluation - static, separate from Live Screening. */
export interface OfflineDeviceRow {
  device_id: string;
  file: string;
  role: string;
  evaluation_windows: number;
  if_flag_fraction: number;
  ae_flag_fraction: number;
  both_flagged: number;
}

export interface OfflineModelEvaluation {
  model: string;
  feature_set: string;
  feature_count: number;
  threshold_if: number;
  threshold_ae: number;
  train_windows: number;
  validation_windows: number;
  evaluation_windows: number;
  if_flag_fraction: number;
  ae_flag_fraction: number;
  both_flagged: number;
  if_only: number;
  ae_only: number;
  score_correlation: number;
  ae_final_training_loss: number | null;
  per_device: OfflineDeviceRow[];
}

export interface OfflineEvaluation {
  title: string;
  generated_from: string[];
  validation_methodology: string;
  threshold_method: string;
  models: OfflineModelEvaluation[];
  available_metrics: string[];
  unavailable_metrics: Record<string, string>;
  dataset: {
    independent_devices: number;
    devices: string[];
    files: { device_id: string; file: string; role: string; windows: number }[];
    total_windows: number;
  };
  limitations: string[];
  artifact_rescoring_check: Record<string, { max_abs_if_score_diff: number; max_abs_ae_score_diff: number; windows_rescored: number }>;
}

export type CheckStatus = "pass" | "warn" | "fail" | "skipped";

export interface DatasetCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string | null;
}

export interface DatasetValidation {
  valid: boolean;
  filename: string;
  size_bytes: number;
  total_rows: number | null;
  valid_rows: number | null;
  dropped_rows: number | null;
  columns_found: string[];
  required_columns: string[];
  missing_columns: string[];
  column_hints: Record<string, string[]>;
  time_start: number | null;
  time_end: number | null;
  duration: number | null;
  expected_windows: number | null;
  window_size: number;
  stride: number;
  min_rows: number;
  checks: DatasetCheck[];
}

export interface ModelDescriptor {
  name: string;
  version: string;
  description: string;
  is_default: boolean;
  feature_count: number;
  features: string[];
  window_size: number;
  stride: number;
  artifacts_available: boolean;
  missing_artifacts: string[];
  loaded: boolean;
  thresholds: Thresholds | null;
}

export interface ModelList {
  default_model: string;
  models: ModelDescriptor[];
}

export interface Health {
  status: "ok" | "degraded";
  app: string;
  version: string;
  time: string;
  models: Record<string, boolean>;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}
