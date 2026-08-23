import { motion } from "framer-motion";
import Badge from "../ui/Badge";
import Logo from "../layout/Logo";
import { cn } from "../../lib/cn";

/**
 * The shared shell behind both AccessDenied (403) and NotFound (404) — a
 * self-contained page with its own header and footer rows, so neither renders
 * inside the public layout. The 1px gradient hairline across the top is the
 * page's signature; keep it exactly 1px.
 */
export default function StatusPanel({
  badgeLabel,
  badgeTone = "rose",
  errorLabel,
  icon,
  headlineTop,
  headlineBottom,
  headlineTone = "text-rose-500",
  message,
  note,
  code,
  actions,
  footerDashes = ["bg-emerald-500", "bg-emerald-500", "bg-rose-500"],
  footerLabel = "Auth Failed",
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="status-shell grid min-h-screen place-items-center bg-[#0a0e1a] p-4">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d0f18]/95 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]"
      >
        <div className="h-px w-full bg-[linear-gradient(90deg,#22c55e,#06b6d4,#8b5cf6,#ec4899,#ef4444)]" />

        <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="text-sm font-bold text-white">Florida Roleplay</span>
          </div>
          <Badge tone={badgeTone} dot>
            {badgeLabel}
          </Badge>
        </div>

        <div className="grid gap-8 p-8 sm:grid-cols-[auto_1fr]">
          <div className="flex justify-center sm:block">{icon}</div>

          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="h-px w-6 bg-brand-500" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-400">
                {errorLabel}
              </span>
            </div>

            <h1 className="mt-4 text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
              <span className="block text-white">{headlineTop}</span>
              <span className={cn("block", headlineTone)}>{headlineBottom}</span>
            </h1>

            <p className="mt-4 text-sm font-semibold text-slate-200">{message}</p>

            {note && (
              <blockquote className="mt-4 border-l-2 border-white/10 pl-3 text-xs leading-relaxed text-slate-500">
                {note}
              </blockquote>
            )}

            <div className="mt-7 flex flex-wrap gap-3">{actions}</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-white/[0.07] px-6 py-3 text-[11px]">
          <p className="flex items-center gap-2">
            <span className="text-slate-600">CODE</span>
            <span className="font-bold text-rose-500">{code}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-600">{today}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              {footerDashes.map((tone, i) => (
                <span key={`${tone}-${i}`} className={cn("h-px w-3", tone)} />
              ))}
            </span>
            <span className="uppercase tracking-[0.16em] text-slate-600">
              {footerLabel}
            </span>
          </p>
        </div>
      </motion.div>

      {/* Faint grid field behind the panel. */}
      <style>{`
        .status-shell {
          background-image:
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 48px 48px;
        }
      `}</style>
    </div>
  );
}
