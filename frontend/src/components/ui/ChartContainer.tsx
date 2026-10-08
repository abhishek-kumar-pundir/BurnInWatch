import type { ReactNode } from "react";
import { Card, CardHeader } from "./Card";

interface Props {
  title: string;
  description?: ReactNode;
  /** Plain-language description of what the chart shows, exposed to assistive technology. */
  summary: string;
  actions?: ReactNode;
  height?: number;
  children: ReactNode;
  footer?: ReactNode;
}

export function ChartContainer({ title, description, summary, actions, height = 280, children, footer }: Props) {
  return (
    <Card>
      <CardHeader title={title} description={description} actions={actions} />
      <div className="px-2 pt-3" style={{ height }} role="img" aria-label={`${title}. ${summary}`}>
        {children}
      </div>
      {footer ? <div className="border-t border-line px-4 py-2 text-xs text-ink-muted">{footer}</div> : <div className="pb-2" />}
    </Card>
  );
}
