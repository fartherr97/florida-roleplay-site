import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import Card from "../../components/ui/Card";
import Logo from "../../components/layout/Logo";
import RosterFilters from "../../components/roster/RosterFilters";
import RosterHeader from "../../components/roster/RosterHeader";
import RosterTable from "../../components/roster/RosterTable";
import { api as botApi, isConfigured as botConfigured } from "../../lib/botApi";
import { SITE } from "../../data/mockData";
import { formatDate } from "../../lib/format";

/**
 * The staff roster, projected straight from the roster the bot maintains.
 *
 * The bot dashboard owns who is on the roster and at what rank — membership is a
 * Discord role, not a row somebody types here — so this reads the bot's
 * published roster rather than a second copy. Every rank with a callsign block
 * shows the whole establishment: each number in the block is a seat, filled by
 * whoever holds that callsign or rendered as a greyed, italic vacancy. A vacant
 * seat is exactly the thing a roster exists to surface, so it is shown, not
 * filtered away.
 *
 * It is read-only on purpose. Renaming, callsigns and rank all flow from Discord
 * through the bot; editing them here would be a second opinion the bot would
 * overwrite on its next sync.
 */

/** Cycled so adjacent rank bands read apart; not tied to any one rank's meaning. */
const RANK_COLORS = [
  "#f59e0b", "#22d3ee", "#f43f5e", "#f2800d",
  "#8b5cf6", "#10b981", "#3b82f6", "#64748b",
];

const isBlock = (rank) =>
  Number.isInteger(rank?.callsignRangeStart) &&
  Number.isInteger(rank?.callsignRangeEnd) &&
  rank.callsignRangeStart <= rank.callsignRangeEnd;

/**
 * Turns one rank into its rows. A rank with a callsign block yields a row for
 * every number in it — filled or vacant — plus any member whose callsign falls
 * outside the block (a custom badge, or the `???` placeholder). A rank without a
 * block simply lists whoever holds it.
 */
function rowsForRank(rank) {
  const members = rank.members ?? [];

  if (!isBlock(rank)) {
    return members.map((m) => ({
      id: m.discordUserId,
      callsign: m.callsign || "—",
      name: m.name,
      discordId: m.discordUserId,
      since: m.since,
      vacant: false,
    }));
  }

  const { callsignRangeStart: start, callsignRangeEnd: end } = rank;
  const byNumber = new Map();
  const extras = [];
  for (const m of members) {
    const n = /^\d+$/.test(String(m.callsign ?? "")) ? Number(m.callsign) : null;
    if (n !== null && n >= start && n <= end) byNumber.set(n, m);
    else extras.push(m);
  }

  const rows = [];
  for (let n = start; n <= end; n += 1) {
    const m = byNumber.get(n);
    rows.push(
      m
        ? { id: m.discordUserId, callsign: String(n), name: m.name, discordId: m.discordUserId, since: m.since, vacant: false }
        : { id: `vacant-${rank.discordRoleId}-${n}`, callsign: String(n), name: null, vacant: true },
    );
  }
  for (const m of extras) {
    rows.push({
      id: m.discordUserId,
      callsign: m.callsign || "—",
      name: m.name,
      discordId: m.discordUserId,
      since: m.since,
      vacant: false,
    });
  }
  return rows;
}

