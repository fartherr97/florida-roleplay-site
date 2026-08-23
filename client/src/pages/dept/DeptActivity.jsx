import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import DeptPageHeader from "../../components/dept/DeptPageHeader";
import { useDeptConfig } from "../../context/useDeptConfig";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/format";

/**
 * A running feed of what changed in this department — config edits from the
 * audit log alongside the roster bot's own sync entries. Read-only by design:
 * everything on it is a record of something that already happened elsewhere.
 */
const ACTION_TONES = {
  "config.save": "brand",
  "page.save": "brand",
  "access.save": "amber",
  "config.restore": "amber",
  "config.create": "green",
  added: "green",
  updated: "brand",
  removed: "rose",
  flagged: "amber",
};

export default function DeptActivity({ page, config }) {
  const { id, can } = useDeptConfig();
  const [loaded, setLoaded] = useState({ id: null, entries: [] });
  // This page is open to the whole department, but the audit log behind half of
  // it is not — so only ask for it when the caller may read it, and treat a
  // denial as "no config entries" rather than letting it break the feed.
  const mayAudit = can("viewAudit");

  useEffect(() => {
    let active = true;
    Promise.all([
      mayAudit ? api.deptAudit(id).catch(() => []) : Promise.resolve([]),
      api.rosterSyncLog(),
    ]).then(([audit, sync]) => {
      if (!active) return;
      const entries = [
        ...(audit ?? []).map((entry) => ({
          key: `a-${entry.id}`,
          at: entry.at,
          action: entry.action,
          who: entry.actorName || entry.actor || "Someone",
          detail: entry.summary,
        })),
        ...(sync ?? []).map((entry) => ({
          key: `s-${entry.id}`,
          at: entry.at,
          action: entry.action,
          who: entry.actor,
          detail: `${entry.characterName} — ${entry.detail}`,
        })),
      ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
      setLoaded({ id, entries });
    });
    return () => {
      active = false;
    };
  }, [id, mayAudit]);

  const entries = loaded.id === id ? loaded.entries : [];

  return (
    <>
      <DeptPageHeader
        icon={page.icon}
        eyebrow={config.branding.shortName}
        title={page.label}
        subtitle="Config changes and roster sync, newest first."
      />

      {entries.length === 0 ? (
        <Card className="p-10 text-center">
          <Activity className="mx-auto size-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">Nothing has happened here yet.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-white/[0.06]">
          {entries.map((entry) => (
            <div key={entry.key} className="flex flex-wrap items-start gap-3 px-5 py-4">
              <Badge tone={ACTION_TONES[entry.action] ?? "slate"}>{entry.action}</Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-300">{entry.detail}</p>
                <p className="mt-1 text-xs text-slate-500">{entry.who}</p>
              </div>
              <time className="shrink-0 text-xs text-slate-500">{formatDateTime(entry.at)}</time>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
