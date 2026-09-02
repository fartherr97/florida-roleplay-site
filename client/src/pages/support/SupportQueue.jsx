import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  Flame,
  Hourglass,
  Inbox,
  RefreshCw,
  Search,
  Ticket as TicketIcon,
  UserPlus,
  Workflow,
} from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { TextInput } from "../../components/ui/TextInput";
import AccessDenied from "../../components/auth/AccessDenied";
import ReassignDialog from "../../components/support/ReassignDialog";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { useSupportConfig } from "../../context/useSupportConfig";
import { iconFor } from "../../lib/icons";
import { cn } from "../../lib/cn";
import { relativeTime } from "../../lib/format";
import {
  OPEN_STATUSES,
  PRIORITIES,
  PRIORITY_MAP,
  statusLabel,
  statusTone,
  ticketAge,
} from "../../lib/support";

/** Department categories carry their emblem rather than a lucide glyph. */
const DEPT_LOGOS = {
  dept_fhp: "https://www.flrp.us/images/480f8f75e967b7e4.png",
  dept_bso: "https://www.flrp.us/images/c45e2a2852eba7fb.png",
  dept_mpd: "https://www.flrp.us/images/72517584c4a23ba3.png",
};

/** The colour behind an age tier — the left rail on each card, and the tab dot. */
const ACCENT = {
  stale: "bg-rose-500",
  aging: "bg-amber-500",
  recent: "bg-brand-500",
  fresh: "bg-emerald-500",
};

const PRIORITY_ORDER = Object.fromEntries(PRIORITIES.map((p, i) => [p.id, PRIORITIES.length - i]));

const TABS = [
  { id: "all", label: "All" },
  { id: "stale", label: "Stale" },
  { id: "aging", label: "Aging" },
  { id: "recent", label: "Recent" },
  { id: "fresh", label: "Fresh" },
  { id: "mine", label: "My assigned" },
  { id: "archived", label: "Archived" },
];
const TAB_IDS = new Set(TABS.map((t) => t.id));

/** How recently a ticket has to have moved to count as "new activity". */
const NEW_ACTIVITY_MS = 60 * 60 * 1000;

/**
 * The support queues.
 *
 * A flat list of everything open is a list you have to read before you can use.
 * This is the triage board instead: tickets grouped into the queues they belong
 * to, each one badged with how long it has been going cold, so the answer to
 * "what needs me" is the top of the reddest group rather than a scan of the lot.
 */
