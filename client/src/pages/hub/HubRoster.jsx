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

  const { seats, filled, vacant } = useMemo(() => {
    let s = 0;
    let f = 0;
    let v = 0;
    for (const rank of ranks) {
      const members = rank.members ?? [];
      f += members.length;
      if (isBlock(rank)) {
        const size = rank.callsignRangeEnd - rank.callsignRangeStart + 1;
        const inBlock = members.filter((m) => {
          const n = /^\d+$/.test(String(m.callsign ?? "")) ? Number(m.callsign) : null;
          return n !== null && n >= rank.callsignRangeStart && n <= rank.callsignRangeEnd;
        }).length;
        s += size;
        v += Math.max(0, size - inBlock);
      } else {
        s += members.length;
      }
    }
    return { seats: s, filled: f, vacant: v };
  }, [ranks]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ranks
      .map((rank, index) => {
        // Each row carries the rank it sits under, so the Position column reads the
        // same for a filled seat and a vacant one.
        const positionNote = rank.shortName && rank.shortName !== rank.name ? rank.shortName : null;
        let rows = rowsForRank(rank).map((row) => ({ ...row, position: rank.name, positionNote }));
        if (needle) {
          // Searching is about people, so a vacancy — which has no name — drops
          // out. An unfiltered view is about seats, so it keeps them.
          rows = rows.filter(
            (row) =>
              !row.vacant &&
              [row.name, row.callsign, row.discordId, row.position]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(needle)),
          );
        }
        return {
          id: rank.discordRoleId ?? rank.name,
          label: rank.shortName && rank.shortName !== rank.name ? `${rank.name} · ${rank.shortName}` : rank.name,
          // The bound Discord role's colour, falling back to a cycled palette only when
          // the role has none set.
          color: rank.color || RANK_COLORS[index % RANK_COLORS.length],
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
      key: "position",
      label: "Position",
      hideBelow: "md",
      render: (row) => (
        <div className="min-w-0">
          <p className={cn("truncate text-sm font-semibold", row.vacant ? "text-slate-500" : "text-brand-300")}>
            {row.position}
          </p>
          {row.positionNote && <p className="truncate text-xs text-slate-500">{row.positionNote}</p>}
        </div>
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
      label: "Hired",
      hideBelow: "xl",
      render: (row) =>
        row.since ? (
          <span className="whitespace-nowrap text-slate-400">{formatDate(row.since)}</span>
        ) : (
          <span className="text-slate-600">—</span>
        ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) =>
        row.vacant ? (
          <span className="text-slate-600">—</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/25">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Active
          </span>
        ),
    },
    {
      key: "notes",
      label: "Notes",
      hideBelow: "2xl",
      render: (row) =>
        row.vacant ? (
          <span className="text-xs italic text-slate-600">Position unoccupied</span>
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
        total={seats}
        counts={[
          { label: "Filled", value: filled, color: "#10b981" },
          { label: "Vacant", value: vacant, color: "#64748b" },
        ]}
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
      ) : state === "ready" ? (
        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_18rem]">
          <RosterTable
            columns={columns}
            groups={groups}
            empty={
              query
                ? "Nobody on the roster matches that search."
                : "No ranks are bound to Discord roles yet."
            }
          />

          <aside className="space-y-5">
            <Card className="flex items-center justify-center p-8">
              <Logo size="size-20" />
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Statistics
              </h2>
              <dl className="space-y-2.5">
                <Stat label="Total seats" value={seats} />
                <Stat label="Filled" value={filled} accent="text-emerald-300" />
                <Stat label="Vacant" value={vacant} accent="text-slate-400" />
                <Stat
                  label="Fill rate"
                  value={seats ? `${Math.round((filled / seats) * 100)}%` : "—"}
                />
              </dl>
            </Card>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function Stat({ label, value, accent = "text-white" }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className={cn("text-sm font-bold tabular-nums", accent)}>{value}</dd>
    </div>
  );
}
