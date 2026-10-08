import { http } from "./client";
import type { OfflineEvaluation } from "../types/api";

/** Static offline evaluation of the trained models (NOT a live screening result). */
export async function getOfflineEvaluation(signal?: AbortSignal): Promise<OfflineEvaluation> {
  const { data } = await http.get<OfflineEvaluation>("/evaluation", { signal });
  return data;
}
