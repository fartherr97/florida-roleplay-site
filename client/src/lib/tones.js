/** Shared tone → class maps so department and application tints stay consistent. */
export const TONE_TILES = {
  primary: "bg-primary-500/15 text-primary-400 ring-primary-400/20",
  brand: "bg-brand-500/15 text-brand-400 ring-brand-400/20",
  green: "bg-emerald-500/15 text-emerald-400 ring-emerald-400/20",
  amber: "bg-amber-500/15 text-amber-400 ring-amber-400/20",
  rose: "bg-rose-500/15 text-rose-400 ring-rose-400/20",
  slate: "bg-slate-500/15 text-slate-300 ring-slate-400/20",
};

export function toneTile(tone) {
  return TONE_TILES[tone] ?? TONE_TILES.brand;
}
