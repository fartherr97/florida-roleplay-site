import { RefreshCw } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { cn } from "../../lib/cn";

/**
 * The strip above a roster: what this roster is, the views it offers, a refresh,
 * and the headline counts.
 *
 * The counts are the reason this is a strip rather than a page header — "98
 * total, 72 active, 2 on leave" is the thing people come to a roster to read,
 * and burying it under the table means scrolling to find it.
 */
export default function RosterHeader({
  title,
  subtitle,
  mark,
  views,
  activeView,
  onView,
  onRefresh,
  total,
  counts = [],
  live,
}) {
  return (
    <Card className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
      <div className="flex min-w-0 items-center gap-3">
        {mark}
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-extrabold tracking-tight text-white">
            {title}
          </h1>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>

      {views?.length > 1 && (
        <div className="flex rounded-xl bg-white/[0.03] p-1 ring-1 ring-inset ring-white/[0.06]">
          {views.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => onView(view.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                view.id === activeView
                  ? "bg-primary-500 text-white"
                  : "text-slate-400 hover:text-white",
              )}
            >
              {view.label}
            </button>
          ))}
        </div>
      )}

      {onRefresh && (
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
        {total != null && (
          <span className="rounded-xl bg-primary-500/10 px-3 py-1.5 text-xs font-bold text-primary-300 ring-1 ring-inset ring-primary-400/25">
            Total <span className="ml-1 text-sm text-white">{total}</span>
          </span>
        )}

        {counts.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-white/[0.02] px-3 py-1.5 ring-1 ring-inset ring-white/[0.06]">
            {counts.map((count) => (
              <span key={count.label} className="flex items-center gap-1.5 whitespace-nowrap">
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: count.color }}
                  aria-hidden="true"
                />
                <span className="text-[11px] font-semibold text-slate-400">{count.label}</span>
                <span className="text-xs font-bold text-white">{count.value}</span>
              </span>
            ))}
          </div>
        )}

        {live && (
          <span className="flex items-center gap-2 rounded-xl bg-white/[0.02] px-3 py-1.5 ring-1 ring-inset ring-white/[0.06]">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_currentColor]" />
            <span className="text-[11px] font-semibold text-slate-400">Live</span>
            <span className="text-xs font-bold text-white">{live.count}</span>
            {live.names?.length > 0 && (
              <span className="hidden max-w-40 truncate text-[11px] text-slate-500 lg:inline">
                {live.names.join(", ")}
              </span>
            )}
          </span>
        )}
      </div>
    </Card>
  );
}
