import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "../../utils/cn";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  isRowActive?: (row: T) => boolean;
  caption: string;
  empty?: ReactNode;
}

const align = { left: "text-left", right: "text-right", center: "text-center" };

/** Horizontally scrollable table; rows are keyboard-activatable when onRowClick is set. */
export function DataTable<T>({ columns, rows, rowKey, onRowClick, isRowActive, caption, empty }: Props<T>) {
  if (rows.length === 0) return <>{empty ?? <EmptyState title="No rows" />}</>;
  const onKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (onRowClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onRowClick(row);
    }
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-canvas/70 text-[11px] uppercase tracking-wide text-ink-muted">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("px-3 py-2 font-semibold", align[c.align ?? "left"], c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => onKey(e, row) : undefined}
              aria-selected={isRowActive?.(row) || undefined}
              className={cn(
                "border-b border-line/70 last:border-0",
                onRowClick && "cursor-pointer hover:bg-accent-soft/50 focus-visible:bg-accent-soft/60",
                isRowActive?.(row) && "bg-accent-soft/60",
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn("px-3 py-2 align-middle", align[c.align ?? "left"], c.className)}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
