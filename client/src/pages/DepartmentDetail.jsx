import { createElement, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Car, ExternalLink, Users } from "lucide-react";
import Section from "../components/layout/Section";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import NotFound from "../components/auth/NotFound";
import { api } from "../lib/api";
import { useAuth } from "../context/useAuth";
import { iconFor } from "../lib/icons";
import { toneTile } from "../lib/tones";
import { SITE, departments as seedDepartments } from "../data/mockData";

/**
 * Department emblems, served from the community's own image host. A department with no
 * logo here falls back to its tinted icon tile, so the page never shows a broken image.
 */
const DEPT_LOGOS = {
  fhp: "https://www.flrp.us/images/480f8f75e967b7e4.png",
  bcso: "https://www.flrp.us/images/c45e2a2852eba7fb.png",
  mpd: "https://www.flrp.us/images/72517584c4a23ba3.png",
};

/**
 * Detail page for one agency.
 *
 * Led like the hub landings: the department's own emblem drifting over a centred column,
 * with a single prominent way in — "Enter Department Hub" — rather than the FLRP logo and a
 * small link. The rank ladder and fleet sit below as reference once you've landed.
 */
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

  const logo = DEPT_LOGOS[department.id] ?? department.logo ?? null;

  return (
    <Section>
      <div className="mx-auto max-w-3xl">
        <Link
          to="/departments"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-400 ring-1 ring-inset ring-white/[0.08] transition hover:bg-white/[0.04] hover:text-white"
        >
          <ArrowLeft className="size-3.5" />
          All departments
        </Link>

        {/* Hero — the department's emblem, name and the way in. */}
        <div className="mt-8 text-center">
          <div className="flex justify-center">
            {logo ? (
              <img
                src={logo}
                alt={`${department.name} emblem`}
                className="animate-float size-32 object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.55)] sm:size-40"
              />
            ) : (
              <span
                className={`grid size-28 place-items-center rounded-3xl ring-1 ring-inset sm:size-32 ${toneTile(department.tone)}`}
              >
                {createElement(iconFor(department.icon), { className: "size-14" })}
              </span>
            )}
          </div>

          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-400">
            Emergency Services · {department.abbr}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {department.name}
          </h1>
          {department.tagline && (
            <p className="mt-2 text-lg font-bold tracking-tight text-brand-400">
              {department.tagline}
            </p>
          )}
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-slate-400">
            {department.mission}
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            {/* The hub is the department's internal site. Hidden from anyone who cannot
                open it — the server gates it too, so this only avoids offering a dead end. */}
            {hasPermission("departments.view") && (
              <Button
                as={Link}
                to={`/departments/${department.id}/hub`}
                variant="primary"
                size="lg"
              >
                Enter Department Hub
                <ArrowRight className="size-5" />
              </Button>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Badge tone={department.hiring ? "green" : "slate"} dot={department.hiring}>
                {department.hiring ? "Now hiring" : "Recruitment closed"}
              </Badge>
              {department.hiring && (
                <Button
                  as="a"
                  href={SITE.applyUrl}
                  target="_blank"
                  rel="noreferrer"
                  variant="secondary"
                  size="sm"
                >
                  Apply to {department.abbr}
                  <ExternalLink className="size-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 border-t border-white/[0.06] pt-6">
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
          </div>
        </div>

        {/* Reference — rank ladder and fleet. */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
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
              Fleet photography coming soon — screenshots are being retaken after the v2.14
              vehicle pass.
            </p>
          </Card>
        </div>
      </div>
    </Section>
  );
}
