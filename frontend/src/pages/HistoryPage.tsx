import { Link, useNavigate } from "react-router-dom";
import { History, Info, RefreshCw } from "lucide-react";
import { listScreenings } from "../api/screenings";
import { Button, Card, DataTable, EmptyState, ErrorState, SectionHeader, SkeletonRows, StatusBadge } from "../components/ui";
import type { Column } from "../components/ui";
import { MODEL_LABELS } from "../constants";
import { useAsync } from "../hooks/useAsync";
import type { ScreeningListItem } from "../types/api";
import { formatDateTime, formatInt, formatPercent } from "../utils/format";

export default function HistoryPage() {
  const state = useAsync((s) => listScreenings(s), []);
  const navigate = useNavigate();

  const columns: Column<ScreeningListItem>[] = [
    { key: "date", header: "Run", render: (r) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(r.created_at)}</span> },
    { key: "device", header: "Device", render: (r) => <span className="font-medium">{r.device_id}</span> },
    { key: "file", header: "Dataset", render: (r) => <span className="num text-[12px]">{r.filename}</span> },
    { key: "model", header: "Model", render: (r) => MODEL_LABELS[r.model_name] ?? r.model_name },
    { key: "status", header: "Result", render: (r) => <StatusBadge status={r.status} size="sm" /> },
    { key: "w", header: "Windows", align: "right", render: (r) => <span className="num">{formatInt(r.total_windows)}</span> },
    { key: "rev", header: "Review", align: "right", render: (r) => <span className="num">{formatInt(r.review_windows)}</span> },
    { key: "an", header: "Anomaly", align: "right", render: (r) => <span className="num">{formatInt(r.anomalous_windows)}</span> },
    { key: "rate", header: "Anomaly rate", align: "right", render: (r) => <span className="num">{formatPercent(r.anomaly_fraction)}</span> },
  ];

  return (
    <div>
      <SectionHeader
        title="Screening history"
        description="Screenings completed since the backend started. Storage is in server memory, so history is cleared when the backend restarts."
        actions={
          <Button size="sm" icon={<RefreshCw className="size-3.5" aria-hidden />} onClick={state.reload}>
            Refresh
          </Button>
        }
      />
      <Card>
        {state.status === "loading" ? (
          <SkeletonRows rows={5} />
        ) : state.status === "error" ? (
          <div className="p-4">
            <ErrorState error={state.error} onRetry={state.reload} />
          </div>
        ) : state.data.items.length === 0 ? (
          <EmptyState
            icon={History}
            title="No screening runs yet"
            description="Completed screenings will appear here."
            action={
              <Link to="/screenings/new">
                <Button variant="primary">New screening</Button>
              </Link>
            }
          />
        ) : (
          <DataTable
            caption="Screening history"
            columns={columns}
            rows={state.data.items}
            rowKey={(r) => r.screening_id}
            onRowClick={(r) => navigate(`/screenings/${r.screening_id}`)}
          />
        )}
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
        <Info className="size-3.5" aria-hidden /> Select a row to open the full result.
      </p>
    </div>
  );
}
