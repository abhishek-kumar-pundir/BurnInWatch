import { useCallback, useEffect, useRef, useState } from "react";
import { validateDataset } from "../../api/datasets";
import { ApiError, normalizeError } from "../../api/errors";
import { analyzeScreening } from "../../api/screenings";
import { DEVICE_ID_PATTERN } from "../../constants";
import type { DatasetValidation, ScreeningResult } from "../../types/api";

export type Phase =
  | { name: "idle" }
  | { name: "validating"; file: File }
  | { name: "validated"; file: File; validation: DatasetValidation }
  | { name: "validation_failed"; file: File; error: ApiError }
  | { name: "analyzing"; file: File; validation: DatasetValidation; stage: "uploading" | "server"; uploadFraction: number; startedAt: number }
  | { name: "analysis_failed"; file: File; validation: DatasetValidation; error: ApiError };

/** Client-side checks that need no server round trip. Returns an ApiError-shaped failure or null. */
export function precheckFile(file: File): ApiError | null {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return new ApiError("http", "Only .csv files are accepted.", { code: "UNSUPPORTED_FILE_TYPE", status: 415 });
  }
  if (file.size === 0) {
    return new ApiError("http", "The uploaded file is empty.", { code: "EMPTY_FILE", status: 400 });
  }
  return null;
}

export function isValidDeviceId(v: string): boolean {
  return DEVICE_ID_PATTERN.test(v.trim());
}

export function useNewScreening(defaultModel: string | undefined, onComplete: (result: ScreeningResult) => void) {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [deviceId, setDeviceId] = useState("");
  const [modelChoice, setModelChoice] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => () => controller.current?.abort(), []);

  const model = modelChoice ?? defaultModel ?? "";

  const selectFile = useCallback(async (file: File) => {
    controller.current?.abort();
    const pre = precheckFile(file);
    if (pre) {
      setPhase({ name: "validation_failed", file, error: pre });
      return;
    }
    const c = new AbortController();
    controller.current = c;
    setPhase({ name: "validating", file });
    try {
      const validation = await validateDataset(file, c.signal);
      if (!c.signal.aborted) setPhase({ name: "validated", file, validation });
    } catch (err) {
      const e = normalizeError(err);
      if (!c.signal.aborted && e.code !== "CANCELLED") setPhase({ name: "validation_failed", file, error: e });
    }
  }, []);

  const clearFile = useCallback(() => {
    controller.current?.abort();
    setPhase({ name: "idle" });
  }, []);

  const start = useCallback(async () => {
    if (phase.name !== "validated" && phase.name !== "analysis_failed") return;
    if (!phase.validation.valid || !isValidDeviceId(deviceId) || !model) return;
    const { file, validation } = phase;
    const c = new AbortController();
    controller.current = c;
    const startedAt = Date.now();
    setPhase({ name: "analyzing", file, validation, stage: "uploading", uploadFraction: 0, startedAt });
    try {
      const result = await analyzeScreening({
        file,
        deviceId: deviceId.trim(),
        model,
        signal: c.signal,
        onUploadProgress: (f) =>
          setPhase((p) =>
            p.name === "analyzing" ? { ...p, uploadFraction: f, stage: f >= 1 ? "server" : "uploading" } : p,
          ),
      });
      if (!c.signal.aborted) completeRef.current(result);
    } catch (err) {
      const e = normalizeError(err);
      if (c.signal.aborted || e.code === "CANCELLED") {
        setPhase({ name: "validated", file, validation });
      } else {
        setPhase({ name: "analysis_failed", file, validation, error: e });
      }
    }
  }, [phase, deviceId, model]);

  const cancel = useCallback(() => controller.current?.abort(), []);

  return { phase, deviceId, setDeviceId, model, setModel: setModelChoice, selectFile, clearFile, start, cancel };
}
