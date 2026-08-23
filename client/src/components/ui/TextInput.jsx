import { cn } from "../../lib/cn";

/** Shared shell for the site's text inputs — dark well, blue focus ring. */
const BASE =
  "w-full rounded-2xl bg-black/30 px-4 text-sm text-slate-100 placeholder:text-slate-500 " +
  "ring-1 ring-inset ring-white/10 transition focus:outline-none focus:ring-2 " +
  "focus:ring-brand-500/70 focus:bg-black/40";

export function TextInput({ className, ...props }) {
  return <input className={cn(BASE, "h-12", className)} {...props} />;
}

export function TextArea({ className, rows = 5, ...props }) {
  return (
    <textarea
      rows={rows}
      className={cn(BASE, "py-3 resize-y leading-relaxed", className)}
      {...props}
    />
  );
}

export default TextInput;
