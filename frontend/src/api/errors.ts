import { isAxiosError } from "axios";
import type { ApiErrorBody } from "../types/api";

export type ApiErrorKind = "network" | "timeout" | "http" | "unknown";

/** Single error type thrown by every API function. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly details: Record<string, unknown>;

  constructor(
    kind: ApiErrorKind,
    message: string,
    opts: { status?: number; code?: string; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details ?? {};
  }
}

function isErrorBody(data: unknown): data is ApiErrorBody {
  if (typeof data !== "object" || data === null || !("error" in data)) return false;
  const e = (data as { error: unknown }).error;
  return typeof e === "object" && e !== null && typeof (e as { message?: unknown }).message === "string";
}

/** Convert anything thrown (axios error, ApiError, string, ...) to an ApiError. */
export function normalizeError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (isAxiosError(err)) {
    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      return new ApiError("timeout", "The request timed out.");
    }
    if (!err.response) {
      if (err.code === "ERR_CANCELED") return new ApiError("unknown", "Request cancelled.", { code: "CANCELLED" });
      return new ApiError("network", "No response from the server.");
    }
    const { status, data } = err.response;
    if (isErrorBody(data)) {
      return new ApiError("http", data.error.message, {
        status,
        code: (data.error as { code?: string }).code,
        details: data.error.details ?? {},
      });
    }
    // FastAPI default shape or non-JSON proxy errors
    const detail =
      typeof data === "object" && data !== null && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : undefined;
    return new ApiError("http", detail ?? `Request failed with status ${status}.`, { status });
  }

  if (err instanceof Error) return new ApiError("unknown", err.message);
  return new ApiError("unknown", "An unexpected error occurred.");
}

export interface ErrorDescription {
  title: string;
  message: string;
  hint?: string;
  /** Labelled facts worth showing to the user (e.g. missing / found columns). */
  facts: { label: string; value: string }[];
  /** Developer-oriented line (shown only in development builds). */
  technical: string;
}

function list(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

/** Translate an ApiError into engineering-friendly wording. */
export function describeError(err: ApiError): ErrorDescription {
  const technical = [err.kind, err.status, err.code, err.message].filter((x) => x !== undefined).join(" · ");
  const facts: ErrorDescription["facts"] = [];
  const base = { facts, technical };

  if (err.kind === "network") {
    return {
      ...base,
      title: "Unable to connect to BurnInWatch",
      message: "The analysis service is currently unavailable.",
      hint: "Check that the backend is running and try again.",
    };
  }
  if (err.kind === "timeout") {
    return {
      ...base,
      title: "The analysis service did not respond in time",
      message: "The request took longer than expected and was stopped.",
      hint: "Try again. Very large datasets can take longer to process.",
    };
  }

  switch (err.code) {
    case "MISSING_COLUMNS": {
      const missing = list(err.details.missing_columns);
      const found = list(err.details.found_columns);
      if (missing.length) facts.push({ label: "Expected", value: missing.join(", ") });
      if (found.length) facts.push({ label: "Found", value: found.join(", ") });
      return {
        ...base,
        title: "This dataset could not be analyzed",
        message: "The file is missing required measurement columns.",
        hint: "Check the column names in the CSV header and upload the corrected file.",
      };
    }
    case "INSUFFICIENT_DATA": {
      const need = err.details.min_rows;
      const have = err.details.valid_rows;
      if (typeof have === "number") facts.push({ label: "Usable records", value: String(have) });
      if (typeof need === "number") facts.push({ label: "Required", value: `at least ${need}` });
      return {
        ...base,
        title: "Insufficient data",
        message: "The uploaded dataset does not contain enough measurements to create the required analysis windows.",
        hint: "Upload a longer capture of the burn-in test.",
      };
    }
    case "UNSUPPORTED_FILE_TYPE":
      return { ...base, title: "CSV files only", message: "Upload the burn-in measurements as a .csv file.", hint: undefined };
    case "UPLOAD_TOO_LARGE":
      return {
        ...base,
        title: "File too large",
        message: "The file exceeds the maximum upload size accepted by the analysis service.",
        hint: "Split the capture or remove unneeded columns and rows.",
      };
    case "INVALID_CSV":
    case "EMPTY_CSV":
    case "EMPTY_FILE":
    case "NO_FILE":
      return { ...base, title: "This dataset could not be read", message: err.message, hint: "Confirm the file is a valid, comma-separated CSV." };
    case "INVALID_DEVICE_ID":
      return { ...base, title: "Invalid device ID", message: err.message, hint: undefined };
    case "MODEL_UNAVAILABLE":
    case "FEATURE_MISMATCH": {
      const missing = list(err.details.missing_artifacts);
      if (missing.length) facts.push({ label: "Missing artifacts", value: missing.join(", ") });
      return {
        ...base,
        title: "Detection model unavailable",
        message: "The selected detection model could not be loaded by the analysis service.",
        hint: "Verify the trained model files in backend/models and restart the backend.",
      };
    }
    case "UNKNOWN_MODEL":
      return { ...base, title: "Unknown detection model", message: err.message, hint: undefined };
    case "SCREENING_NOT_FOUND":
      return {
        ...base,
        title: "Screening not found",
        message: "This screening is not available on the server.",
        hint: "Screenings are kept in server memory and are cleared when the backend restarts. Run the screening again.",
      };
    case "DETAIL_UNAVAILABLE":
      return {
        ...base,
        title: "Detailed data no longer available",
        message: "Measurement-level data is only kept for the most recent screenings.",
        hint: "Run the screening again to inspect signals and windows.",
      };
    case "WINDOW_NOT_FOUND":
      return { ...base, title: "Window not found", message: err.message, hint: undefined };
    case "UNKNOWN_SIGNAL":
      return { ...base, title: "Signal not available", message: err.message, hint: undefined };
    case "REQUEST_VALIDATION_ERROR":
      return { ...base, title: "The request was not valid", message: "One or more fields were missing or invalid.", hint: undefined };
    default:
      break;
  }

  if (err.status !== undefined && err.status >= 500) {
    return {
      ...base,
      title: "Something went wrong while processing the screening",
      message: "The screening was not completed.",
      hint: "Try again. If the problem persists, check the backend logs.",
    };
  }
  return { ...base, title: "Request failed", message: err.message, hint: undefined };
}
