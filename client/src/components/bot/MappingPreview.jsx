import { ArrowRight } from "lucide-react";
import { plural } from "../../lib/format";

/** The name a preview row goes by, whichever key the API used for it. */
function subject(row) {
  return row.user ?? row.name ?? row.displayName ?? row.discordUserId ?? "Unknown member";
}

/**
 * What a mapping's `test` came back with.
 *
 * The counts lead, because "this would touch 412 people" is the thing that
 * stops somebody enabling a rule they should not, and it has to be readable at
 * a glance rather than counted out of a list. The sample is the evidence under
 * it — a rename shows the before and after side by side so the format can be
 * checked without reading it twice.
 *
 * Anything the API sends that this does not know how to lay out is still shown,
 * raw, rather than dropped: a preview that quietly hides part of what a rule
 * would do is worse than an ugly one.
 */
export default function MappingPreview({ result }) {
  const sample = Array.isArray(result?.sample) ? result.sample : [];
  const known = new Set(["wouldAffect", "wouldRemove", "sample"]);
  const extra = Object.fromEntries(
    Object.entries(result ?? {}).filter(([key]) => !known.has(key)),
  );

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <Stat label="Would affect" value={result?.wouldAffect} noun="member" />
        {result?.wouldRemove != null && (
          <Stat label="Would remove" value={result.wouldRemove} noun="role" danger />
        )}
      </div>

      {sample.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-inset ring-white/[0.06]">
          <p className="bg-white/[0.03] px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400">
            Sample of {plural(sample.length, "member")}
          </p>
          <ul className="divide-y divide-white/[0.06]">
            {sample.map((row, index) => (
              <li key={row.discordUserId ?? index} className="px-4 py-3 text-sm">
                <p className="font-semibold text-white">{subject(row)}</p>
                {(row.from != null || row.to != null) && (
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="break-all">{row.from || "—"}</span>
                    <ArrowRight className="size-3.5 shrink-0 text-slate-500" />
                    <span className="break-all text-slate-200">{row.to || "—"}</span>
                  </p>
                )}
                {row.reason && <p className="mt-1 text-xs text-slate-500">{row.reason}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {Object.keys(extra).length > 0 && (
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/30 p-4 text-xs leading-relaxed text-slate-400 ring-1 ring-inset ring-white/[0.06]">
          {JSON.stringify(extra, null, 2)}
        </pre>
      )}
    </div>
  );
}

function Stat({ label, value, noun, danger = false }) {
  return (
    <div className="rounded-xl bg-black/25 px-4 py-3 ring-1 ring-inset ring-white/[0.06]">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className={danger && value > 0 ? "text-lg font-black text-rose-300" : "text-lg font-black text-white"}>
        {value == null ? "—" : plural(value, noun)}
      </p>
    </div>
  );
}