export default function HubRoster() {
  const [roster, setRoster] = useState(null);
  const [query, setQuery] = useState("");
  // loading | ready | empty | error. Starts as error when there is no bot API to
  // call at all, so the effect never has to set that synchronously.
  const [state, setState] = useState(botConfigured ? "loading" : "error");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!botConfigured) return undefined;
    let active = true;

    setState("loading");
    botApi("/rosters")
      .then((result) => {
        if (!active) return;
        const rosters = result?.rosters ?? [];
        // The staff roster if the bot has one under that slug, otherwise the
        // first published roster — a single-roster community should just work.
        const picked = rosters.find((r) => r.slug === "staff") ?? rosters[0] ?? null;
        setRoster(picked);
        setState(picked ? "ready" : "empty");
      })
      .catch(() => active && setState("error"));

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const ranks = useMemo(() => roster?.ranks ?? [], [roster]);

  const filled = useMemo(
    () => ranks.reduce((sum, rank) => sum + (rank.members?.length ?? 0), 0),
    [ranks],
  );

  const seats = useMemo(
    () =>
      ranks.reduce(
        (sum, rank) => sum + (isBlock(rank) ? rank.callsignRangeEnd - rank.callsignRangeStart + 1 : rank.members?.length ?? 0),
        0,
      ),
    [ranks],
  );

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ranks
      .map((rank, index) => {
        let rows = rowsForRank(rank);
        if (needle) {
          // Searching is about people, so a vacancy — which has no name — drops
          // out. An unfiltered view is about seats, so it keeps them.
          rows = rows.filter(
            (row) =>
              !row.vacant &&
              [row.name, row.callsign, row.discordId]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(needle)),
          );
        }
        return {
          id: rank.discordRoleId ?? rank.name,
          label: rank.shortName && rank.shortName !== rank.name ? `${rank.name} · ${rank.shortName}` : rank.name,
          color: RANK_COLORS[index % RANK_COLORS.length],
          rows,
        };
      })
      .filter((group) => group.rows.length > 0);
  }, [ranks, query]);

  const columns = [
    {
      key: "callsign",
      label: "Callsign",
      width: "w-24",
      render: (row) => (
        <span className={row.vacant ? "text-slate-500" : "font-bold text-primary-400"}>
          {row.callsign || "—"}
        </span>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row) =>
        row.vacant ? (
          <span className="italic text-slate-500">Vacant</span>
        ) : (
          <p className="truncate font-semibold text-white">{row.name || "—"}</p>
        ),
    },
    {
      key: "discordId",
      label: "Discord UID",
      hideBelow: "lg",
      render: (row) =>
        row.discordId ? (
          <code className="text-[11px] text-slate-500">{row.discordId}</code>
        ) : (
          <span className="text-slate-600">—</span>
        ),
    },
    {
      key: "since",
      label: "Since",
      hideBelow: "xl",
      render: (row) =>
        row.since ? (
          <span className="whitespace-nowrap text-slate-400">{formatDate(row.since)}</span>
        ) : (
          <span className="text-slate-600">—</span>
        ),
    },
  ];

  return (
    <>
      <RosterHeader
        mark={<Logo size="size-10" />}
        title={`${SITE.name} · Staff Roster`}
        subtitle={
          state === "ready"
            ? `${filled} of ${seats} seats filled — projected live from Discord.`
            : "Every seat on the team, and who holds it."
        }
        onRefresh={() => setReloadKey((key) => key + 1)}
        total={filled}
        counts={[]}
      />

      <RosterFilters
        query={query}
        onQuery={setQuery}
        placeholder="Search name, callsign or Discord ID…"
      />

      {state === "error" && (
        <Card className="mb-5 flex items-start gap-3 p-5">
          <Info className="mt-0.5 size-5 shrink-0 text-amber-400" />
          <p className="text-sm leading-relaxed text-slate-300">
            The staff roster is served by the bot, and its connection is not configured
            here yet. Once the bot dashboard is reachable, whoever holds a rank in Discord
            appears on this page automatically.
          </p>
        </Card>
      )}

      {state === "empty" && (
        <Card className="mb-5 flex items-start gap-3 p-5">
          <Info className="mt-0.5 size-5 shrink-0 text-slate-500" />
          <p className="text-sm leading-relaxed text-slate-300">
            No roster is published from the bot yet. Bind a rank to a Discord role in the
            bot dashboard and its holders show up here after the next sync.
          </p>
        </Card>
      )}

      {state === "loading" ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-16 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : (
        <RosterTable
          columns={columns}
          groups={groups}
          empty={
            query
              ? "Nobody on the roster matches that search."
              : "No ranks are bound to Discord roles yet."
          }
        />
      )}
    </>
  );
}
