const intFmt = new Intl.NumberFormat("en-US");

export function formatInt(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? "—" : intFmt.format(n);
}

/** fraction (0..1) -> "5.26%" */
export function formatPercent(fraction: number | null | undefined, digits = 2): string {
  return fraction === null || fraction === undefined || !Number.isFinite(fraction)
    ? "—"
    : `${(fraction * 100).toFixed(digits)}%`;
}

/** Scores / thresholds: 4 significant digits, never scientific for typical ranges. */
export function formatScore(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1000) return intFmt.format(Math.round(n));
  if (abs < 0.0001) return n.toExponential(2);
  return Number(n.toPrecision(4)).toString();
}

export function formatSigned(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const s = Math.abs(n) >= 1000 ? intFmt.format(Math.round(n)) : n.toFixed(digits);
  return n > 0 ? `+${s}` : s;
}

export function formatNumber(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return Math.abs(n) >= 1000 ? intFmt.format(Number(n.toFixed(Math.max(0, digits - 1)))) : n.toFixed(digits);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * timeEpoch handling. The unit is not declared by the data, so we only interpret it when it
 * is unambiguous: values that look like Unix epoch (s or ms) become clock times; everything
 * else is shown as elapsed seconds exactly as stored.
 */
export type TimeKind = "unix-s" | "unix-ms" | "labview-s" | "relative";

/** Seconds between the LabVIEW epoch (1904-01-01) and the Unix epoch (1970-01-01). */
const LABVIEW_OFFSET_S = 2_082_844_800;

/**
 * Values 2.5e9..4.5e9 s cannot be a plausible Unix time (2049-2112) but are 2008-2046 as seconds since
 * 1904-01-01; the BurnInWatch research data (3.3e9) matches its own `date` column under that reading.
 */
export function timeKind(t: number): TimeKind {
  if (t >= 1e11) return "unix-ms";
  if (t >= 2.5e9 && t < 4.5e9) return "labview-s";
  if (t >= 1e9) return "unix-s";
  return "relative";
}

function toDate(t: number, kind: TimeKind): Date {
  if (kind === "unix-ms") return new Date(t);
  if (kind === "labview-s") return new Date((t - LABVIEW_OFFSET_S) * 1000);
  return new Date(t * 1000);
}

/** Elapsed seconds -> "0:45", "12:03", "1:02:03" (sub-minute values keep one decimal). */
export function formatElapsed(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return "—";
  const s = Math.max(0, sec);
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
  const total = Math.round(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const r = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/** UTC wall-clock for a timeEpoch when its epoch is recognisable, else null. */
export function formatWallClock(t: number | null | undefined): string | null {
  if (t === null || t === undefined || !Number.isFinite(t)) return null;
  const kind = timeKind(t);
  if (kind === "relative") return null;
  const d = toDate(t, kind);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

export function formatTime(t: number | null | undefined): string {
  if (t === null || t === undefined || !Number.isFinite(t)) return "—";
  const kind = timeKind(t);
  if (kind === "relative") return `${intFmt.format(Number(t.toFixed(1)))} s`;
  const d = toDate(t, kind);
  return kind === "labview-s"
    ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
    : `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatTimeRange(a: number, b: number): string {
  return `${formatTime(a)} – ${formatTime(b)}`;
}

/** Full timestamp for the dataset time range (date shown only for Unix times). */
export function formatTimestamp(t: number | null | undefined): string {
  if (t === null || t === undefined || !Number.isFinite(t)) return "—";
  const kind = timeKind(t);
  if (kind === "relative") return formatTime(t);
  if (kind === "labview-s") return formatWallClock(t) ?? formatTime(t);
  const d = toDate(t, kind);
  return `${d.toLocaleDateString()} ${formatTime(t)}`;
}

/** Duration in the same unit as timeEpoch. Assumed seconds (milliseconds when Unix-ms). */
export function formatDuration(span: number | null | undefined, reference?: number | null): string {
  if (span === null || span === undefined || !Number.isFinite(span) || span < 0) return "—";
  const seconds = reference !== null && reference !== undefined && timeKind(reference) === "unix-ms" ? span / 1000 : span;
  const total = Math.round(seconds);
  if (total < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Normalized deviation in training-IQR units. Very large values are shown as a lower bound. */
export function formatZ(z: number | null | undefined): string {
  if (z === null || z === undefined || !Number.isFinite(z)) return "—";
  if (Math.abs(z) >= 1000) return `${z > 0 ? "+" : "−"}1000+`;
  return formatSigned(z, 1);
}

/** Percent already expressed in percent units (e.g. 12.3 -> "+12.3%"); null when undefined. */
export function formatPct(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "n/a";
  return `${p > 0 ? "+" : ""}${Math.abs(p) >= 1000 ? intFmt.format(Math.round(p)) : p.toFixed(1)}%`;
}
