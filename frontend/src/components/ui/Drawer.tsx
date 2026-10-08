import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useOverlay } from "../../hooks/useOverlay";

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  label: string;
  wide?: boolean;
}

export function Drawer({ open, onClose, title, subtitle, headerActions, children, label, wide }: Props) {
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-nav/40" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`bw-slide-in relative flex h-full w-full ${wide ? "max-w-3xl" : "max-w-xl"} flex-col border-l border-line bg-surface shadow-2xl outline-none`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {subtitle ? <div className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</div> : null}
          </div>
          <div className="flex items-center gap-1">
            {headerActions}
            <button type="button" onClick={onClose} aria-label="Close panel" className="rounded p-1.5 text-ink-muted hover:bg-canvas">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
