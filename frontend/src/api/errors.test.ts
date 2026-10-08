import { describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { ApiError, describeError, normalizeError } from "./errors";

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;

function httpError(status: number, data: unknown): AxiosError {
  const response = { status, data, statusText: "", headers: {}, config } as AxiosResponse;
  return new AxiosError("fail", "ERR_BAD_REQUEST", config, null, response);
}

describe("normalizeError", () => {
  it("maps a missing response to a network error", () => {
    const e = normalizeError(new AxiosError("Network Error", "ERR_NETWORK", config));
    expect(e.kind).toBe("network");
  });

  it("maps axios timeouts", () => {
    expect(normalizeError(new AxiosError("timeout", "ECONNABORTED", config)).kind).toBe("timeout");
  });

  it("reads the backend error envelope", () => {
    const e = normalizeError(httpError(422, { error: { code: "MISSING_COLUMNS", message: "CSV is missing required column(s): x.", details: { missing_columns: ["x"] } } }));
    expect(e).toMatchObject({ kind: "http", status: 422, code: "MISSING_COLUMNS" });
    expect(e.details.missing_columns).toEqual(["x"]);
  });

  it("falls back to FastAPI detail and generic messages", () => {
    expect(normalizeError(httpError(404, { detail: "Not Found" })).message).toBe("Not Found");
    expect(normalizeError(httpError(502, "<html>bad gateway</html>")).message).toMatch(/502/);
  });

  it("passes ApiError through and wraps unknown values", () => {
    const original = new ApiError("http", "x");
    expect(normalizeError(original)).toBe(original);
    expect(normalizeError("boom").kind).toBe("unknown");
    expect(normalizeError(new Error("e")).message).toBe("e");
  });
});

describe("describeError", () => {
  it("explains an unreachable backend", () => {
    const d = describeError(new ApiError("network", "x"));
    expect(d.title).toBe("Unable to connect to BurnInWatch");
    expect(d.hint).toMatch(/backend is running/);
  });

  it("lists expected and found columns for MISSING_COLUMNS", () => {
    const d = describeError(
      new ApiError("http", "raw backend text", {
        status: 422,
        code: "MISSING_COLUMNS",
        details: { missing_columns: ["collectorEmitterCurrent"], found_columns: ["collectorCurrent", "temperature"] },
      }),
    );
    expect(d.title).toBe("This dataset could not be analyzed");
    expect(d.facts).toEqual([
      { label: "Expected", value: "collectorEmitterCurrent" },
      { label: "Found", value: "collectorCurrent, temperature" },
    ]);
  });

  it("uses engineering wording for insufficient data and unsupported files", () => {
    expect(describeError(new ApiError("http", "x", { code: "INSUFFICIENT_DATA", status: 422 })).title).toBe("Insufficient data");
    expect(describeError(new ApiError("http", "x", { code: "UNSUPPORTED_FILE_TYPE", status: 415 })).title).toBe("CSV files only");
  });

  it("never leaks server text for 5xx errors", () => {
    const d = describeError(new ApiError("http", "Traceback (most recent call last) ...", { status: 500, code: "INTERNAL_ERROR" }));
    expect(d.message).toBe("The screening was not completed.");
    expect(d.title + d.message).not.toMatch(/Traceback/);
  });
});
