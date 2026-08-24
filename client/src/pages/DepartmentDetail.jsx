import { createElement, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Car, ExternalLink, Users } from "lucide-react";
import Section from "../components/layout/Section";
import PageHeader from "../components/layout/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import NotFound from "../components/auth/NotFound";
import { api } from "../lib/api";
import { useAuth } from "../context/useAuth";
import { iconFor } from "../lib/icons";
import { toneTile } from "../lib/tones";
import { SITE, departments as seedDepartments } from "../data/mockData";

/** Detail page for one agency — banner, mission, ranks, fleet and recruitment. */
export default function DepartmentDetail() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  // Render from seed data immediately, then swap in the API record for this id.
  // Stamping the result with its id keeps a stale response from a previous param
  // out of the render without an extra reset effect.
  const [fetched, setFetched] = useState(null);

  useEffect(() => {
    let active = true;
    api.department(id).then((data) => {
      if (active) setFetched({ id, data: data ?? null });
    });
    return () => {
      active = false;
    };
  }, [id]);

  const seed = seedDepartments.find((d) => d.id === id) ?? null;
  const settled = fetched?.id === id;
  const department = settled ? (fetched.data ?? seed) : seed;

  if (!department) {
    if (!settled) {
      return (
        <Section>
          <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />
        </Section>
      );
    }
    return <NotFound />;
  }

  return (
    <Section>
      <PageHeader
        eyebrow="Emergency Services"
        title={department.name}
        subtitle={department.tagline}
        backTo="/departments"
        backLabel="All departments"
        actions={
          <>
            {/* The hub is the department's internal site. Hidden from anyone who
                cannot open it — the server gates it too, so this is only about
                not offering a dead end. */}
            {hasPermission("departments.view") && (
              <Button as={Link} to={`/departments/${department.id}/hub`} size="sm">
                {department.abbr} Hub
                <ArrowRight className="size-4" />
              </Button>
            )}
            <Badge tone={department.hiring ? "green" : "slate"} dot={department.hiring}>
              {department.hiring ? "Now hiring" : "Recruitment closed"}
            </Badge>
          </>
        }
      />

      {/* Banner */}
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary-600/10 to-transparent" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <span
            className={`grid size-20 shrink-0 place-items-center rounded-2xl ring-1 ring-inset ${toneTile(department.tone)}`}
          >
            {createElement(iconFor(department.icon), { className: "size-9" })}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-400">
              {department.abbr}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {department.mission}
            </p>
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap items-center gap-6 border-t border-white/[0.06] pt-6">
          <span className="inline-flex items-center gap-2 text-sm text-slate-400">
            <Users className="size-4 text-slate-500" />
            <strong className="font-bold text-white">{department.roster}</strong>
            sworn members
          </span>
          <span className="inline-flex items-center gap-2 text-sm text-slate-400">
            <Car className="size-4 text-slate-500" />
            <strong className="font-bold text-white">{department.fleet.length}</strong>
            fleet vehicles
          </span>
          {department.hiring && (
            <Button
              as="a"
              href={SITE.applyUrl}
              target="_blank"
              rel="noreferrer"
              size="sm"
              className="sm:ml-auto"
            >
              Apply to {department.abbr}
              <ExternalLink className="size-4" />
            </Button>
          )}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Rank structure */}
        <Card className="p-6">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Rank structure
          </h2>
          <ol className="mt-5 space-y-2.5">
            {department.ranks.map((rank, index) => (
              <li key={rank} className="flex items-center gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-[11px] font-bold text-primary-400 ring-1 ring-inset ring-white/10">
                  {index + 1}
                </span>
                <span className="text-sm text-slate-300">{rank}</span>
              </li>
            ))}
          </ol>
        </Card>

        {/* Fleet */}
        <Card className="p-6">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Fleet
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {department.fleet.map((vehicle) => (
              <li
                key={vehicle}
                className="rounded-xl bg-black/20 p-4 ring-1 ring-inset ring-white/[0.06]"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-white/[0.04] text-slate-400 ring-1 ring-inset ring-white/10">
                  <Car className="size-4" />
                </span>
                <p className="mt-3 text-sm text-slate-300">{vehicle}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            {/* TODO: swap this list for real in-game fleet photography. */}
            Fleet photography coming soon — screenshots are being retaken after
            the v2.14 vehicle pass.
          </p>
        </Card>
      </div>
    </Section>
  );
}
