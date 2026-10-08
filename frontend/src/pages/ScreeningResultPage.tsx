import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Radio } from "lucide-react";
import { getScreening, getWindow } from "../api/screenings";
import { Badge, Button, ErrorState, Skeleton } from "../components/ui";
import { AnomalyScoreChart } from "../features/result/AnomalyScoreChart";
import { BaselineComparison } from "../features/result/BaselineComparison";
import { EpisodeTimeline } from "../features/result/EpisodeTimeline";
import { FeatureContributionChart } from "../features/result/FeatureContributionChart";
import { InputPanel } from "../features/result/InputPanel";
import { ModelAgreement } from "../features/result/ModelAgreement";
import { ScreeningSummary } from "../features/result/ScreeningSummary";
import { SignalChart } from "../features/result/SignalChart";
import { WindowInspector } from "../features/result/WindowInspector";
import { WindowTable } from "../features/result/WindowTable";
import { useAsync } from "../hooks/useAsync";
import type { Episode, ScreeningResult } from "../types/api";

function ResultSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading screening result">
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

/** The window the explanation graphs start on: peak of the strongest episode, else the overall peak. */
function defaultExplainWindow(r: ScreeningResult): number {
  const best = [...r.episodes].sort((a, b) => b.max_ae_to_threshold - a.max_ae_to_threshold)[0];
  return best ? best.peak_window : r.peak.window_index;
}

function Explainers({ r, index, onInspect, onPick }: { r: ScreeningResult; index: number; onInspect: (i: number) => void; onPick: (i: number) => void }) {
  const win = useAsync((s) => getWindow(r.screening_id, index, s), [r.screening_id, index]);
  const options = useMemo(() => {
    const list = r.episodes.map((e) => ({ idx: e.peak_window, label: `Episode E${e.id} peak (window #${e.peak_window})` }));
    if (!list.some((o) => o.idx === r.peak.window_index)) list.push({ idx: r.peak.window_index, label: `Overall peak (window #${r.peak.window_index})` });
    if (!list.some((o) => o.idx === index)) list.push({ idx: index, label: `Window #${index}` });
    return list;
  }, [r, index]);

  return (
    <section className="space-y-4" aria-label="Explanation of the selected window">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface px-4 py-2.5 text-[13px]">
        <span className="font-semibold uppercase tracking-wide text-ink">Explaining</span>
        <select value={index} onChange={(e) => onPick(Number(e.target.value))} aria-label="Window to explain" className="rounded border border-line-strong bg-surface px-2 py-1">
          {options.map((o) => (
            <option key={o.idx} value={o.idx}>{o.label}</option>
          ))}
        </select>
        <Button variant="secondary" size="sm" onClick={() => onInspect(index)}>Open window inspector</Button>
        <span className="text-xs text-ink-muted">Click any episode, window row or chart point to explain a different window.</span>
      </div>
      {win.status === "error" ? (
        <ErrorState error={win.error} onRetry={win.reload} compact />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <FeatureContributionChart features={win.data?.features ?? []} windowLabel={`window #${index}`} />
          <BaselineComparison detail={win.data} />
        </div>
      )}
    </section>
  );
}

export default function ScreeningResultPage() {
  const { screeningId = "" } = useParams();
  const state = useAsync((s) => getScreening(screeningId, s), [screeningId]);

  const [explain, setExplain] = useState<number | null>(null);
  const [drawerIndex, setDrawerIndex] = useState<number | null>(null);
  const [episodeId, setEpisodeId] = useState<number | null>(null);

  const result = state.status === "success" ? state.data : null;
  useEffect(() => {
    setDrawerIndex(null);
    setEpisodeId(null);
    setExplain(result ? defaultExplainWindow(result) : null);
  }, [result]);

  const openWindow = useCallback((i: number) => {
    setExplain(i);
    setDrawerIndex(i);
  }, []);
  const closeWindow = useCallback(() => setDrawerIndex(null), []);
  const openEpisode = useCallback(
    (e: Episode) => {
      setEpisodeId(e.id);
      openWindow(e.peak_window);
    },
    [openWindow],
  );
  const navigate = useCallback((i: number) => {
    setExplain(i);
    setDrawerIndex(i);
  }, []);

  if (state.status === "loading") return <ResultSkeleton />;
  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <ErrorState error={state.error} onRetry={state.reload} />
        <div className="flex gap-2">
          <Link to="/screenings/new"><Button variant="primary">New screening</Button></Link>
          <Link to="/screenings"><Button>Screening history</Button></Link>
        </div>
      </div>
    );
  }

  const r = state.data;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent"><Radio className="mr-1 inline size-3" aria-hidden />Live Screening</Badge>
        <span className="text-xs text-ink-muted">Computed on the server from the uploaded CSV just now; nothing on this page is precomputed or demo data.</span>
      </div>

      <ScreeningSummary result={r} />

      <EpisodeTimeline result={r} selectedEpisode={episodeId} onSelectEpisode={openEpisode} />
      <AnomalyScoreChart result={r} onSelectWindow={openWindow} />
      <SignalChart result={r} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <ModelAgreement agreement={r.summary.agreement} />
        <WindowTable timeline={r.timeline} thresholds={r.thresholds} selected={drawerIndex} onSelect={openWindow} />
      </div>

      {explain !== null ? <Explainers r={r} index={explain} onInspect={openWindow} onPick={setExplain} /> : null}

      <InputPanel result={r} />

      <WindowInspector screeningId={r.screening_id} windowIndex={drawerIndex} timeOrigin={r.input.time_start} onClose={closeWindow} onSelectWindow={navigate} />
    </div>
  );
}
