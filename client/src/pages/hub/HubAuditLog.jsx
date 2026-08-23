import { useEffect, useState } from "react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import ExamStatusBadge from "../../components/hub/ExamStatusBadge";
import { api } from "../../lib/api";
import { EXAMS, auditLog as seedLog } from "../../data/staffHubData";
import { formatDate } from "../../lib/format";

/** Permanent record of every exam result override. */
export default function HubAuditLog() {
  const [logs, setLogs] = useState(seedLog);

  useEffect(() => {
    let active = true;
    api.hubAuditLog().then((next) => {
      if (active && next?.length) setLogs(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <HubPageHeader
        icon="ScrollText"
        title="Audit Log"
        subtitle="Every override applied to an exam result, who applied it and why. Entries are never edited or removed."
        actions={<Badge tone="amber">Senior Admin+</Badge>}
      />

      {logs.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-400">No overrides recorded yet.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <Card key={log.id ?? `${log.attemptId}-${log.timestamp}`} hover className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <code className="rounded-lg bg-black/30 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-inset ring-white/10">
                  {log.attemptId}
                </code>
                <Badge tone="brand">
                  {EXAMS.find((e) => e.key === log.examType)?.short ?? log.examType}
                </Badge>
                <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  {formatDate(log.timestamp)}
                </span>
              </div>

              <p className="mt-4 text-sm font-bold text-white">{log.staffName}</p>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-slate-500">{log.originalScore}</span>
                <ExamStatusBadge status={log.originalStatus} />
                <span className="text-slate-600">→</span>
                <span className="font-semibold text-white">{log.overrideScore}</span>
                <ExamStatusBadge status={log.overrideStatus} />
              </div>

              <p className="mt-4 border-l-2 border-white/10 pl-3 text-sm leading-relaxed text-slate-400">
                {log.reason}
              </p>

              <p className="mt-4 border-t border-white/[0.06] pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                Reviewed by {log.reviewer}
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
