import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getHealth } from "../api/health";
import { getModels } from "../api/models";
import { ApiError, normalizeError } from "../api/errors";
import type { Health, ModelList } from "../types/api";

export type BackendState = "checking" | "online" | "degraded" | "offline";

export interface BackendStatus {
  state: BackendState;
  health: Health | null;
  models: ModelList | null;
  error: ApiError | null;
  lastChecked: Date | null;
  refresh: () => void;
}

const Ctx = createContext<BackendStatus | null>(null);
const POLL_MS = 15_000;

export function BackendStatusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BackendState>("checking");
  const [health, setHealth] = useState<Health | null>(null);
  const [models, setModels] = useState<ModelList | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const check = useCallback(async () => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    try {
      const h = await getHealth(controller.signal);
      if (controller.signal.aborted) return;
      setHealth(h);
      setError(null);
      setState(h.status === "ok" ? "online" : "degraded");
      setLastChecked(new Date());
      try {
        const m = await getModels(controller.signal);
        if (!controller.signal.aborted) setModels(m);
      } catch {
        /* models are optional for the status pill; pages that need them show their own error */
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(normalizeError(err));
      setHealth(null);
      setState("offline");
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), POLL_MS);
    return () => {
      window.clearInterval(id);
      inflight.current?.abort();
    };
  }, [check]);

  const value = useMemo<BackendStatus>(
    () => ({ state, health, models, error, lastChecked, refresh: () => void check() }),
    [state, health, models, error, lastChecked, check],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBackendStatus(): BackendStatus {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBackendStatus must be used inside BackendStatusProvider");
  return v;
}
