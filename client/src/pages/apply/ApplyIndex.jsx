import { createElement, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Lock, PencilRuler } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { api } from "../../lib/api";
import { iconFor } from "../../lib/icons";
import { toneTile } from "../../lib/tones";
import { useAuth } from "../../context/useAuth";
import { DEPARTMENTS } from "../../data/rosterData";
import { subdivisionLabel } from "../../data/applicationSeed";
import { canManageApplications } from "../../lib/applicationConfig";

/**
 * Everything the community is currently accepting, grouped by department.
 *
 * Grouping by department rather than listing flat is what makes a subdivision
 * legible: "FHP — K9" under FHP reads as a unit inside a department, where the
 * same row in an alphabetical list reads as a department of its own.
 */
export default function ApplyIndex() {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    api.applyIndex().then((result) => {
      if (active) setData(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const ctx = useMemo(
    () => ({
      roleKeys: user?.roles ?? [],
      permissions: new Set(hasPermission("applications.manage") ? ["applications.manage"] : []),
    }),
    [user, hasPermission],
  );

  const canBuild = useMemo(
    () => DEPARTMENTS.some((d) => canManageApplications(d.id, ctx)),
    [ctx],
  );

  const groups = useMemo(() => {
    const applications = data?.applications ?? [];
    return DEPARTMENTS.map((department) => ({
      ...department,
      applications: applications.filter((app) => app.departmentId === department.id),
    })).filter((group) => group.applications.length > 0);
  }, [data]);

  const loading = data === null;

  return (
    <Section>
      <PageHeader
        eyebrow="Join a department"
        title="Apply"
        subtitle="Every department and subdivision now taking applications. Each one goes straight to that department's command staff in Discord, and you get an answer either way."
        actions={
          canBuild ? (
            <Button as={Link} to="/apply/manage" variant="secondary" size="sm">
              <PencilRuler className="size-4" />
              Build applications
            </Button>
          ) : null
        }
      />

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-44 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-semibold text-white">Nothing is open right now.</p>
          <p className="mt-1 text-sm text-slate-400">
            Departments open applications as they need people. Watch the Discord.
          </p>
        </Card>
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.id}>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
                  {group.label}
                </h2>
                <span className="h-px flex-1 bg-white/[0.06]" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {group.applications.map((app) => (
                  <ApplicationCard key={app.id} app={app} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Section>
  );
}

function ApplicationCard({ app }) {
  const open = app.status === "open";
  const subdivision = subdivisionLabel(app.departmentId, app.subdivisionId);

  return (
    <Card className="flex flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${toneTile(app.tone)}`}>
          {createElement(iconFor(app.icon), { className: "size-5" })}
        </span>
        {open ? (
          <Badge tone="green" dot>Open</Badge>
        ) : (
          <Badge tone="slate">{app.status === "draft" ? "Draft" : "Closed"}</Badge>
        )}
      </div>

      <h3 className="mt-4 text-lg font-black tracking-tight text-white">{app.title}</h3>
      {subdivision && (
        <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Subdivision · {subdivision}
        </p>
      )}
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{app.summary}</p>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">
          {app.fieldCount} question{app.fieldCount === 1 ? "" : "s"}
        </span>
        {open ? (
          <Button as={Link} to={`/apply/${app.slug}`} size="sm">
            Start
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Lock className="size-3.5" />
            Not accepting
          </span>
        )}
      </div>
    </Card>
  );
}
