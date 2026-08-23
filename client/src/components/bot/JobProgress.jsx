import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Loader, PauseCircle, XCircle } from "lucide-react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { api, waitForJob } from "../../lib/botApi";
import { cn } from "../../lib/cn";

/**
 * Polls a queued job and reports what actually happened.
 *
 * Anything that touches Discord is asynchronous, so the response to a write is
 * a job id rather than a result. Showing an optimistic success toast at that
 * point would be claiming an outcome nobody has yet — this waits for the real
 * one.
 *
 * PAUSED is given its own treatment on purpose. It is not a failure: it is a
 * safety guard tripping, usually because the change would have removed a lot of
 * people at once. Presenting it in red beside FAILED would teach people to
 * dismiss the one status that most deserves reading.
 */
const OUTCOMES = {
  COMPLETED: { label: "Completed", tone: "green", Icon: CheckCircle2 },
  PARTIAL: { label: "Partly completed", tone: "amber", Icon: CircleAlert },
  FAILED: { label: "Failed", tone: "rose", Icon: XCircle },
  CANCELLED: { label: "Cancelled", tone: "slate", Icon: XCircle },
  PAUSED: { label: "Paused by a safety check", tone: "amber", Icon: PauseCircle },
};

export default function JobProgress({ jobId, title = "Sync", onDone, onClose }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!jobId) return undefined;
    let active = true;
    setJob(null);
    setError(null);

    waitForJob(jobId, { onTick: (tick) => active && setJob(tick) })
      .then((final) => {
        if (!active) return;
        setJob(final);
        onDone?.(final);
      })
      .catch((err) => active && setError(err));

    return () => {
      active = false;
    };
    // onDone is intentionally not a dependency: callers pass an inline function,
    // and re-running would start a second poll for the same job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  if (!jobId) return null;

  const outcome = job && OUTCOMES[job.status];
  const running = !outcome && !error;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start gap-3">
        {running ? (
          <Loader className="mt-0.5 size-5 shrink-0 animate-spin text-slate-400" />
        ) : outcome ? (
          <outcome.Icon
            className={cn(
              "mt-0.5 size-5 shrink-0",
              outcome.tone === "green" && "text-emerald-400",
              outcome.tone === "amber" && "text-amber-400",
              outcome.tone === "rose" && "text-rose-400",
              outcome.tone === "slate" && "text-slate-400",
            )}
          />
        ) : (
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-rose-400" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white">{title}</p>
            {outcome && <Badge tone={outcome.tone}>{outcome.label}</Badge>}
            {running && <Badge tone="slate">{job?.status ?? "Queued"}</Badge>}
          </div>

          {error && (
            <p className="mt-1.5 text-sm text-rose-300">{error.message}</p>
          )}

          {job?.status === "PAUSED" && (
            <p className="mt-2 text-sm leading-relaxed text-amber-200">
              A safety check stopped this before it ran. That usually means the change
              would have affected an unusually large number of people at once. Nothing
              has been applied — review what it would have done before releasing it.
            </p>
          )}

          {job?.message && job.status !== "PAUSED" && (
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{job.message}</p>
          )}

          {job && <JobCounts job={job} />}

          <code className="mt-3 block text-xs text-slate-600">{jobId}</code>
        </div>

        <div className="flex shrink-0 gap-2">
          {running && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => api(`/sync/jobs/${jobId}/cancel`, { method: "POST" }).catch(() => {})}
            >
              Cancel
            </Button>
          )}
          {!running && onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Whatever counters the job carries. The shape is the API's, so this renders
 * what is present rather than assuming a fixed set — a job that reports
 * `skipped` should not need a frontend change to show it.
 */
function JobCounts({ job }) {
  const counts = Object.entries(job)
    .filter(
      ([key, value]) =>
        typeof value === "number" &&
        !/^(id|createdAt|updatedAt|startedAt|finishedAt)$/i.test(key),
    )
    .slice(0, 8);

  if (counts.length === 0) return null;

  return (
    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
      {counts.map(([key, value]) => (
        <div key={key} className="flex items-baseline gap-1.5">
          <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {key.replace(/([A-Z])/g, " $1").trim()}
          </dt>
          <dd className="text-sm font-bold text-white">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
