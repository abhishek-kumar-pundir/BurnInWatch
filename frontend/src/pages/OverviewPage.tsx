import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, FilePlus2, History } from "lucide-react";
import { listScreenings } from "../api/screenings";
import { Button, Card, CardBody, CardHeader, DataTable, EmptyState, ErrorState, SkeletonRows, StatusBadge } from "../components/ui";
import type { Column } from "../components/ui";
import { DotRow } from "../components/StatusDot";
import { PIPELINE_STEPS } from "../constants";
import { useAsync } from "../hooks/useAsync";
import { useBackendStatus } from "../hooks/useBackendStatus";
import type { ScreeningListItem } from "../types/api";
import { formatDateTime, formatInt } from "../utils/format";

export default function OverviewPage() {
  const backend = useBackendStatus();
  const recent = useAsync((s) => listScreenings(s), []);

  const modelsAvailable = backend.health ? Object.values(backend.health.models).every(Boolean) : null;
  const loadedCount = backend.models?.models.filter((m) => m.loaded).length;

  const columns: Column<ScreeningListItem>[] = [
    { key: "date", header: "Run", render: (r) => <span className="text-ink-muted">{formatDateTime(r.created_at)}</span> },
    { key: "device", header: "Device", render: (r) => <span className="font-medium">{r.device_id}</span> },
    { key: "file", header: "Dataset", render: (r) => <span className="num text-[12px]">{r.filename}</span> },
    { key: "status", header: "Result", render: (r) => <StatusBadge status={r.status} size="sm" /> },
    {
      key: "open",
      header: "",
      align: "right",
      render: (r) => (
        <Link to={`/screenings/${r.screening_id}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
          Open <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardBody className="space-y-4 py-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">BurnInWatch</h1>
              <p className="text-sm font-medium text-ink-muted">Component Screening &amp; Anomaly Detection</p>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
              BurnInWatch analyzes burn-in measurement data using unsupervised anomaly detection to identify unusual electrical and thermal
              behavior. Results are screening signals for engineering review — they are not failure predictions.
            </p>
            <Link to="/screenings/new">
              <Button variant="primary" size="lg" icon={<FilePlus2 className="size-4" aria-hidden />}>
                Start new screening
              </Button>
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="System status" />
          <CardBody className="divide-y divide-line py-1">
            <DotRow
              ok={backend.state === "checking" ? null : backend.state !== "offline"}
              label="Backend"
              detail={backend.state === "checking" ? "Checking…" : backend.state === "offline" ? "Unreachable" : "Connected"}
            />
            <DotRow
              ok={modelsAvailable}
              label="Model artifacts"
              detail={modelsAvailable === null ? "Unknown" : modelsAvailable ? "All present" : "Some missing"}
            />
            <DotRow
              ok={loadedCount === undefined ? null : loadedCount > 0}
              label="Models loaded"
              detail={loadedCount === undefined ? "Unknown" : `${loadedCount} of ${backend.models?.models.length ?? 0} (loaded on first use)`}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Detection pipeline" description="What the backend does with every uploaded dataset." />
        <CardBody>
          <ol className="grid gap-3 md:grid-cols-6">
            {PIPELINE_STEPS.map((s, i) => (
              <li key={s.label} className="relative flex flex-col rounded-md border border-line bg-canvas/60 p-3">
                <span className="num text-[11px] text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                <span className="mt-0.5 text-[13px] font-semibold leading-snug">{s.label}</span>
                <span className="mt-1 text-xs text-ink-muted">{s.detail}</span>
                {i < PIPELINE_STEPS.length - 1 ? (
                  <ArrowDown className="absolute -bottom-3.5 left-1/2 z-10 size-4 -translate-x-1/2 rounded-full bg-surface text-ink-faint md:hidden" aria-hidden />
                ) : null}
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Recent screenings"
          description="Held in server memory since the backend started."
          actions={
            <Link to="/screenings" className="text-[13px] font-medium text-accent hover:underline">
              View all
            </Link>
          }
        />
        {recent.status === "loading" ? (
          <SkeletonRows rows={3} />
        ) : recent.status === "error" ? (
          <div className="p-4">
            <ErrorState error={recent.error} onRetry={recent.reload} compact />
          </div>
        ) : recent.data.items.length === 0 ? (
          <EmptyState
            icon={History}
            title="No screening runs yet"
            description="Completed screenings will appear here."
            action={
              <Link to="/screenings/new">
                <Button size="sm">Start a screening</Button>
              </Link>
            }
          />
        ) : (
          <>
            <DataTable caption="Most recent screenings" columns={columns} rows={recent.data.items.slice(0, 5)} rowKey={(r) => r.screening_id} />
            <p className="border-t border-line px-4 py-2 text-xs text-ink-muted">{formatInt(recent.data.total)} stored in total.</p>
          </>
        )}
      </Card>
    </div>
  );
}
