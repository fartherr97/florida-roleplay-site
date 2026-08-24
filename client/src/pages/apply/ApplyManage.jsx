import { createElement, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Inbox, Plus, Settings2 } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import AccessDenied from "../../components/auth/AccessDenied";
import { api } from "../../lib/api";
import { iconFor } from "../../lib/icons";
import { formatDateTime } from "../../lib/format";
import { useAuth } from "../../context/useAuth";
import { DEPARTMENTS } from "../../data/rosterData";
import { subdivisionLabel } from "../../data/applicationSeed";
import { canManageApplications, submissionTone } from "../../lib/applicationConfig";

const STATUS_FILTERS = [
  { id: "pending", label: "Waiting" },
  { id: "approved", label: "Approved" },
  { id: "denied", label: "Denied" },
];

/**
 * Command staff's side of the application system: the forms they own, and the
 * submissions those forms brought in.
 *
 * The queue leads rather than the builder, because building an application is
 * something you do once and reviewing them is something you do every day.
 */
export default function ApplyManage() {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState(null);
  const [queue, setQueue] = useState({ key: null, rows: [] });
  const [filter, setFilter] = useState("pending");

  const ctx = useMemo(
    () => ({
      roleKeys: user?.roles ?? [],
      permissions: new Set(hasPermission("applications.manage") ? ["applications.manage"] : []),
    }),
    [user, hasPermission],
  );

  const myDepartments = useMemo(
    () => DEPARTMENTS.filter((d) => canManageApplications(d.id, ctx)),
    [ctx],
  );

  useEffect(() => {
    let active = true;
    api.manageableApplications().then((result) => active && setData(result));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    api
      .applicationQueue(filter)
      .then((result) => active && setQueue({ key: filter, rows: result.submissions ?? [] }))
      .catch(() => active && setQueue({ key: filter, rows: [] }));
    return () => {
      active = false;
    };
  }, [filter]);

  if (myDepartments.length === 0 && !hasPermission("applications.review")) {
    return <AccessDenied reason="role" />;
  }

  const applications = data?.applications ?? [];
  const loadingQueue = queue.key !== filter;

  return (
    <Section className="max-w-5xl">
      <PageHeader
        eyebrow="Applications"
        title="Manage applications"
        subtitle={
          myDepartments.length
            ? `You build and decide for ${myDepartments.map((d) => d.abbr).join(", ")}.`
            : "You review submissions across every department."
        }
        actions={
          myDepartments.length > 0 ? (
            <Button as={Link} to="/apply/manage/new" size="sm">
              <Plus className="size-4" />
              New application
            </Button>
          ) : null
        }
      />

      {/* The queue. */}
      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
            <Inbox className="size-4" />
            Submissions
          </h2>
          <div className="flex gap-2">
            {STATUS_FILTERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setFilter(entry.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
                  filter === entry.id
                    ? "bg-brand-500/15 text-white ring-brand-400/40"
                    : "bg-black/20 text-slate-400 ring-white/[0.06] hover:text-white"
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        {loadingQueue ? (
          <div className="space-y-3">
            {[0, 1].map((n) => (
              <div key={n} className="h-20 animate-pulse rounded-2xl bg-white/[0.03]" />
            ))}
          </div>
        ) : queue.rows.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm font-semibold text-white">
              {filter === "pending" ? "Nothing waiting." : `No ${filter} submissions.`}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {filter === "pending"
                ? "Every application that comes in also lands in Discord, so this queue and that channel say the same thing."
                : "They will show up here once decisions start being made."}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {queue.rows.map((row) => (
              <Card
                key={row.reference}
                as={Link}
                to={`/apply/manage/submissions/${row.reference}`}
                hover
                className="flex flex-wrap items-center gap-4 p-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                    {row.applicantName || "Unnamed applicant"}
                    <Badge tone={submissionTone(row.status)}>{row.status}</Badge>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{row.applicationSlug}</span>
                    <span>·</span>
                    <code>{row.reference}</code>
                    <span>·</span>
                    <span>{formatDateTime(row.submittedAt)}</span>
                    {row.decidedVia && <span className="text-slate-400">· decided in {row.decidedVia}</span>}
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-slate-500" />
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* The forms themselves. */}
      {myDepartments.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
            <Settings2 className="size-4" />
            Your applications
          </h2>

          {data === null ? (
            <div className="h-24 animate-pulse rounded-2xl bg-white/[0.03]" />
          ) : applications.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm font-semibold text-white">You have not built one yet.</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
                An application is a set of questions plus the Discord channel it is
                posted to and the roles that may approve it.
              </p>
              <Button as={Link} to="/apply/manage/new" size="sm" className="mt-5">
                <Plus className="size-4" />
                Build one
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <Card
                  key={app.id}
                  as={Link}
                  to={`/apply/manage/${app.id}`}
                  hover
                  className="flex flex-wrap items-center gap-4 p-5"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-slate-300 ring-1 ring-inset ring-white/[0.06]">
                    {createElement(iconFor(app.icon), { className: "size-5" })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                      {app.title}
                      <Badge tone={app.status === "open" ? "green" : app.status === "closed" ? "rose" : "slate"}>
                        {app.status}
                      </Badge>
                      {!app.discord?.channelId && <Badge tone="amber">No channel</Badge>}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      /apply/{app.slug}
                      {app.subdivisionId ? ` · ${subdivisionLabel(app.departmentId, app.subdivisionId)}` : ""}
                    </p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-slate-500" />
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
    </Section>
  );
}
