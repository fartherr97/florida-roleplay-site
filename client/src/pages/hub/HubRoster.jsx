import { useCallback, useEffect, useMemo, useState } from "react";
import { Info, Pencil } from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import Logo from "../../components/layout/Logo";
import RosterFilters from "../../components/roster/RosterFilters";
import RosterHeader from "../../components/roster/RosterHeader";
import RosterTable from "../../components/roster/RosterTable";
import { useAuth } from "../../context/useAuth";
import { api } from "../../lib/api";
import { api as botApi, isConfigured as botConfigured } from "../../lib/botApi";
import { ACTIVITY_STATUSES, statusColor } from "../../data/rosterData";
import { SITE } from "../../data/mockData";
import { formatDate } from "../../lib/format";
import { cn } from "../../lib/cn";

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

/**
 * Reused for the dev-team roster too — same projection, different roster and
 * accent. The props default to the staff roster so the Staff Hub route needs no
 * change.
 */
export default function HubRoster({
  slugs = ["staff"],
  nameMatch = null,
  fallbackToFirst = true,
  title = `${SITE.name} · Staff Roster`,
  label = "staff roster",
  accent = { callsign: "text-primary-400", position: "text-brand-300" },
} = {}) {
  const { hasPermission } = useAuth();
  const canEditStatus = hasPermission("roster.edit_status");

  const [roster, setRoster] = useState(null);
  const [activity, setActivity] = useState({});
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  // loading | ready | empty | error. Starts as error when there is no bot API to
  // call at all, so the effect never has to set that synchronously.
  const [state, setState] = useState(botConfigured ? "loading" : "error");
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  // The activity overlay lives on this site, keyed by Discord id. Loaded beside
  // the bot roster and merged in below; failure just leaves everyone Active.
  useEffect(() => {
    let active = true;
    api
      .staffActivity()
      .then((map) => active && setActivity(map ?? {}))
      .catch(() => active && setActivity({}));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!botConfigured) return undefined;
    let active = true;

    setState("loading");
    botApi("/rosters")
      .then((result) => {
        if (!active) return;
        const rosters = result?.rosters ?? [];
        // The roster whose slug (or name) this page asks for; for the staff
        // roster we fall back to the first published one so a single-roster
        // community just works, but a specific ask (the dev team) does not fall
        // back to somebody else's roster.
        const picked =
          rosters.find((r) => slugs.includes(r.slug) || (nameMatch && nameMatch.test(r.name ?? ""))) ??
          (fallbackToFirst ? rosters[0] : null) ??
          null;
        setRoster(picked);
        setState(picked ? "ready" : "empty");
      })
      .catch(() => active && setState("error"));

    return () => {
      active = false;
    };
    // The pick criteria are fixed for a page's lifetime; adding the inline
    // slugs/nameMatch props would refetch on every render for no gain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // The bound Discord role's colour, falling back to a cycled palette only
        // when the role has none set — used for the band and the rank name.
        const color = rank.color || RANK_COLORS[index % RANK_COLORS.length];
        // Each row carries the rank it sits under, so the Position column reads the
        // same for a filled seat and a vacant one, plus the site's activity overlay
        // for a filled seat (Active until somebody says otherwise).
        let rows = rowsForRank(rank).map((row) => {
          const a = row.vacant ? {} : activity[row.discordId] ?? {};
          return {
            ...row,
            position: rank.name,
            positionColor: color,
            status: row.vacant ? null : a.status ?? "Active",
            loaUntil: a.loaUntil ?? null,
            loaReason: a.loaReason ?? null,
            probationUntil: a.probationUntil ?? null,
            lastMove: a.lastMove ?? null,
          };
        });
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
          // Just the rank name — the short name is redundant on the roster.
          label: rank.name,
          color,
          rows,
        };
      })
      .filter((group) => group.rows.length > 0);
  }, [ranks, query, activity]);

  const columns = [
    {
      key: "callsign",
      label: "Callsign",
      width: "w-24",
      render: (row) => (
        <span className={row.vacant ? "text-slate-500" : cn("font-bold", accent.callsign)}>
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
          <p
            className="truncate text-sm font-semibold"
            style={{ color: row.vacant ? "#64748b" : row.positionColor || undefined }}
          >
            {row.position}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (row.vacant ? <span className="text-slate-600">—</span> : <StatusChip status={row.status} />),
    },
    {
      key: "loa",
      label: "LOA",
      hideBelow: "lg",
      render: (row) =>
        row.vacant ? (
          <span className="text-slate-600">—</span>
        ) : row.status === "LOA" && row.loaUntil ? (
          <span className="whitespace-nowrap text-amber-300" title={row.loaReason || undefined}>
            until {formatDate(row.loaUntil)}
          </span>
        ) : (
          <span className="text-slate-600">—</span>
        ),
    },
    {
      key: "probation",
      label: "Probation ends",
      hideBelow: "xl",
      render: (row) =>
        !row.vacant && row.probationUntil ? (
          <span className="whitespace-nowrap text-slate-300">{formatDate(row.probationUntil)}</span>
        ) : (
          <span className="text-slate-600">—</span>
        ),
    },
    {
      key: "lastMove",
      label: "Last move",
      hideBelow: "xl",
      render: (row) =>
        !row.vacant && row.lastMove ? (
          <span className="whitespace-nowrap text-slate-400">{formatDate(row.lastMove)}</span>
        ) : (
          <span className="text-slate-600">—</span>
        ),
    },
    {
      key: "discordId",
      label: "Discord UID",
      hideBelow: "2xl",
      render: (row) =>
        row.discordId ? (
          <code className="text-[11px] text-slate-500">{row.discordId}</code>
        ) : (
          <span className="text-slate-600">—</span>
        ),
    },
    ...(canEditStatus
      ? [
          {
            key: "edit",
            label: "",
            align: "right",
            render: (row) =>
              row.vacant ? null : (
                <button
                  type="button"
                  onClick={() => setEditing(row)}
                  aria-label={`Edit ${row.name}'s activity`}
                  className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <Pencil className="size-4" />
                </button>
              ),
          },
        ]
      : []),
  ];

  return (
    <>
      <RosterHeader
        mark={<Logo size="size-10" />}
        title={title}
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

      {notice && (
        <Card className="mb-5 p-4">
          <p className="text-sm font-semibold text-amber-300">{notice}</p>
        </Card>
      )}

      {state === "error" && (
        <Card className="mb-5 flex items-start gap-3 p-5">
          <Info className="mt-0.5 size-5 shrink-0 text-amber-400" />
          <p className="text-sm leading-relaxed text-slate-300">
            The {label} is served by the bot, and its connection is not configured
            here yet. Once the bot dashboard is reachable, whoever holds a rank in Discord
            appears on this page automatically.
          </p>
        </Card>
      )}

      {state === "empty" && (
        <Card className="mb-5 flex items-start gap-3 p-5">
          <Info className="mt-0.5 size-5 shrink-0 text-slate-500" />
          <p className="text-sm leading-relaxed text-slate-300">
            No {label} is published from the bot yet. Create it in the bot dashboard and
            bind each rank to a Discord role — its holders show up here after the next sync.
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

      {editing && (
        <ActivityEditor
          key={editing.discordId}
          member={editing}
          canManageLoa={hasPermission("roster.manage_loa")}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setNotice(message ?? "");
            reload();
          }}
        />
      )}
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

/** The activity status as a coloured pill, tinted by the status's own colour. */
function StatusChip({ status }) {
  const color = statusColor(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {status}
    </span>
  );
}

const STATUS_OPTIONS = ACTIVITY_STATUSES.map((s) => ({ value: s.id, label: s.label }));
const NEEDS_LOA_DATE = new Set(ACTIVITY_STATUSES.filter((s) => s.requiresDate).map((s) => s.id));

/**
 * Edits one member's activity overlay — status, and the dates a Discord role
 * cannot carry: an LOA return, a probation end, and when they last moved rank.
 * The overlay is stored on this site keyed by Discord id, so it rides alongside
 * the bot's roster without the bot needing to know about it.
 */
function ActivityEditor({ member, canManageLoa, onClose, onSaved }) {
  const [status, setStatus] = useState(member.status ?? "Active");
  const [loaUntil, setLoaUntil] = useState(member.loaUntil ?? "");
  const [loaReason, setLoaReason] = useState(member.loaReason ?? "");
  const [probationUntil, setProbationUntil] = useState(member.probationUntil ?? "");
  const [lastMove, setLastMove] = useState(member.lastMove ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const needsLoa = NEEDS_LOA_DATE.has(status);
  const loaBlocked = needsLoa && !canManageLoa;

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (needsLoa && !loaUntil) {
      setError("An LOA needs a return date.");
      return;
    }
    setSaving(true);
    try {
      const result = await api.updateStaffActivity(member.discordId, {
        status,
        loaUntil: needsLoa ? loaUntil : null,
        loaReason: needsLoa ? loaReason : "",
        probationUntil: probationUntil || null,
        lastMove: lastMove || null,
      });
      if (result?.ok === false) {
        setError(result.message ?? result.errors?.[0] ?? "That was not saved.");
        setSaving(false);
        return;
      }
      onSaved(result?.message ?? "");
    } catch (err) {
      setError(err?.message ?? "That was not saved.");
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={member.name} subtitle={`Callsign ${member.callsign || "—"}`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Activity status" htmlFor="a-status">
          <Select id="a-status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </Field>

        {needsLoa && (
          <>
            <Field
              label="LOA return date"
              htmlFor="a-loa"
              hint={loaBlocked ? "Putting someone on leave needs the roster.manage_loa permission." : undefined}
            >
              <TextInput
                id="a-loa"
                type="date"
                value={loaUntil}
                disabled={loaBlocked}
                onChange={(e) => setLoaUntil(e.target.value)}
              />
            </Field>
            <Field label="LOA reason" htmlFor="a-loa-reason" hint="Optional.">
              <TextInput
                id="a-loa-reason"
                value={loaReason}
                disabled={loaBlocked}
                onChange={(e) => setLoaReason(e.target.value)}
              />
            </Field>
          </>
        )}

        <Field label="Probation ends" htmlFor="a-prob" hint="Leave empty if they are not on probation.">
          <TextInput
            id="a-prob"
            type="date"
            value={probationUntil}
            onChange={(e) => setProbationUntil(e.target.value)}
          />
        </Field>

        <Field label="Last move" htmlFor="a-move" hint="When their rank last changed.">
          <TextInput
            id="a-move"
            type="date"
            value={lastMove}
            onChange={(e) => setLastMove(e.target.value)}
          />
        </Field>

        {error && <p className="text-sm text-rose-300">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving || loaBlocked}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