export default function SupportQueue() {
  const { user, hasPermission } = useAuth();
  const { types } = useSupportConfig();

  const [data, setData] = useState(null);
  // The tab lives in the URL so the portal drawer can deep-link straight to "My
  // assigned" or "Archived", and a shared link lands on the same view.
  const [params, setParams] = useSearchParams();
  const tab = TAB_IDS.has(params.get("tab")) ? params.get("tab") : "all";
  const setTab = (id) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === "all") next.delete("tab");
        else next.set("tab", id);
        return next;
      },
      { replace: true },
    );
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [reassigning, setReassigning] = useState(null);
  // A minute clock so ages tick forward while the board is open, without a reload.
  const [now, setNow] = useState(() => Date.now());

  // Refresh in place — the current board stays on screen while the new data
  // lands, rather than dropping back to the loading skeleton.
  const load = useCallback(
    () =>
      api
        .supportTickets()
        .then((result) => setData(result))
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    let active = true;
    api
      .supportTickets()
      .then((result) => active && setData(result))
      .catch(() => active && setData({ tickets: [], agent: false }));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const tickets = useMemo(() => data?.tickets ?? [], [data]);
  const lead = data?.lead ?? false;

  // The board only ever leads with what is live; the closed and resolved sit
  // behind the Archived tab so a busy queue is not padded with finished work.
  const active = useMemo(() => tickets.filter((t) => OPEN_STATUSES.includes(t.status)), [tickets]);
  const archived = useMemo(() => tickets.filter((t) => !OPEN_STATUSES.includes(t.status)), [tickets]);

  const stats = useMemo(() => {
    let stale = 0;
    let aging = 0;
    let fresh = 0;
    for (const ticket of active) {
      const age = ticketAge(ticket, now).key;
      if (age === "stale") stale += 1;
      else if (age === "aging") aging += 1;
    }
    for (const ticket of active) {
      const stamp = ticket.lastMessageAt ?? ticket.createdAt;
      if (stamp && now - new Date(stamp).getTime() <= NEW_ACTIVITY_MS) fresh += 1;
    }
    return { total: active.length, stale, aging, fresh };
  }, [active, now]);

  const tabCounts = useMemo(() => {
    const byAge = { stale: 0, aging: 0, recent: 0, fresh: 0 };
    for (const ticket of active) byAge[ticketAge(ticket, now).key] += 1;
    return {
      all: active.length,
      ...byAge,
      mine: active.filter((t) => t.assignedToDiscordId === user?.id).length,
      archived: archived.length,
    };
  }, [active, archived, now, user]);

  // The set the current tab is looking at, then the search, then grouped into
  // queues in the configured category order.
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = tab === "archived" ? archived : active;
    const matches = pool.filter((ticket) => {
      if (["stale", "aging", "recent", "fresh"].includes(tab) && ticketAge(ticket, now).key !== tab) {
        return false;
      }
      if (tab === "mine" && ticket.assignedToDiscordId !== user?.id) return false;
      if (!needle) return true;
      return [ticket.subject, ticket.id, ticket.openedByName, ticket.assignedToName]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    const byType = new Map();
    for (const ticket of matches) {
      if (!byType.has(ticket.type)) byType.set(ticket.type, []);
      byType.get(ticket.type).push(ticket);
    }

    const order = [...types.map((t) => t.id), ...byType.keys()];
    const seen = new Set();
    const out = [];
    for (const id of order) {
      if (seen.has(id) || !byType.has(id)) continue;
      seen.add(id);
      const type = types.find((t) => t.id === id);
      const list = byType.get(id).sort(
        (a, b) =>
          (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0) ||
          new Date(a.lastMessageAt ?? a.createdAt) - new Date(b.lastMessageAt ?? b.createdAt),
      );
      out.push({ id, type, label: type?.label ?? id, icon: type?.icon ?? "LifeBuoy", tickets: list });
    }
    return out;
  }, [active, archived, tab, query, now, types, user]);

  const applyPatch = useCallback((id, patched) => {
    setData((prev) =>
      prev ? { ...prev, tickets: prev.tickets.map((t) => (t.id === id ? { ...t, ...patched } : t)) } : prev,
    );
  }, []);

  if (!hasPermission("support.work") && !hasPermission("support.escalated")) {
    return <AccessDenied reason="role" />;
  }

  const toggleGroup = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Section className="max-w-6xl">
      <PageHeader
        eyebrow="Support"
        title="Support queues"
        subtitle={`${groups.length || types.length} ${(groups.length || types.length) === 1 ? "queue" : "queues"} · ${stats.total} active ${stats.total === 1 ? "ticket" : "tickets"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => load()}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set())}>
              Expand all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set(groups.map((g) => g.id)))}>
              Collapse all
            </Button>
            <Button as={Link} to="/support" variant="ghost" size="sm">
              <Inbox className="size-4" />
              My tickets
            </Button>
            {hasPermission("support.manage") && (
              <Button as={Link} to="/support/flows" variant="secondary" size="sm">
                <Workflow className="size-4" />
                Response flows
              </Button>
            )}
          </div>
        }
      />

      {/* The board's pulse: totals, and the two buckets going cold. */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TicketIcon} tone="brand" label="Total tickets" value={stats.total} />
        <StatCard icon={Flame} tone="rose" label="Stale · 72h+" value={stats.stale} />
        <StatCard icon={Hourglass} tone="amber" label="Aging · 24h+" value={stats.aging} />
        <StatCard icon={Bell} tone="green" label="New activity" value={stats.fresh} />
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tickets by title, ID, or name…"
          aria-label="Search tickets"
          style={{ paddingLeft: "2.5rem" }}
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <FilterTab
            key={t.id}
            active={tab === t.id}
            onClick={() => setTab(t.id)}
            label={t.label}
            count={tabCounts[t.id] ?? 0}
            dot={ACCENT[t.id]}
          />
        ))}
      </div>

      {data === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-28 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-sm font-semibold text-white">
            {tab === "all" ? "The queues are clear." : "Nothing matches that."}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
            {tab === "all"
              ? "Every live ticket has been dealt with."
              : "Try another tab or clear the search."}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <QueueGroup
              key={group.id}
              group={group}
              collapsed={collapsed.has(group.id)}
              onToggle={() => toggleGroup(group.id)}
              now={now}
              meId={user?.id}
              lead={lead}
              onTake={async (ticket) => {
                const result = await api.updateSupportTicket(ticket.id, { assign: "me" });
                if (result?.ok) applyPatch(ticket.id, result.ticket);
              }}
              onReassign={setReassigning}
            />
          ))}
        </div>
      )}

      <ReassignDialog
        key={reassigning?.id ?? "none"}
        open={Boolean(reassigning)}
        onClose={() => setReassigning(null)}
        onConfirm={async (discordId, name) => {
          const result = await api.updateSupportTicket(reassigning.id, { assign: { discordId, name } });
          if (result?.ok) {
            applyPatch(reassigning.id, result.ticket);
            setReassigning(null);
          }
          return result;
        }}
      />
    </Section>
  );
}

/* ------------------------------------------------------------------ *
 * Pieces
 * ------------------------------------------------------------------ */

function StatCard({ icon, tone, label, value }) {
  const tint = {
    brand: "text-brand-300",
    rose: "text-rose-300",
    amber: "text-amber-300",
    green: "text-emerald-300",
  }[tone];
  const ring = {
    brand: "bg-brand-500/10 ring-brand-400/20",
    rose: "bg-rose-500/10 ring-rose-400/20",
    amber: "bg-amber-500/10 ring-amber-400/20",
    green: "bg-emerald-500/10 ring-emerald-400/20",
  }[tone];
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset", ring, tint)}>
        {createElement(icon, { className: "size-5" })}
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-black tabular-nums leading-none text-white">{value}</p>
        <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

function FilterTab({ active, onClick, label, count, dot }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold ring-1 ring-inset transition",
        active
          ? "bg-brand-500/15 text-white ring-brand-400/40"
          : "bg-black/20 text-slate-400 ring-white/[0.06] hover:text-white hover:ring-white/15",
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dot)} />}
      {label}
      <span className="tabular-nums text-slate-500">{count}</span>
    </button>
  );
}

function QueueGroup({ group, collapsed, onToggle, now, meId, lead, onTake, onReassign }) {
  const logo = DEPT_LOGOS[group.id];
  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/[0.03]"
      >
        {logo ? (
          <img src={logo} alt="" className="size-9 shrink-0 rounded-lg object-contain ring-1 ring-inset ring-white/[0.06]" />
        ) : (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-slate-300 ring-1 ring-inset ring-white/[0.06]">
            {createElement(iconFor(group.icon), { className: "size-5" })}
          </span>
        )}
        <span className="min-w-0 flex-1 text-sm font-bold text-white">{group.label}</span>
        <Badge tone="slate">{group.tickets.length}</Badge>
        <ChevronDown className={cn("size-5 shrink-0 text-slate-400 transition-transform", collapsed && "-rotate-90")} />
      </button>

      {!collapsed && (
        <div className="space-y-2.5 border-t border-white/[0.06] p-4">
          {group.tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              now={now}
              meId={meId}
              lead={lead}
              onTake={onTake}
              onReassign={onReassign}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function TicketCard({ ticket, now, meId, lead, onTake, onReassign }) {
  const age = ticketAge(ticket, now);
  const mine = ticket.assignedToDiscordId === meId;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-black/20 pl-4 ring-1 ring-inset ring-white/[0.06]">
      <span className={cn("absolute inset-y-0 left-0 w-1.5", ACCENT[age.key])} aria-hidden />
      <div className="flex flex-wrap items-start gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-xs text-slate-500">#{ticket.id}</code>
            <Badge tone={statusTone(ticket.status)}>{statusLabel(ticket.status)}</Badge>
            <Badge tone={age.tone}>{age.label}</Badge>
            {ticket.priority && ticket.priority !== "normal" && (
              <Badge tone={PRIORITY_MAP[ticket.priority]?.tone}>{PRIORITY_MAP[ticket.priority]?.label}</Badge>
            )}
          </div>
          <p className="mt-1.5 truncate text-sm font-bold text-white">{ticket.subject}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
            <span className={mine ? "text-brand-300" : "text-slate-400"}>
              {ticket.assignedToName ? `Assigned: ${ticket.assignedToName}` : "Unassigned"}
            </span>
            <span>·</span>
            <span>Opened by {ticket.openedByName}</span>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
            <span>Updated {relativeTime(ticket.lastMessageAt ?? ticket.createdAt, now)}</span>
            <span>·</span>
            <span>Opened {relativeTime(ticket.createdAt, now)}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {lead ? (
            <Button size="sm" variant="ghost" onClick={() => onReassign(ticket)}>
              <UserPlus className="size-4" />
              Reassign
            </Button>
          ) : (
            !mine && (
              <Button size="sm" variant="ghost" onClick={() => onTake(ticket)}>
                <UserPlus className="size-4" />
                Take it
              </Button>
            )
          )}
          <Button as={Link} to={`/support/${ticket.id}`} size="sm" variant="secondary">
            Open
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

