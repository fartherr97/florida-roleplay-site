import { cn } from "../../lib/cn";

/** Small uppercase status pill with an optional glowing leading dot. */
const TONES = {
  primary: "text-primary-300 bg-primary-500/10 ring-primary-400/25",
  brand: "text-brand-300 bg-brand-500/10 ring-brand-400/25",
  green: "text-green-300 bg-green-500/10 ring-green-400/25",
  amber: "text-amber-300 bg-amber-500/10 ring-amber-400/25",
  rose: "text-rose-300 bg-rose-500/10 ring-rose-400/25",
  slate: "text-slate-300 bg-slate-500/10 ring-slate-400/25",
};

export default function Badge({
  tone = "slate",
  dot = false,
  className,
  children,
  ...props
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ring-inset",
        TONES[tone] ?? TONES.slate,
        className,
      )}
      {...props}
    >
      {dot && (
        <span className="size-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
      )}
      {children}
    </span>
  );
}
