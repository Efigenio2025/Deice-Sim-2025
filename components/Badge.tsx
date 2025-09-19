import { ReactNode } from "react";

const cn = (...classes: Array<string | undefined | false>) =>
  classes.filter(Boolean).join(" ");

type BadgeProps = {
  children: ReactNode;
  className?: string;
  tone?: "default" | "sky" | "critical";
};

export function Badge({ children, className, tone = "default" }: BadgeProps) {
  const tones: Record<typeof tone, string> = {
    default: "border-slate-800/90 bg-slate-900/70 text-slate-200/80",
    sky: "border-sky-500/60 bg-sky-500/10 text-sky-300",
    critical: "border-rose-500/60 bg-rose-500/10 text-rose-300"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
        "transition-colors",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
