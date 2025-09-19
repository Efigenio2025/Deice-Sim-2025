import { ReactNode } from "react";

const cn = (...classes: Array<string | undefined | false>) =>
  classes.filter(Boolean).join(" ");

export type CardProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
};

export function Card({ title, subtitle, children, className, action }: CardProps) {
  return (
    <section
      className={cn(
        "group rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-lg backdrop-blur",
        "transition hover:border-sky-500/60 hover:shadow-sky-900/30",
        className
      )}
    >
      {(title || subtitle || action) && (
        <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && <h3 className="text-lg font-semibold text-slate-100">{title}</h3>}
            {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </header>
      )}
      <div className="text-sm text-slate-300">{children}</div>
    </section>
  );
}
