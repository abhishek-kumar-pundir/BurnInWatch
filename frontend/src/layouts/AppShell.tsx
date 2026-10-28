import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useMatch } from "react-router-dom";
import { Activity, Box, FilePlus2, FlaskConical, History, LayoutDashboard, Menu, Server, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { StatusPill } from "../components/StatusPill";
import { cn } from "../utils/cn";

interface NavDef {
  to: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
}

function useNav(): NavDef[] {
  const isNew = useMatch("/screenings/new");
  const isScreenings = useMatch({ path: "/screenings", end: false });
  const isOverview = useMatch({ path: "/", end: true });
  const isSystem = useMatch("/system");
  const isPerf = useMatch("/performance");
  const isDigitalTwin = useMatch("/digital-twin");
  return [
    { to: "/", label: "Overview", Icon: LayoutDashboard, active: !!isOverview },
    { to: "/screenings/new", label: "Live Screening", Icon: FilePlus2, active: !!isNew },
    { to: "/screenings", label: "Screening History", Icon: History, active: !!isScreenings && !isNew },
    { to: "/performance", label: "Model Performance", Icon: FlaskConical, active: !!isPerf },
    { to: "/digital-twin", label: "3D Digital Twin", Icon: Box, active: !!isDigitalTwin },
    { to: "/system", label: "System", Icon: Server, active: !!isSystem },
  ];
}

function pageTitle(path: string): string {
  if (path === "/") return "Overview";
  if (path === "/screenings/new") return "Live screening";
  if (path === "/performance") return "Model performance";
  if (path === "/screenings") return "Screening history";
  if (path.startsWith("/screenings/")) return "Live screening result";
  if (path === "/digital-twin") return "3D Digital Twin";
  if (path === "/system") return "System";
  return "Not found";
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-4 py-4 text-white">
      <span className="flex size-8 items-center justify-center rounded-md bg-white/10">
        <Activity className="size-[18px] text-teal-300" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight">BurnInWatch</span>
        <span className="block text-[11px] text-slate-400">Component screening</span>
      </span>
    </Link>
  );
}

function NavList({ items, onNavigate }: { items: NavDef[]; onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-0.5 px-2">
      {items.map(({ to, label, Icon, active }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
            active ? "bg-nav-hover text-white" : "text-slate-300 hover:bg-nav-hover/70 hover:text-white",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const items = useNav();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-56 shrink-0 flex-col bg-nav lg:flex">
        <Brand />
        <NavList items={items} />
        <p className="mt-auto px-4 py-4 text-[11px] leading-snug text-slate-500">
          Unsupervised anomaly screening. Results are screening signals, not failure predictions.
        </p>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-nav/60" onClick={() => setOpen(false)} aria-hidden />
          <aside className="bw-slide-in absolute inset-y-0 left-0 flex w-64 flex-col bg-nav">
            <div className="flex items-center justify-between">
              <Brand />
              <button type="button" aria-label="Close navigation" className="mr-3 rounded p-1.5 text-slate-300 hover:bg-nav-hover" onClick={() => setOpen(false)}>
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <NavList items={items} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-12 items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Open navigation" className="rounded p-1.5 text-ink-muted hover:bg-canvas lg:hidden" onClick={() => setOpen(true)}>
              <Menu className="size-5" aria-hidden />
            </button>
            <span className="text-[13px] font-semibold text-ink">{pageTitle(pathname)}</span>
          </div>
          <StatusPill />
        </header>
        <main className="bw-fade-in mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6" key={pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
