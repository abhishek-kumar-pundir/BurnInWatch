import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ListFilter } from "lucide-react";
import { Button, Card, CardHeader, DataTable, EmptyState, StatusBadge } from "../../components/ui";
import type { Column } from "../../components/ui";
import type { TimelinePoint } from "../../types/api";
import { cn } from "../../utils/cn";
import { formatInt, formatScore, formatTimeRange } from "../../utils/format";
import { DETECTION_LABEL, detectionOf } from "../../utils/status";
import { filterWindows } from "../../utils/timeline";
import type { WindowFilter } from "../../utils/timeline";

const PAGE_SIZE = 25;

const FILTERS: { id: WindowFilter; label: string }[] = [
  { id: "all", label: "All windows" },
  { id: "flagged", label: "Review + Anomaly" },
  { id: "anomaly", label: "Anomaly only" },
];

interface Props {
  timeline: TimelinePoint[];
  thresholds: { isolation_forest: number; autoencoder: number };
  selected: number | null;
  onSelect: (index: number) => void;
}

export function WindowTable({ timeline, thresholds, selected, onSelect }: Props) {
  const hasFlagged = useMemo(() => timeline.some((p) => p.status !== "NORMAL"), [timeline]);
  const [filter, setFilter] = useState<WindowFilter>(hasFlagged ? "flagged" : "all");
  const [page, setPage] = useState(0);

  const rows = useMemo(() => filterWindows(timeline, filter), [timeline, filter]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  useEffect(() => setPage(0), [filter, timeline]);
  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const columns: Column<TimelinePoint>[] = [
    { key: "i", header: "Window", render: (p) => <span className="num font-medium">#{p.window_index}</span> },
    { key: "t", header: "Time", render: (p) => <span className="num whitespace-nowrap text-ink-muted">{formatTimeRange(p.start_time, p.end_time)}</span> },
    { key: "s", header: "Status", render: (p) => <StatusBadge status={p.status} size="sm" /> },
    {
      key: "if",
      header: "IF score",
      align: "right",
      render: (p) => <span className={cn("num", p.isolation_forest_flag && "font-semibold text-anomaly")}>{formatScore(p.isolation_forest_score)}</span>,
    },
    {
      key: "ae",
      header: "AE score",
      align: "right",
      render: (p) => <span className={cn("num", p.autoencoder_flag && "font-semibold text-anomaly")}>{formatScore(p.autoencoder_score)}</span>,
    },
    { key: "d", header: "Detection", render: (p) => <span className="text-ink-muted">{DETECTION_LABEL[detectionOf(p)]}</span> },
  ];

  return (
    <Card>
      <CardHeader
        title="Window inspector"
        description={`Score columns in red exceed their threshold (IF ${formatScore(thresholds.isolation_forest)}, AE ${formatScore(thresholds.autoencoder)}). Select a row for detail.`}
        actions={
          <div role="group" aria-label="Filter windows" className="flex overflow-hidden rounded-md border border-line-strong text-xs">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn("px-2.5 py-1.5 font-medium", filter === f.id ? "bg-nav text-white" : "bg-surface text-ink-muted hover:bg-canvas")}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />
      <DataTable
        caption="Analysis windows with detector scores"
        columns={columns}
        rows={visible}
        rowKey={(p) => p.window_index}
        onRowClick={(p) => onSelect(p.window_index)}
        isRowActive={(p) => p.window_index === selected}
        empty={<EmptyState icon={ListFilter} title="No windows match this filter" description="Choose a different filter to see other windows." />}
      />
      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2 text-xs text-ink-muted">
          <span className="num">
            {formatInt(page * PAGE_SIZE + 1)}–{formatInt(Math.min(rows.length, (page + 1) * PAGE_SIZE))} of {formatInt(rows.length)}
          </span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page" icon={<ChevronLeft className="size-4" aria-hidden />} />
            <span className="num px-1">
              {page + 1} / {pages}
            </span>
            <Button size="sm" variant="ghost" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page" icon={<ChevronRight className="size-4" aria-hidden />} />
          </div>
        </div>
      ) : null}
    </Card>
  );
}
