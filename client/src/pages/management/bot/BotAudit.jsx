import { useState } from "react";
import { Download } from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import { TextInput } from "../../../components/ui/TextInput";
import BotError from "../../../components/bot/BotError";
import Loading from "../../../components/bot/Loading";
import Empty from "../../../components/bot/Empty";
import Paginator from "../../../components/bot/Paginator";
import { useBotResource } from "../../../lib/useBotResource";
import { query } from "../../../lib/botApi";
import { formatDateTime } from "../../../lib/format";

const BASE = import.meta.env.VITE_API_URL;

/**
 * Everything the bot recorded. Read-only by definition.
 *
 * Export is a plain link rather than a fetch: the response is a file, and
 * letting the browser handle the download means it carries the session cookie
 * the same way any other navigation does, without the dashboard having to hold
 * the bytes in memory to hand them back.
 */
export default function BotAudit() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const audit = useBotResource(`/audit${query({ page, pageSize: 25, q: applied })}`);

  const submit = (event) => {
    event.preventDefault();
    setPage(1);
    setApplied(search.trim());
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <form onSubmit={submit} className="flex min-w-64 flex-1 gap-2">
          <TextInput
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the audit log…"
            aria-label="Search the audit log"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
        {BASE && (
          <Button as="a" href={`${BASE}/api/audit/export`} variant="ghost" size="sm">
            <Download className="size-4" />
            Export
          </Button>
        )}
      </div>

      {audit.error ? (
        <BotError error={audit.error} onRetry={audit.reload} />
      ) : audit.loading ? (
        <Loading rows={5} />
      ) : (audit.data?.items ?? []).length === 0 ? (
        <Empty title="Nothing recorded">
          {applied
            ? "No entries match that search."
            : "The audit log is empty."}
        </Empty>
      ) : (
        <>
          <Card className="divide-y divide-white/[0.06]">
            {audit.data.items.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                <Badge tone="slate">{entry.action ?? entry.type}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-300">
                    {entry.message ?? entry.summary ?? entry.description ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {entry.actorName ?? entry.actorId ?? "System"}
                    {entry.requestId && (
                      <>
                        {" · "}
                        <code className="text-slate-600">{entry.requestId}</code>
                      </>
                    )}
                  </p>
                </div>
                {entry.createdAt && (
                  <time className="shrink-0 text-xs text-slate-500">
                    {formatDateTime(entry.createdAt)}
                  </time>
                )}
              </div>
            ))}
          </Card>
          <Paginator pagination={audit.data.pagination} onPage={setPage} className="mt-4" />
        </>
      )}
    </>
  );
}
