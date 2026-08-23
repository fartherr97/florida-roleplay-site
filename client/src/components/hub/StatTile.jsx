import Card from "../ui/Card";
import { cn } from "../../lib/cn";

/** Labelled figure used across the hub's dashboards. */
export default function StatTile({ label, value, hint, tone = "white", className }) {
  const TONES = {
    white: "text-white",
    primary: "text-primary-400",
    brand: "text-brand-400",
    green: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
  };
  return (
    <Card className={cn("p-5", className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className={cn("mt-2 text-2xl font-extrabold tracking-tight", TONES[tone])}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}
