import { describe, expect, it } from "vitest";
import { makeResult } from "../test/fixtures";
import { detectionOf } from "./status";
import { filterWindows, medianStep, statusRuns } from "./timeline";

const F: [boolean, boolean] = [false, false];
const R: [boolean, boolean] = [true, false];
const A: [boolean, boolean] = [true, true];

describe("timeline utils", () => {
  const { timeline } = makeResult([F, R, R, A, A, F, A]);

  it("merges contiguous same-status flagged windows into runs", () => {
    const runs = statusRuns(timeline);
    expect(runs.map((r) => [r.status, r.firstIndex, r.lastIndex])).toEqual([
      ["REVIEW", 1, 2],
      ["ANOMALY", 3, 4],
      ["ANOMALY", 6, 6],
    ]);
    expect(runs[0]).toMatchObject({ startTime: timeline[1]?.start_time, endTime: timeline[2]?.end_time });
  });

  it("filters windows", () => {
    expect(filterWindows(timeline, "all")).toHaveLength(7);
    expect(filterWindows(timeline, "flagged")).toHaveLength(5);
    expect(filterWindows(timeline, "anomaly").map((p) => p.window_index)).toEqual([3, 4, 6]);
  });

  it("derives detection from flags", () => {
    expect(detectionOf(timeline[0]!)).toBe("none");
    expect(detectionOf(timeline[1]!)).toBe("isolation_forest");
    expect(detectionOf(timeline[3]!)).toBe("both");
    expect(detectionOf({ isolation_forest_flag: false, autoencoder_flag: true })).toBe("autoencoder");
  });

  it("computes median window spacing", () => {
    expect(medianStep(timeline)).toBeCloseTo(5);
    expect(medianStep(timeline.slice(0, 1))).toBe(0);
  });

  it("handles an empty timeline", () => {
    expect(statusRuns([])).toEqual([]);
  });
});
