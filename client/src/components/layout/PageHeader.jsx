import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "../../lib/cn";

/** Opening block for every interior page — eyebrow, title, subtitle, back link. */
export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  backTo,
  backLabel = "Back",
  actions,
  className,
}) {
  return (
    <div className={cn("mb-10", className)}>
      {backTo && (
        <Link
          to={backTo}
          className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft className="size-3.5" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow && (
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-400">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-2xl text-slate-400">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 gap-3">{actions}</div>}
      </div>
    </div>
  );
}
