import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-md border border-line bg-surface shadow-[0_1px_0_rgba(15,23,42,0.03)]", className)} {...rest} />;
}

interface HeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function CardHeader({ title, description, actions, className }: HeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...rest} />;
}
