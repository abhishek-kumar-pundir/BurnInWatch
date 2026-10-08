import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../utils/cn";

interface Props {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon: Icon = Inbox, action, className }: Props) {
  return (
    <div role="status" className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      <div className="flex size-10 items-center justify-center rounded-full border border-line bg-canvas text-ink-faint">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description ? <p className="max-w-md text-[13px] text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
