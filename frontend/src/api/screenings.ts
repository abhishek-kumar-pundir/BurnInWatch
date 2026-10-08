import { ANALYZE_TIMEOUT_MS, http } from "./client";
import type {
  ScreeningListResponse,
  ScreeningResult,
  SignalSeries,
  WindowDetail,
} from "../types/api";

export interface AnalyzeParams {
  file: File;
  deviceId: string;
  model: string;
  signal?: AbortSignal;
  /** Called with 0..1 while the file is being uploaded. */
  onUploadProgress?: (fraction: number) => void;
}

export async function analyzeScreening(p: AnalyzeParams): Promise<ScreeningResult> {
  const form = new FormData();
  form.append("file", p.file);
  form.append("device_id", p.deviceId);
  form.append("model", p.model);
  const { data } = await http.post<ScreeningResult>("/screenings/analyze", form, {
    signal: p.signal,
    timeout: ANALYZE_TIMEOUT_MS,
    onUploadProgress: (e) => {
      if (p.onUploadProgress && e.total) p.onUploadProgress(Math.min(1, e.loaded / e.total));
    },
  });
  return data;
}

export async function getScreening(id: string, signal?: AbortSignal): Promise<ScreeningResult> {
  const { data } = await http.get<ScreeningResult>(`/screenings/${encodeURIComponent(id)}`, { signal });
  return data;
}

export async function listScreenings(signal?: AbortSignal): Promise<ScreeningListResponse> {
  const { data } = await http.get<ScreeningListResponse>("/screenings", { signal });
  return data;
}

export async function getWindow(id: string, index: number, signal?: AbortSignal): Promise<WindowDetail> {
  const { data } = await http.get<WindowDetail>(`/screenings/${encodeURIComponent(id)}/windows/${index}`, { signal });
  return data;
}

export async function getSignalSeries(
  id: string,
  signalName: string,
  signal?: AbortSignal,
  maxPoints = 1500,
  range?: { start: number; end: number },
): Promise<SignalSeries> {
  const { data } = await http.get<SignalSeries>(
    `/screenings/${encodeURIComponent(id)}/signals/${encodeURIComponent(signalName)}`,
    { signal, params: { max_points: maxPoints, start: range?.start, end: range?.end } },
  );
  return data;
}
