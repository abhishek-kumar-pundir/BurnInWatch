import { http } from "./client";
import type { DatasetValidation } from "../types/api";

export async function validateDataset(file: File, signal?: AbortSignal): Promise<DatasetValidation> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await http.post<DatasetValidation>("/datasets/validate", form, { signal, timeout: 60_000 });
  return data;
}
