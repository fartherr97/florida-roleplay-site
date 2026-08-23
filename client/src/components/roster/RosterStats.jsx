import Card from "../ui/Card";

/**
 * The status breakdown beside a roster. Percentages rather than bare counts:
 * "10 inactive" means something different on a team of 12 than on a team of 98,
 * and the bar makes the comparison without anyone doing the arithmetic.
 */
export default function RosterStats({ title = "Statistics", rows, total }) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
        {title}
      </h2>
      <div className="space-y-3">
        {rows.map((row) => {
          const percent = total > 0 ? Math.round((row.value / total) * 100) : 0;
          return (
            <div key={row.label}>
              <div className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                  aria-hidden="true"
                />
                <span className="truncate text-sm text-slate-300">{row.label}</span>
                <span className="ml-auto text-sm font-bold text-white">{row.value}</span>
                <span className="w-10 text-right text-xs text-slate-500">{percent}%</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${percent}%`, backgroundColor: row.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
