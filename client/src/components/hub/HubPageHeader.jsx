import { createElement } from "react";
import { cn } from "../../lib/cn";
import { hubIcon } from "../../lib/hubIcons";

/** Opening block for a hub page — icon tile, eyebrow, title, subtitle, actions. */
export default function HubPageHeader({
  icon,
  eyebrow = "Staff Hub",
  title,
  subtitle,
  actions,
  className,
}) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-start gap-4", className)}>
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-500/15 text-primary-400 ring-1 ring-inset ring-primary-400/20">
        {/* createElement keeps the data-driven icon from being declared as a
            fresh component on every render. */}
        {createElement(hubIcon(icon), { className: "size-5" })}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-400">
          {eyebrow}
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
