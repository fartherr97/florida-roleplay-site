import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import { api } from "../../lib/api";
import { cn } from "../../lib/cn";
import { formatDateTime } from "../../lib/format";

const STATUSES = ["Pending Review", "Investigating", "Actioned", "Dismissed"];

const TONES = {
  "Pending Review": "amber",
  Investigating: "brand",
  Actioned: "green",
  Dismissed: "slate",
};

/**
 * The moderation queue — what members have filed through /reports.
 *
 * Reports had a write path and no read path: they went into the table and
 * nobody could see them. This is the other half.
 */
export default function HubReports() {
  const [reports, setReports] = useState(null);
  const [status, setStatus] = useState("Pending Review");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(null);
  // A queue that renders off the seed but refuses the write is the one case
  // worth saying out loud — otherwise the dropdown snaps back and looks broken.
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    let active = true;
    api
      .moderationQueue()
      .then((data) => active && setReports(data.reports ?? []))
      .catch(() => active && setReports([]));
    return () => {
      active = false;
    };
  }, []);

  useEffect(load, [load]);

  const rows = useMemo(() => {
    const list = reports ?? [];
    const needle = query.trim().toLowerCase();
    return list.filter((report) => {
      if (status !== "all" && report.status !== status) return false;
      if (!needle) return true;
      return [report.reference, report.involved, report.description, report.type]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [reports, status, query]);

  const counts = useMemo(() => {
    const list = reports ?? [];
    return Object.fromEntries(STATUSES.map((s) => [s, list.filter((r) => r.status === s).length]));
  }, [reports]);

  async function move(reference, next) {
    setBusy(reference);
    setError(null);
    const result = await api.setReportStatus(reference, next);
    setBusy(null);
    if (result?.ok) {
      setReports((prev) => prev.map((r) => (r.reference === reference ? { ...r, status: next } : r)));
      return;
    }
    setError(result?.message ?? "That could not be saved. Nothing was changed.");
  }

  return (
    <>
      <HubPageHeader
        icon="Megaphone"
        eyebrow="Staff Hub"
        title="Reports"
        subtitle="What the community has filed against players and staff. Work the top of the queue first — a report nobody answers is worse than none."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {STATUSES.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => setStatus(entry)}
            className={cn(
              "rounded-xl px-3.5 py-2 text-sm font-semibold ring-1 ring-inset transition",
              status === entry
                ? "bg-primary-500/15 text-white ring-primary-400/40"
                : "bg-black/20 text-slate-400 ring-white/[0.06] hover:text-white",
            )}
          >
            {entry} <span className="tabular-nums text-slate-500">({counts[entry] ?? 0})</span>
          </button>
        ))}
        <div className="ml-auto w-full sm:w-64">
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reference or name"
            aria-label="Search reports"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/20">
          {error}
        </div>
      )}

      {reports === null ? (
        <div className="space-y-3">
          {[0, 1].map((n) => (
            <div key={n} className="h-32 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-semibold text-white">
            {status === "Pending Review" ? "Nothing waiting." : "Nothing here."}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {status === "Pending Review"
              ? "Every report has been picked up."
              : "Try another status."}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((report) => (
            <Card key={report.reference} className="p-5">
              <div className="flex flex-wrap items-center gap-2.5">
                <code className="rounded-lg bg-black/30 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-inset ring-white/10">
                  {report.reference}
                </code>
                <Badge tone={TONES[report.status] ?? "slate"}>{report.status}</Badge>
                <span className="text-xs text-slate-500">{report.type}</span>
                <span className="ml-auto text-xs text-slate-500">{formatDateTime(report.createdAt)}</span>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <Detail label="Involved" value={report.involved} />
                <Detail label="When" value={report.occurredAt || "—"} />
                <Detail label="Filed by" value={report.discordId} mono />
              </dl>

              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {report.description}
              </p>

              {report.evidence && (
                <p className="mt-2 break-all text-xs text-slate-500">Evidence: {report.evidence}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
                <span className="text-xs text-slate-500">Move to</span>
                <Select
                  value={report.status}
                  options={STATUSES.map((s) => ({ value: s, label: s }))}
                  onChange={(next) => move(report.reference, next)}
                  className="w-48"
                />
                {busy === report.reference && <Loader2 className="size-4 animate-spin text-slate-500" />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Detail({ label, value, mono = false }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className={cn("mt-0.5 break-words text-sm text-slate-200", mono && "font-mono text-xs")}>
        {value}
      </dd>
    </div>
  );
}
