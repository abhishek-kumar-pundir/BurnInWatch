import { useId } from "react";
import type { ReactNode } from "react";

/** Lightweight CSS tooltip, reachable by keyboard focus. */
export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <span className="group relative inline-flex" aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden w-max max-w-64 -translate-x-1/2 rounded bg-nav px-2 py-1.5 text-[12px] font-normal normal-case leading-snug tracking-normal text-white shadow-lg group-focus-within:block group-hover:block"
      >
        {content}
      </span>
    </span>
  );
}
