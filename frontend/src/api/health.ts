import { http } from "./client";
import type { Health } from "../types/api";

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const { data } = await http.get<Health>("/health", { signal, timeout: 5_000 });
  return data;
}
