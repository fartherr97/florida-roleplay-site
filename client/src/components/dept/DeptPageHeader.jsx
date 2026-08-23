import { createElement } from "react";
import { hubIcon } from "../../lib/hubIcons";
import { cn } from "../../lib/cn";

/**
 * Opening block for a department page. Identical in shape to the staff and
 * civilian hubs' header, but tinted with the department's own accent so the
 * moment you land on a department site you can tell which one it is.
 */
export default function DeptPageHeader({ icon, eyebrow, title, subtitle, actions, className }) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-start gap-4", className)}>
      <span className="dept-accent-tile grid size-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset">
        {/* createElement keeps the data-driven icon from being declared as a
            fresh component on every render. */}
        {createElement(hubIcon(icon), { className: "size-5" })}
      </span>
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="dept-accent-text text-[11px] font-bold uppercase tracking-[0.18em]">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
