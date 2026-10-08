import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong border-transparent shadow-sm disabled:border-line disabled:bg-line disabled:text-ink-faint disabled:shadow-none",
  secondary: "bg-surface text-ink border-line-strong hover:bg-canvas disabled:text-ink-faint",
  ghost: "bg-transparent text-ink-muted border-transparent hover:bg-canvas hover:text-ink disabled:text-ink-faint",
  danger: "bg-anomaly text-white border-transparent hover:opacity-90",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-6 text-[15px] gap-2 font-semibold",
};

export function Button({ variant = "secondary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-medium transition-colors disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
