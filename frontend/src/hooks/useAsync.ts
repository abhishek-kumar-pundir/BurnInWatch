import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, normalizeError } from "../api/errors";

export type AsyncState<T> =
  | { status: "loading"; data: T | undefined; error: undefined }
  | { status: "success"; data: T; error: undefined }
  | { status: "error"; data: undefined; error: ApiError };

/**
 * Run an async function whenever `deps` change. Aborts the in-flight request on change/unmount
 * and ignores cancellations. `reload()` re-runs with the same deps.
 */
export function useAsync<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading", data: undefined, error: undefined });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => (s.status === "loading" ? s : { status: "loading", data: undefined, error: undefined }));
    fnRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: "success", data, error: undefined });
      })
      .catch((err: unknown) => {
        const e = normalizeError(err);
        if (controller.signal.aborted || e.code === "CANCELLED") return;
        setState({ status: "error", data: undefined, error: e });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
