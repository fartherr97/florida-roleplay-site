import { useEffect, useState } from "react";
import { History, RotateCcw, ScrollText } from "lucide-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import DeptPageHeader from "../../components/dept/DeptPageHeader";
import { useDeptConfig } from "../../context/useDeptConfig";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/format";

/**
 * Every change to this department's config, and the versions to roll back to.
 *
 * The restore path is the reason the version table exists: a department that
 * breaks its own site — deletes the wrong page, empties its roster layout — can
 * put it back without anyone touching the database.
 */
export default function DeptAudit({ page, config }) {
  const { id, can, reload } = useDeptConfig();
  const [loaded, setLoaded] = useState({ id: null, entries: [], versions: [] });
  const [confirming, setConfirming] = useState(null);
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.deptAudit(id).catch(() => []),
      api.deptVersions(id).catch(() => []),
    ]).then(([entries, versions]) => {
      if (active) setLoaded({ id, entries: entries ?? [], versions: versions ?? [] });
    });
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  const fresh = loaded.id === id;
  const entries = fresh ? loaded.entries : [];
  const versions = fresh ? loaded.versions : [];

  const restore = async (version) => {
    const result = await api.restoreDeptVersion(id, version.id);
    setConfirming(null);
    setNotice(result?.ok ? "Restored. The site is back to that version." : result?.message ?? "");
    if (result?.ok) reload();
    setReloadKey((key) => key + 1);
  };

  return (
    <>
      <DeptPageHeader
        icon={page.icon}
        eyebrow={config.branding.shortName}
        title={page.label}
        subtitle="Who changed what on this site, and how to put it back."
      />

      {notice && (
        <p className="mb-5 rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-slate-300 ring-1 ring-inset ring-white/10">
          {notice}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
            <ScrollText className="size-4" />
            Changes
          </h2>
          {entries.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-slate-400">
                No changes recorded. The audit trail starts once a database is configured and the
                first edit is saved.
              </p>
            </Card>
          ) : (
            <Card className="divide-y divide-white/[0.06]">
              {entries.map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                  <Badge tone="brand">{entry.action}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-300">{entry.summary}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {entry.actorName || entry.actor || "Unknown"}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-slate-500">
                    {formatDateTime(entry.at)}
                  </time>
                </div>
              ))}
            </Card>
          )}
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
            <History className="size-4" />
            Version history
          </h2>
          {versions.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-slate-400">
                No earlier versions stored yet.
              </p>
            </Card>
          ) : (
            <Card className="divide-y divide-white/[0.06]">
              {versions.map((version) => (
                <div key={version.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-300">
                      {version.label || "Saved version"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(version.at)}</p>
                  </div>
                  {can("manage") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirming(version)}
                    >
                      <RotateCcw className="size-4" />
                      Restore
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          )}
        </section>
      </div>

      {confirming && (
        <Modal open onClose={() => setConfirming(null)} title="Restore this version?">
          <p className="text-sm text-slate-400">
            The whole site — branding, pages, roster layout and access — goes back to how it was
            on {formatDateTime(confirming.at)}. The current version is kept, so this is
            reversible.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => restore(confirming)}>
              Restore
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
