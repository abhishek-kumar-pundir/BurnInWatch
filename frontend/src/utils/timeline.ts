import type { Detection, TimelinePoint, ScreeningStatus } from "../types/api";
import { detectionOf } from "./status";

export type WindowFilter = "all" | "flagged" | "anomaly";

export function filterWindows(timeline: TimelinePoint[], filter: WindowFilter): TimelinePoint[] {
  if (filter === "all") return timeline;
  if (filter === "anomaly") return timeline.filter((p) => p.status === "ANOMALY");
  return timeline.filter((p) => p.status !== "NORMAL");
}

export interface StatusRun {
  status: Exclude<ScreeningStatus, "NORMAL">;
  firstIndex: number;
  lastIndex: number;
  /** start of the first window / end of the last window */
  startTime: number;
  endTime: number;
}

/** Contiguous runs of REVIEW or ANOMALY windows (same status), in chronological order. */
export function statusRuns(timeline: TimelinePoint[]): StatusRun[] {
  const runs: StatusRun[] = [];
  let cur: StatusRun | null = null;
  for (const p of timeline) {
    if (p.status === "NORMAL") {
      cur = null;
      continue;
    }
    if (cur && cur.status === p.status && cur.lastIndex === p.window_index - 1) {
      cur.lastIndex = p.window_index;
      cur.endTime = p.end_time;
    } else {
      cur = {
        status: p.status,
        firstIndex: p.window_index,
        lastIndex: p.window_index,
        startTime: p.start_time,
        endTime: p.end_time,
      };
      runs.push(cur);
    }
  }
  return runs;
}

export function windowCenter(p: Pick<TimelinePoint, "start_time" | "end_time">): number {
  return (p.start_time + p.end_time) / 2;
}

/** Median spacing between consecutive window centres (0 when fewer than two windows). */
export function medianStep(timeline: TimelinePoint[]): number {
  if (timeline.length < 2) return 0;
  const steps: number[] = [];
  for (let i = 1; i < timeline.length; i++) {
    const a = timeline[i - 1];
    const b = timeline[i];
    if (a && b) steps.push(windowCenter(b) - windowCenter(a));
  }
  steps.sort((x, y) => x - y);
  return steps[Math.floor(steps.length / 2)] ?? 0;
}

export interface ChartPoint {
  x: number;
  index: number;
  start: number;
  end: number;
  ifScore: number;
  aeScore: number;
  ifFlag: boolean;
  aeFlag: boolean;
  status: ScreeningStatus;
  detection: Detection;
}

export function toChartPoints(timeline: TimelinePoint[]): ChartPoint[] {
  return timeline.map((p) => ({
    x: windowCenter(p),
    index: p.window_index,
    start: p.start_time,
    end: p.end_time,
    ifScore: p.isolation_forest_score,
    aeScore: p.autoencoder_score,
    ifFlag: p.isolation_forest_flag,
    aeFlag: p.autoencoder_flag,
    status: p.status,
    detection: detectionOf(p),
  }));
}
