import axios from "axios";
import { normalizeError } from "./errors";

/** Backend origin from VITE_API_URL; a trailing slash or /api/v1 suffix is tolerated. */
export const API_ROOT = (import.meta.env.VITE_API_URL ?? "http://localhost:8000")
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/, "");
export const API_BASE = `${API_ROOT}/api/v1`;

export const http = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
  headers: { Accept: "application/json" },
});

// Every failure leaves this layer as an ApiError.
http.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(normalizeError(error)),
);

/** Analysis of large files can legitimately take a while. */
export const ANALYZE_TIMEOUT_MS = 180_000;
