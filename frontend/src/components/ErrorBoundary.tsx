import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface State {
  failed: boolean;
  message: string;
}

/** Last-resort guard so a rendering bug never shows a blank page or a stack trace. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto mt-16 max-w-md rounded-md border border-anomaly-line bg-anomaly-soft/60 p-6 text-center">
        <h1 className="text-base font-semibold text-anomaly">Something went wrong in the interface</h1>
        <p className="mt-2 text-[13px] text-ink">The view could not be displayed. Your data on the server is unaffected.</p>
        {import.meta.env.DEV ? <p className="num mt-2 break-words text-[11px] text-ink-faint">dev: {this.state.message}</p> : null}
        <button
          type="button"
          className="mt-4 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-canvas"
          onClick={() => window.location.assign("/")}
        >
          Return to overview
        </button>
      </div>
    );
  }
}
