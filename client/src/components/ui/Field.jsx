import { cn } from "../../lib/cn";

/**
 * Uppercase micro-label wrapper for form controls, with optional hint text.
 *
 * `error` takes precedence over `hint` and renders in rose. They are separate
 * props on purpose: a rejection styled exactly like the guidance underneath it
 * is a rejection people scroll straight past.
 */
export default function Field({
  label,
  htmlFor,
  required = false,
  hint,
  error,
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
      {error ? (
        <p role="alert" className="text-xs text-rose-300">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}
