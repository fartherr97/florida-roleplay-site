import { createElement, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Car, LifeBuoy, MessageSquare, Plus, Wrench } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import AccessDenied from "../../components/auth/AccessDenied";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { iconFor } from "../../lib/icons";
import { toneTile } from "../../lib/tones";
import { cn } from "../../lib/cn";
import { relativeTime } from "../../lib/format";
import { DEFAULT_REQUEST_TYPES, devStatusLabel, devStatusTone } from "../../lib/devhub";
import { LATEST_DEV_LOG } from "../../data/devHubData";

/**
 * The Development Hub landing.
 *
 * The one thing a member comes here to do is open a request, so the categories
 * are the page. Quick actions and their own open requests sit around them so the
 * page answers "start something" and "where did mine get to" at once.
 */
export default function DevHome() {
  const { user, hasPermission, loading } = useAuth();
  const [types, setTypes] = useState(DEFAULT_REQUEST_TYPES);
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    api.devRequestTypes().then((r) => active && r?.types?.length && setTypes(r.types)).catch(() => {});
    api.devRequests("mine").then((r) => active && setData(r)).catch(() => active && setData({ requests: [] }));
    return () => {
      active = false;
    };
  }, []);

  const open = useMemo(() => {
    const list = data?.requests ?? [];
    return list.filter((r) => r.status !== "closed" && r.status !== "completed" && r.status !== "denied");
  }, [data]);

  if (loading) return null;
  if (!user) return <AccessDenied reason="signed-out" />;

  const openable = types.filter((t) => t.enabled !== false && (!t.openPermission || hasPermission(t.openPermission)));

  return (
    <Section className="max-w-6xl">
      <PageHeader
        eyebrow="Development"
        title="Development Hub"
        subtitle="Request a personal vehicle, department work, a livery or a build — the dev team works it from here."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button as={Link} to="/development/library" variant="ghost" size="sm">
              <Car className="size-4" />
              Vehicle library
            </Button>
            <Button as={Link} to="/development/new" size="sm">
              <Plus className="size-4" />
              Create request
            </Button>
          </div>
        }
      />

      {/* Latest dev log + quick actions. */}
      <div className="mb-8 grid gap-3 md:grid-cols-3">
        <Card className="flex flex-col justify-between gap-3 p-5 md:col-span-2">
          <div>
            <Badge tone="violet">{LATEST_DEV_LOG.tag}</Badge>
            <p className="mt-3 text-lg font-bold text-white">{LATEST_DEV_LOG.title}</p>
          </div>
        </Card>
        <div className="grid gap-3">
          <QuickAction to="/development/help" icon={LifeBuoy} label="Help Center" tone="brand" />
          <QuickAction to="/development/feedback" icon={MessageSquare} label="Suggestions & bugs" tone="violet" />
        </div>
      </div>

      {/* Categories — the request picker. */}
      <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">What do you need?</h2>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {openable.map((type) => (
          <Card
            key={type.id}
            as={Link}
            to={`/development/new?type=${encodeURIComponent(type.id)}`}
            hover
            className="group flex h-full flex-col gap-3 p-5"
          >
            <div className="flex items-center gap-3">
              <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset", toneTile(type.tone))}>
                {createElement(iconFor(type.icon, Wrench), { className: "size-5" })}
              </span>
              <span className="min-w-0 flex-1 text-sm font-bold text-white">{type.label}</span>
              <ArrowRight className="size-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-violet-400" />
            </div>
            <p className="text-xs leading-relaxed text-slate-400">{type.blurb}</p>
          </Card>
        ))}
      </div>

      {/* Their own requests. */}
      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400">Your requests</h2>
          {open.length > 0 && <Badge tone="violet">{open.length} open</Badge>}
        </div>
        {data === null ? (
          <div className="space-y-3">{[0, 1].map((n) => <div key={n} className="h-16 animate-pulse rounded-2xl bg-white/[0.03]" />)}</div>
        ) : (data.requests ?? []).length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-slate-400">Nothing open yet. Pick a category above to start a request.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.requests.map((request) => (
              <DevRequestRow key={request.id} request={request} typeMap={Object.fromEntries(types.map((t) => [t.id, t]))} />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

function QuickAction({ to, icon, label, tone }) {
  return (
    <Card as={Link} to={to} hover className="flex items-center gap-3 p-4">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset", toneTile(tone))}>
        {createElement(icon, { className: "size-5" })}
      </span>
      <span className="text-sm font-semibold text-white">{label}</span>
      <ArrowRight className="ml-auto size-4 text-slate-500" />
    </Card>
  );
}

export function DevRequestRow({ request, typeMap }) {
  const type = typeMap?.[request.type];
  return (
    <Card as={Link} to={`/development/requests/${request.id}`} hover className="flex flex-wrap items-center gap-4 p-5">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset", toneTile(type?.tone ?? "violet"))}>
        {createElement(iconFor(type?.icon ?? "Wrench"), { className: "size-5" })}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
          {request.subject}
          <Badge tone={devStatusTone(request.status)}>{devStatusLabel(request.status)}</Badge>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{type?.label ?? request.type}</span>
          <span>·</span>
          <code>{request.id}</code>
          {request.department && (
            <>
              <span>·</span>
              <span>{request.department}</span>
            </>
          )}
          <span>·</span>
          <span>{relativeTime(request.lastMessageAt ?? request.createdAt)}</span>
        </p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-slate-500" />
    </Card>
  );
}
