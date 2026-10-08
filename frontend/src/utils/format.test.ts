import { describe, expect, it } from "vitest";
import { formatBytes, formatDuration, formatInt, formatPercent, formatScore, formatSigned, formatElapsed, formatTime, formatWallClock, formatZ, timeKind } from "./format";

describe("format", () => {
  it("never renders NaN / undefined / null", () => {
    for (const f of [formatInt, formatPercent, formatScore, formatSigned, formatTime]) {
      for (const v of [NaN, undefined, null, Infinity]) {
        const out = (f as (x: number | null | undefined) => string)(v as number);
        expect(out).toBe("—");
      }
    }
  });
  it("formats counts, rates and scores", () => {
    expect(formatInt(24581)).toBe("24,581");
    expect(formatPercent(0.0526)).toBe("5.26%");
    expect(formatScore(0.069082)).toBe("0.06908");
    expect(formatScore(0)).toBe("0");
    expect(formatSigned(6.6)).toBe("+6.600");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });
  it("interprets timeEpoch only when unambiguous", () => {
    expect(timeKind(173521.2)).toBe("relative");
    expect(timeKind(1_700_000_000)).toBe("unix-s");
    expect(timeKind(1_700_000_000_000)).toBe("unix-ms");
    expect(formatTime(173521.2)).toBe("173,521.2 s");
  });
  it("formats duration", () => {
    expect(formatDuration(8076)).toBe("2:14:36");
    expect(formatDuration(45)).toBe("45 s");
    expect(formatDuration(null)).toBe("—");
  });
  it("recognises the LabVIEW epoch used by the research data", () => {
    expect(timeKind(3_312_986_388)).toBe("labview-s");
    expect(formatWallClock(3_312_986_388)).toBe("2008-12-24 17:59:48 UTC");
    expect(formatWallClock(173521.2)).toBeNull();
    expect(formatElapsed(3723)).toBe("1:02:03");
    expect(formatElapsed(4.25)).toBe("4.3 s");
  });
  it("shows very large deviations as lower bounds", () => {
    expect(formatZ(5000)).toBe("+1000+");
    expect(formatZ(-73)).toBe("-73.0");
    expect(formatZ(4.26)).toBe("+4.3");
    expect(formatZ(NaN)).toBe("—");
  });
});
