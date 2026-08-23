import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "../../lib/cn";

/** Monospace address with a copy-to-clipboard affordance. */
export default function CopyField({ value, label, className }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && (
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </span>
      )}
      <code className="truncate rounded-lg bg-black/30 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-inset ring-white/10">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-white"
      >
        {copied ? (
          <Check className="size-3.5 text-emerald-400" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </div>
  );
}
