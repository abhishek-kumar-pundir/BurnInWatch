import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useOverlay } from "../../hooks/useOverlay";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: Props) {
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-nav/50" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="bw-fade-in relative w-full max-w-lg rounded-md border border-line bg-surface shadow-xl outline-none">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded p-1 text-ink-muted hover:bg-canvas">
            <X className="size-4" aria-hidden />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
        {footer ? <footer className="flex justify-end gap-2 border-t border-line px-4 py-3">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
