import Card from "../ui/Card";
import { aggregateResponses } from "../../lib/forms";

/**
 * A feedback form read as a whole rather than one response at a time.
 *
 * Choice questions become bars with counts, scales and ratings become an
 * average plus a distribution, and free text becomes a list. It is the only way
 * a 200-response survey is readable, and it works for graded exams too — a
 * question everyone gets wrong is worth seeing.
 */
export default function ResponseSummary({ form, submissions }) {
  const rows = aggregateResponses(form, submissions);
  const total = submissions.filter((entry) => entry.formId === form.id).length;

  if (total === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm text-slate-400">No responses yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        {total} response{total === 1 ? "" : "s"}.
      </p>

      {rows.map(({ question, answered, summary }) => (
        <Card key={question.id} className="p-6">
          <div className="mb-4">
            <p className="text-sm font-semibold leading-relaxed text-white">{question.prompt}</p>
            <p className="mt-1 text-xs text-slate-500">
              {answered} of {total} answered
            </p>
          </div>

          {summary.kind === "choice" && (
            <div className="space-y-2.5">
              {Object.entries(summary.counts).map(([option, count]) => {
                const percent = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
                return (
                  <div key={option}>
                    <div className="flex items-baseline gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-slate-300">{option}</span>
                      <span className="font-bold text-white">{count}</span>
                      <span className="w-10 text-right text-xs text-slate-500">{percent}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className="h-full rounded-full bg-primary-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {summary.kind === "numeric" && (
            <>
              <p className="mb-4 text-3xl font-extrabold tracking-tight text-primary-400">
                {summary.average.toFixed(1)}
                <span className="ml-2 text-sm font-semibold text-slate-500">
                  average of {summary.max}
                </span>
              </p>
              <div className="space-y-2">
                {Array.from(
                  { length: summary.max - summary.min + 1 },
                  (_, index) => summary.min + index,
                ).map((step) => {
                  const count = summary.distribution[step] ?? 0;
                  const percent = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
                  return (
                    <div key={step} className="flex items-center gap-3">
                      <span className="w-4 text-xs font-bold text-slate-400">{step}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-xs text-slate-500">{count}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {summary.kind === "text" &&
            (summary.items.length === 0 ? (
              <p className="text-sm text-slate-500">Nobody answered this one.</p>
            ) : (
              <ul className="space-y-2">
                {summary.items.map((item, index) => (
                  <li
                    key={`${question.id}-${index}`}
                    className="rounded-xl bg-white/[0.02] px-4 py-3 text-sm leading-relaxed text-slate-300 ring-1 ring-inset ring-white/[0.06]"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            ))}
        </Card>
      ))}
    </div>
  );
}
