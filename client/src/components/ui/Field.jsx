import { cn } from "../../lib/cn";

/** Uppercase micro-label wrapper for form controls, with optional hint text. */
export default function Field({
  label,
  htmlFor,
  required = false,
  hint,
  className,
  children,
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400"
        >
          {label}
          {required && <span className="ml-1 text-brand-400">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
