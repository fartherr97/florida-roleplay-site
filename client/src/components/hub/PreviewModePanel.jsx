import { Eye } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { STAFF_RANKS } from "../../data/mockData";
import { cn } from "../../lib/cn";

/**
 * Rank switcher shown while Discord OAuth is still stubbed, so the hub can be
 * reviewed as any rank. It renders nothing once the API reports a real session,
 * which is what makes it safe to leave in place — there is no flag to remember
 * to remove.
 */
const TONE_RING = {
  slate: "text-slate-300 ring-slate-400/30 hover:ring-slate-300/50",
  brand: "text-brand-300 ring-brand-400/30 hover:ring-brand-300/50",
  green: "text-emerald-300 ring-emerald-400/30 hover:ring-emerald-300/50",
  primary: "text-primary-300 ring-primary-400/30 hover:ring-primary-300/50",
  amber: "text-amber-300 ring-amber-400/30 hover:ring-amber-300/50",
  rose: "text-rose-300 ring-rose-400/30 hover:ring-rose-300/50",
};

const TONE_ACTIVE = {
  slate: "bg-slate-500/20 ring-slate-300/60",
  brand: "bg-brand-500/20 ring-brand-300/60",
  green: "bg-emerald-500/20 ring-emerald-300/60",
  primary: "bg-primary-500/20 ring-primary-300/60",
  amber: "bg-amber-500/20 ring-amber-300/60",
  rose: "bg-rose-500/20 ring-rose-300/60",
};

export default function PreviewModePanel({ className }) {
  const { previewAvailable, previewRank, setPreviewRank } = useAuth();

  if (!previewAvailable) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-primary-400/30 bg-primary-500/[0.04] p-5 text-center",
        className,
      )}
    >
      <p className="inline-flex items-center gap-2 text-sm font-bold text-white">
        <Eye className="size-4 text-primary-400" />
        Preview mode
      </p>
      <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-400">
        Discord sign-in isn't wired up yet. Browse the hub as any rank — this
        panel disappears automatically once Discord OAuth is live.
      </p>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {STAFF_RANKS.map((rank) => {
          const active = previewRank === rank.id;
          return (
            <button
              key={rank.id}
              type="button"
              onClick={() => setPreviewRank(active ? null : rank.id)}
              aria-pressed={active}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ring-inset transition",
                TONE_RING[rank.tone] ?? TONE_RING.slate,
                active
                  ? TONE_ACTIVE[rank.tone] ?? TONE_ACTIVE.slate
                  : "bg-white/[0.02] hover:bg-white/[0.05]",
              )}
            >
              Preview as {rank.label}
            </button>
          );
        })}
      </div>

      {previewRank && (
        <button
          type="button"
          onClick={() => setPreviewRank(null)}
          className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 transition hover:text-slate-300"
        >
          Clear preview
        </button>
      )}
    </div>
  );
}
