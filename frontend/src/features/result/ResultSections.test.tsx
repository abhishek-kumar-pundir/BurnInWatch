import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { makeResult } from "../../test/fixtures";
import { ModelAgreement } from "./ModelAgreement";
import { StatusPanel } from "./StatusPanel";
import { EpisodeTimeline } from "./EpisodeTimeline";
import { ScreeningSummary } from "./ScreeningSummary";
import { WindowTable } from "./WindowTable";

const F: [boolean, boolean] = [false, false];
const R: [boolean, boolean] = [true, false];
const A: [boolean, boolean] = [true, true];

function panel(statuses: [boolean, boolean][]) {
  return render(
    <MemoryRouter>
      <StatusPanel result={makeResult(statuses)} />
    </MemoryRouter>,
  );
}

describe("StatusPanel wording matches backend status logic", () => {
  it("anomaly: both detectors flagged", () => {
    panel([F, A]);
    expect(screen.getByText("Anomaly detected")).toBeInTheDocument();
    expect(screen.getByText(/flagged by both detection models/)).toBeInTheDocument();
  });
  it("review: only one detector flagged", () => {
    panel([F, R]);
    expect(screen.getByText("Review recommended")).toBeInTheDocument();
    expect(screen.getByText(/One detection model identified unusual behavior/)).toBeInTheDocument();
  });
  it("normal: nothing flagged", () => {
    panel([F, F]);
    expect(screen.getByText("No anomalous behavior detected")).toBeInTheDocument();
    expect(screen.getByText(/No analysis windows were flagged/)).toBeInTheDocument();
  });
  it("does not present a probability or failure claim", () => {
    const { container } = panel([A, A]);
    expect(container.textContent).not.toMatch(/probab|will fail|root cause|health score/i);
  });
});

describe("ScreeningSummary (live cards)", () => {
  it("shows all 14 metrics straight from the response", () => {
    const r = makeResult([F, F, R, A]);
    render(
      <MemoryRouter>
        <ScreeningSummary result={r} />
      </MemoryRouter>,
    );
    const card = (label: string) => screen.getByText(label, { selector: "span" }).closest(".relative") as HTMLElement;
    expect(card("Total windows")).toHaveTextContent("4");
    expect(card("Normal windows")).toHaveTextContent("2");
    expect(card("Review windows")).toHaveTextContent("1");
    expect(card("Anomaly windows")).toHaveTextContent("1");
    expect(card("Anomaly rate")).toHaveTextContent("25.00%");
    for (const l of ["Screening status", "Total samples", "Anomaly episodes", "Max IF score", "Max AE error", "IF detections", "AE detections", "Both-model detections", "Processing time"]) {
      expect(card(l)).toBeInTheDocument();
    }
    expect(screen.getAllByText("IGBT-001").length).toBeGreaterThan(0);
  });
  it("warns when inference is outside the training distribution", () => {
    const r = makeResult([A, A]);
    r.distribution_check = { ...r.distribution_check, status: "suspect", message: "treat these results as NOT reliable" };
    render(
      <MemoryRouter>
        <ScreeningSummary result={r} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/NOT reliable/);
  });
});

describe("ModelAgreement", () => {
  it("shows the four live categories and does not claim ground truth", () => {
    const r = makeResult([A, A, F]);
    render(<ModelAgreement agreement={r.summary.agreement} />);
    for (const l of ["Both models", "Isolation Forest only", "Autoencoder only", "Neither"]) expect(screen.getByText(l)).toBeInTheDocument();
    expect(screen.getByText(/not ground truth/)).toBeInTheDocument();
  });
});

describe("EpisodeTimeline", () => {
  it("shows an empty state when there are no episodes", () => {
    render(<EpisodeTimeline result={makeResult([F, R])} onSelectEpisode={() => {}} />);
    expect(screen.getByText("No anomaly episodes")).toBeInTheDocument();
  });
  it("renders one clickable bar per episode and reports the episode", () => {
    const r = makeResult([A, A, F, A]);
    r.episodes = [
      { id: 1, first_window: 0, last_window: 3, start_row: 0, end_row: 174, start_time: 1000, end_time: 1030, duration_s: 30, windows: 3, span_windows: 4,
        review_windows_in_span: 0, max_if_score: 0.12, mean_if_score: 0.1, max_ae_score: 0.5, mean_ae_score: 0.4, max_ae_to_threshold: 1.7, max_if_margin: 0.05,
        agreement_pct: 75, peak_window: 1, top_features: [{ feature: "packageTemperature_std", signal: "packageTemperature", indicator: "variation (std)", mean_ae_error_share: 0.4, mean_if_contribution: 0.01, mean_abs_normalized_deviation: 3, direction: "above" }],
        top_signals: [{ signal: "packageTemperature", mean_ae_error_share: 0.4 }] },
    ];
    const onSel = vi.fn();
    render(<EpisodeTimeline result={r} onSelectEpisode={onSel} />);
    fireEvent.click(screen.getByRole("button", { name: "Episode 1" }));
    expect(onSel).toHaveBeenCalledWith(expect.objectContaining({ id: 1, peak_window: 1 }));
    expect(screen.getByText("75%")).toBeInTheDocument();
  });
});

describe("WindowTable", () => {
  const r = makeResult([F, R, A, F]);
  it("defaults to flagged windows when there are any", () => {
    render(<WindowTable timeline={r.timeline} thresholds={r.thresholds} selected={null} onSelect={() => {}} />);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.queryByText("#0")).toBeNull();
    expect(screen.getByText("Isolation Forest")).toBeInTheDocument(); // detection column for window #1
    expect(screen.getByText("Both")).toBeInTheDocument();
  });
  it("shows an empty state when a filter matches nothing", () => {
    const n = makeResult([F, F]);
    render(<WindowTable timeline={n.timeline} thresholds={n.thresholds} selected={null} onSelect={() => {}} />);
    expect(screen.getByText("#0")).toBeInTheDocument(); // all windows when nothing is flagged
  });
});
