import { http } from "./client";
import type { ModelList } from "../types/api";

export async function getModels(signal?: AbortSignal): Promise<ModelList> {
  const { data } = await http.get<ModelList>("/models", { signal });
  return data;
}
