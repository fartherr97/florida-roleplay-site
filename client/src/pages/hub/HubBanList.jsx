import { useEffect, useMemo, useState } from "react";
import { Ban, Loader2, Search } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import CopyField from "../../components/ui/CopyField";
import { TextInput } from "../../components/ui/TextInput";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/format";

/**
 * The active Discord ban list.
 *
 * Enforcement lives in the florida-roleplay-manager bot: `/globalban` bans a
 * user across every server and reports it here, `/globalunban` clears it. This
 * page only displays what the bot reported — the guild display name and Discord
 * id first, with the reason, who banned them, and any expiry — so staff have a
 * live reference without the bot console. It is read-only; ban and unban from
 * Discord.
 */
export default function HubBanList() {
  const [bans, setBans] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    api
      .hubBans()
      .then((data) => active && setBans(data?.bans ?? []))
      .catch(() => active && setBans([]));
    return () => {
      active = false;
    };
  }, []);

  const shown = useMemo(() => {
    const list = bans ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((b) =>
      [b.displayName, b.discordId, b.reason, b.actorName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [bans, query]);

  return (
    <>
      <HubPageHeader
        icon="Ban"
        title="Discord Ban List"
        subtitle="Everyone currently banned across our servers by the bot's /globalban. Read-only — ban and unban run from Discord."
        actions={
          bans && (
            <Badge tone="rose">
              {bans.length} active {bans.length === 1 ? "ban" : "bans"}
            </Badge>
          )
        }
      />

      <div className="mb-5 max-w-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, ID, reason or staff…"
            className="pl-9"
          />
        </div>
      </div>

      {bans === null ? (
        <Card className="flex items-center justify-center gap-2 p-10 text-sm text-slate-400">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </Card>
      ) : shown.length === 0 ? (
        <Card className="p-10 text-center">
          <Ban className="mx-auto size-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">
            {bans.length === 0 ? "Nobody is banned right now." : "No bans match that search."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((ban) => (
            <Card key={ban.discordId} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{ban.displayName || "Unknown user"}</span>
                    {ban.expiresAt ? (
                      <Badge tone="amber">Until {formatDateTime(ban.expiresAt)}</Badge>
                    ) : (
                      <Badge tone="rose">Permanent</Badge>
                    )}
                    {Number.isFinite(ban.serversApplied) && Number.isFinite(ban.serversTotal) && (
                      <Badge tone="slate">
                        {ban.serversApplied}/{ban.serversTotal} servers
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2">
                    <CopyField value={ban.discordId} label="ID" />
                  </div>
                  {ban.reason && <p className="mt-2 text-sm text-slate-300">{ban.reason}</p>}
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {ban.actorName ? `Banned by ${ban.actorName}` : "Banned"}
                    {ban.createdAt ? ` · ${formatDateTime(ban.createdAt)}` : ""}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
