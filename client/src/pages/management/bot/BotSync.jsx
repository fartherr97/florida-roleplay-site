import { useState } from "react";
import { CheckCheck, PauseCircle, RefreshCw, RotateCcw } from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import BotError from "../../../components/bot/BotError";
import Loading from "../../../components/bot/Loading";
import Empty from "../../../components/bot/Empty";
import Paginator from "../../../components/bot/Paginator";
import JobProgress from "../../../components/bot/JobProgress";
import { useBotResource } from "../../../lib/useBotResource";
import { api, query } from "../../../lib/botApi";
import { formatDateTime } from "../../../lib/format";
import { jobTone, severityTone } from "../../../lib/botStatus";
import { cn } from "../../../lib/cn";

/**
 * What the bot could not do, and what it is doing.
 *
 * Issues lead. They are the bot reporting a member it cannot rename, a role
 * above its own, a role that no longer exists — the things that quietly stop a
 * roster being true. Buried in a table at the bottom of a settings page they
 * would never be read, so they get the top of their own screen with the action
 * that clears each one attached to it.
 */
export default function BotSync() {
  const [tab, setTab] = useState("issues");
  const [page, setPage] = useState(1);
  const issues = useBotResource(`/sync/issues${query({ page, pageSize: 25 })}`);
  const jobs = useBotResource(`/sync/jobs${query({ pageSize: 25 })}`);
  const [jobId, setJobId] = useState(null);
  const [error, setError] = useState(null);

  const act = async (fn, reload) => {
    setError(null);
    try {
      const result = await fn();
      reload?.();
      return result;
    } catch (err) {
      setError(err);
      return null;
    }
  };

  const syncAll = () =>
    act(async () => {
      const result = await api("/sync/all", { method: "POST" });
      setJobId(result?.jobId ?? result?.id ?? null);
    });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl bg-white/[0.03] p-1 ring-1 ring-inset ring-white/[0.06]">
          {[
            { id: "issues", label: `Issues${issues.data?.pagination?.total ? ` · ${issues.data.pagination.total}` : ""}` },
            { id: "jobs", label: "Jobs" },
          ].map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                entry.id === tab ? "bg-primary-500 text-white" : "text-slate-400 hover:text-white",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <Button size="sm" className="ml-auto" onClick={syncAll}>
          <RefreshCw className="size-4" />
          Sync everything
        </Button>
      </div>

      {error && <BotError error={error} className="mb-5" />}

      {jobId && (
        <div className="mb-5">
          <JobProgress
            jobId={jobId}
            title="Full sync"
            onDone={() => {
              issues.reload();
              jobs.reload();
            }}
            onClose={() => setJobId(null)}
          />
        </div>
      )}

      {tab === "issues" ? (
        issues.error ? (
          <BotError error={issues.error} onRetry={issues.reload} />
        ) : issues.loading ? (
          <Loading rows={4} />
        ) : (issues.data?.items ?? []).length === 0 ? (
          <Empty title="Nothing outstanding">
            The bot has applied everything it was asked to. Issues appear here when it
            cannot — a member it cannot rename, a role above its own, a role that has
            been deleted.
          </Empty>
        ) : (
          <>
            <div className="space-y-3">
              {issues.data.items.map((issue) => (
                <Card key={issue.id} className="flex flex-wrap items-start gap-3 p-5">
                  <Badge tone={severityTone(issue.severity)}>{issue.severity}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-200">{issue.message}</p>
                    {(issue.guild || issue.user || issue.mapping) && (
                      <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-300">
                        {issue.guild?.name && (
                          <span>
                            Server: <span className="font-semibold text-white">{issue.guild.name}</span>
                          </span>
                        )}
                        {issue.user?.displayName && <span>· Member: {issue.user.displayName}</span>}
                        {issue.mapping?.name && <span>· Mapping: {issue.mapping.name}</span>}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-slate-500">
                      {issue.type}
                      {issue.createdAt && ` · ${formatDateTime(issue.createdAt)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {issue.retryable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          act(
                            () =>
                              api(`/sync/issues/${encodeURIComponent(issue.id)}/retry`, {
                                method: "POST",
                              }),
                            issues.reload,
                          )
                        }
                      >
                        <RotateCcw className="size-4" />
                        Retry
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        act(
                          () =>
                            api(`/sync/issues/${encodeURIComponent(issue.id)}/resolve`, {
                              method: "POST",
                            }),
                          issues.reload,
                        )
                      }
                    >
                      <CheckCheck className="size-4" />
                      Resolve
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
            <Paginator pagination={issues.data.pagination} onPage={setPage} className="mt-4" />
          </>
        )
      ) : jobs.error ? (
        <BotError error={jobs.error} onRetry={jobs.reload} />
      ) : jobs.loading ? (
        <Loading rows={4} />
      ) : (jobs.data?.items ?? []).length === 0 ? (
        <Empty title="No jobs yet">Anything that changes Discord shows up here.</Empty>
      ) : (
        <Card className="divide-y divide-white/[0.06]">
          {jobs.data.items.map((job) => (
            <div key={job.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <Badge tone={jobTone(job.status)}>
                {job.status === "PAUSED" && <PauseCircle className="size-3" />}
                {job.status}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-300">{job.type ?? job.kind ?? "Sync"}</p>
                {job.status === "PAUSED" && (
                  <p className="mt-1 text-xs leading-relaxed text-amber-200">
                    Held by a safety check rather than failed — review before releasing it.
                  </p>
                )}
                <code className="mt-1 block text-xs text-slate-600">{job.id}</code>
              </div>
              {job.createdAt && (
                <time className="text-xs text-slate-500">{formatDateTime(job.createdAt)}</time>
              )}
              <Button variant="ghost" size="sm" onClick={() => setJobId(job.id)}>
                Details
              </Button>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

