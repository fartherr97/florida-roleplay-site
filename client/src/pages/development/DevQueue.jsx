import { createElement, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Inbox, MessageSquare, Search, UserPlus, Wrench } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { TextInput } from "../../components/ui/TextInput";
import AccessDenied from "../../components/auth/AccessDenied";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { iconFor } from "../../lib/icons";
import { toneTile } from "../../lib/tones";
import { cn } from "../../lib/cn";
import { formatDateTimeLocal, relativeTime } from "../../lib/format";
import {
  DEFAULT_REQUEST_TYPES,
  DEV_PRIORITY_MAP,
  FEEDBACK_TYPE_MAP,
  OPEN_DEV_STATUSES,
  devStatusLabel,
  devStatusTone,
  requestTypeMapOf,
} from "../../lib/devhub";

const TABS = [
  { id: "open", label: "Open" },
  { id: "pending", label: "Pending" },
  { id: "in_progress", label: "In progress" },
  { id: "mine", label: "Mine" },
  { id: "all", label: "All" },
  { id: "feedback", label: "Feedback" },
];

/** The dev team's queue — every request, filtered and claimable. */
export default function DevQueue() {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [tab, setTab] = useState("open");
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState(DEFAULT_REQUEST_TYPES);

  useEffect(() => {
    let active = true;
    api.devRequests().then((r) => active && setData(r)).catch(() => active && setData({ requests: [] }));
    api.devRequestTypes().then((r) => active && r?.types?.length && setTypes(r.types)).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // The feedback inbox loads the first time it is opened, not on mount.
  useEffect(() => {
    if (tab !== "feedback" || feedback !== null) return undefined;
    let active = true;
    api.devFeedback().then((r) => active && setFeedback(r?.feedback ?? [])).catch(() => active && setFeedback([]));
    return () => {
      active = false;
    };
  }, [tab, feedback]);

  const typeMap = useMemo(() => requestTypeMapOf(types), [types]);
  const requests = useMemo(() => data?.requests ?? [], [data]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return requests.filter((r) => {
      if (tab === "open" && !OPEN_DEV_STATUSES.includes(r.status)) return false;
      if (tab === "pending" && r.status !== "pending") return false;
      if (tab === "in_progress" && r.status !== "in_progress") return false;
      if (tab === "mine" && r.assignedToDiscordId !== user?.id) return false;
      if (!needle) return true;
      return [r.subject, r.id, r.openedByName, r.assignedToName, r.department].join(" ").toLowerCase().includes(needle);
    });
  }, [requests, tab, query, user]);

  const counts = useMemo(
    () => ({
      open: requests.filter((r) => OPEN_DEV_STATUSES.includes(r.status)).length,
      pending: requests.filter((r) => r.status === "pending").length,
      in_progress: requests.filter((r) => r.status === "in_progress").length,
      mine: requests.filter((r) => r.assignedToDiscordId === user?.id).length,
      all: requests.length,
      feedback: feedback?.length ?? 0,
    }),
    [requests, user, feedback],
  );

  const shownFeedback = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = feedback ?? [];
    if (!needle) return list;
    return list.filter((f) => `${f.title} ${f.body} ${f.openedByName ?? ""}`.toLowerCase().includes(needle));
  }, [feedback, query]);

  if (!hasPermission("development.work")) return <AccessDenied reason="role" />;

  const take = async (request) => {
    const result = await api.updateDevRequest(request.id, { assign: "me" });
    if (result?.ok) {
      setData((prev) => (prev ? { ...prev, requests: prev.requests.map((r) => (r.id === request.id ? result.request : r)) } : prev));
    }
  };

  return (
    <Section className="max-w-5xl">
      <PageHeader
        eyebrow="Development"
        title="Dev queue"
        subtitle="Every request members have opened. Pending first — take one to work it."
        actions={
          <Button as={Link} to="/development" variant="ghost" size="sm">
            <Inbox className="size-4" />
            The hub
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold ring-1 ring-inset transition",
              tab === t.id ? "bg-violet-500/15 text-white ring-violet-400/40" : "bg-black/20 text-slate-400 ring-white/[0.06] hover:text-white",
            )}
          >
            {t.label}
            <span className="tabular-nums text-slate-500">{counts[t.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subject, ID, member or department…"
          aria-label="Search requests"
          style={{ paddingLeft: "2.5rem" }}
        />
      </div>

      {tab === "feedback" ? (
        feedback === null ? (
          <div className="space-y-3">{[0, 1, 2].map((n) => <div key={n} className="h-20 animate-pulse rounded-2xl bg-white/[0.03]" />)}</div>
        ) : shownFeedback.length === 0 ? (
          <Card className="p-12 text-center">
            <MessageSquare className="mx-auto size-6 text-slate-500" />
            <p className="mt-2 text-sm font-semibold text-white">No feedback yet.</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">Suggestions and bug reports members send appear here.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {shownFeedback.map((item) => {
              const ft = FEEDBACK_TYPE_MAP[item.type];
              return (
                <Card key={item.id} className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={ft?.tone ?? "slate"}>{ft?.label ?? item.type}</Badge>
                    <p className="text-sm font-bold text-white">{item.title}</p>
                    <span className="ml-auto text-xs text-slate-500">{formatDateTimeLocal(item.createdAt)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-300">{item.body}</p>
                  {item.openedByName && <p className="mt-2 text-xs text-slate-500">— {item.openedByName}</p>}
                </Card>
              );
            })}
          </div>
        )
      ) : data === null ? (
        <div className="space-y-3">{[0, 1, 2].map((n) => <div key={n} className="h-20 animate-pulse rounded-2xl bg-white/[0.03]" />)}</div>
      ) : shown.length === 0 ? (
        <Card className="p-12 text-center">
          <Wrench className="mx-auto size-6 text-slate-500" />
          <p className="mt-2 text-sm font-semibold text-white">Nothing here.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">Nothing matches this filter right now.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((request) => {
            const type = typeMap[request.type];
            const mine = request.assignedToDiscordId === user?.id;
            return (
              <Card key={request.id} className="flex flex-wrap items-center gap-4 p-5">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset", toneTile(type?.tone ?? "violet"))}>
                  {createElement(iconFor(type?.icon ?? "Wrench"), { className: "size-5" })}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                    {request.subject}
                    <Badge tone={devStatusTone(request.status)}>{devStatusLabel(request.status)}</Badge>
                    {request.priority && request.priority !== "normal" && (
                      <Badge tone={DEV_PRIORITY_MAP[request.priority]?.tone}>{DEV_PRIORITY_MAP[request.priority]?.label}</Badge>
                    )}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <code>{request.id}</code>
                    <span>·</span>
                    <span>{request.openedByName}</span>
                    {request.department && (
                      <>
                        <span>·</span>
                        <span>{request.department}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{relativeTime(request.lastMessageAt ?? request.createdAt)}</span>
                    {request.assignedToName && (
                      <>
                        <span>·</span>
                        <span className="text-violet-300">{mine ? "You" : request.assignedToName}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!mine && (
                    <Button size="sm" variant="ghost" onClick={() => take(request)}>
                      <UserPlus className="size-4" />
                      Take it
                    </Button>
                  )}
                  <Button as={Link} to={`/development/requests/${request.id}`} size="sm" variant="secondary">
                    Open
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Section>
  );
}
