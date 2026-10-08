import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { Card, CardHeader, DataTable, EmptyState } from "../../components/ui";
import type { Column } from "../../components/ui";
import { CHART } from "../../constants/chart";
import type { Episode, ScreeningResult } from "../../types/api";
import { formatElapsed, formatInt, formatScore } from "../../utils/format";
import { featureLabel } from "../../utils/labels";

interface Props {
  result: ScreeningResult;
  selectedEpisode?: number | null;
  onSelectEpisode: (episode: Episode) => void;
}

/** Graph 3 - anomaly episodes on the test timeline, plus a per-episode table. All values from this run. */
export function EpisodeTimeline({ result, selectedEpisode, onSelectEpisode }: Props) {
  const { episodes, input, timeline } = result;
  const t0 = input.time_start;
  const total = Math.max(input.duration_s, 1e-9);
  const maxSev = Math.max(1, ...episodes.map((e) => e.max_ae_to_threshold));
  const review = useMemo(() => timeline.filter((p) => p.status === "REVIEW"), [timeline]);
  const pos = (t: number) => `${Math.min(100, Math.max(0, ((t - t0) / total) * 100))}%`;
  const w = (a: number, b: number) => `${Math.max(0.5, ((b - a) / total) * 100)}%`;

  const cols: Column<Episode>[] = [
    { key: "id", header: "#", render: (e) => `E${e.id}` },
    { key: "start", header: "Start", align: "right", render: (e) => formatElapsed(e.start_time - t0) },
    { key: "end", header: "End", align: "right", render: (e) => formatElapsed(e.end_time - t0) },
    { key: "dur", header: "Duration", align: "right", render: (e) => formatElapsed(e.duration_s) },
    { key: "win", header: "Windows", align: "right", render: (e) => `${formatInt(e.windows)}${e.span_windows !== e.windows ? ` / ${formatInt(e.span_windows)}` : ""}` },
    { key: "mif", header: "Max IF", align: "right", render: (e) => formatScore(e.max_if_score) },
    { key: "aif", header: "Avg IF", align: "right", render: (e) => formatScore(e.mean_if_score) },
    { key: "mae", header: "Max AE", align: "right", render: (e) => formatScore(e.max_ae_score) },
    { key: "aae", header: "Avg AE", align: "right", render: (e) => formatScore(e.mean_ae_score) },
    { key: "sev", header: "Severity (AE ÷ thr)", align: "right", render: (e) => `${e.max_ae_to_threshold.toFixed(1)}×` },
    { key: "agr", header: "Agreement", align: "right", render: (e) => `${e.agreement_pct.toFixed(0)}%` },
    {
      key: "feat",
      header: "Most affected",
      render: (e) => (
        <span className="text-[12px]">
          {e.top_features.slice(0, 3).map((f) => featureLabel(f)).join("; ")}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Anomaly episodes"
        description="Overlapping anomalous windows merged into single events. Click an episode to inspect its peak window."
      />
      {episodes.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No anomaly episodes" description={`No window was flagged by both models in this upload${result.summary.review_windows ? ` (${result.summary.review_windows} window(s) were flagged by one model only)` : ""}.`} />
      ) : (
        <>
          <div className="px-4 pt-4">
            <div className="relative h-16 rounded border border-line bg-canvas" role="img" aria-label={`${episodes.length} anomaly episodes across a ${formatElapsed(input.duration_s)} test.`}>
              {review.map((p) => (
                <i key={p.window_index} className="absolute bottom-0 h-2 opacity-60" style={{ left: pos(p.start_time), width: w(p.start_time, p.end_time), background: CHART.review }} />
              ))}
              {episodes.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onSelectEpisode(e)}
                  title={`E${e.id}: ${formatElapsed(e.start_time - t0)} → ${formatElapsed(e.end_time - t0)} (${formatElapsed(e.duration_s)}), peak AE ${e.max_ae_to_threshold.toFixed(1)}× threshold, ${e.agreement_pct.toFixed(0)}% both-model agreement`}
                  aria-label={`Episode ${e.id}`}
                  className="absolute top-1 rounded-sm border border-anomaly text-[10px] font-semibold text-white outline-offset-2 hover:brightness-110 focus-visible:outline focus-visible:outline-2"
                  style={{
                    left: pos(e.start_time),
                    width: w(e.start_time, e.end_time),
                    minWidth: 6,
                    height: `${28 + (e.max_ae_to_threshold / maxSev) * 28}px`,
                    background: CHART.anomaly,
                    opacity: selectedEpisode === e.id ? 1 : 0.8,
                    outline: selectedEpisode === e.id ? "2px solid #17202b" : undefined,
                  }}
                >
                  <span className="px-0.5">E{e.id}</span>
                </button>
              ))}
            </div>
            <div className="num mt-1 flex justify-between text-[11px] text-ink-muted">
              <span>0</span>
              <span>{formatElapsed(input.duration_s / 2)}</span>
              <span>{formatElapsed(input.duration_s)}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
              <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-sm" style={{ background: CHART.anomaly }} />Episode (bar height = severity)</span>
              <span className="flex items-center gap-1"><i className="inline-block h-1.5 w-3" style={{ background: CHART.review }} />Review window (one model)</span>
            </div>
          </div>
          <div className="p-4">
            <DataTable
              caption="Anomaly episodes"
              columns={cols}
              rows={episodes}
              rowKey={(e) => e.id}
              onRowClick={onSelectEpisode}
              isRowActive={(e) => e.id === selectedEpisode}
            />
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              {result.episode_rule} "Windows" = anomaly windows / all windows in the episode span. Agreement = share of span windows flagged by both detectors.
              Most affected = features carrying the largest share of the autoencoder error (associated with the anomaly; not a diagnosis).
            </p>
          </div>
        </>
      )}
    </Card>
  );
}
