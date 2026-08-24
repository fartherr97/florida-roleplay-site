import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, LayoutGrid, Users } from "lucide-react";
import Section from "../components/layout/Section";
import PageHeader from "../components/layout/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { api } from "../lib/api";
import { useAuth } from "../context/useAuth";
import { accentOf } from "../lib/departmentConfig";
import { iconFor } from "../lib/icons";
import { toneTile } from "../lib/tones";
import { departments as seedDepartments } from "../data/mockData";

/** Overview grid of every emergency service on the server. */
export default function Departments() {
  const [departments, setDepartments] = useState(seedDepartments);
  const [hubs, setHubs] = useState([]);
  const { hasPermission } = useAuth();

  useEffect(() => {
    let active = true;
    api.departments().then((data) => {
      if (active && data?.length) setDepartments(data);
    });
    return () => {
      active = false;
    };
  }, []);

  // The department hubs are a separate listing: a department's public page is
  // recruitment-facing, while its hub is the internal site behind it.
  useEffect(() => {
    let active = true;
    api.deptList().then((data) => {
      if (active) setHubs(data ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Section>
      <PageHeader
        eyebrow="Emergency Services"
        title="Departments"
        subtitle="Four agencies cover the county, each with its own command structure, fleet and recruitment process."
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((department) => {
          const Icon = iconFor(department.icon);
          return (
            <Card
              key={department.id}
              as={Link}
              to={`/departments/${department.id}`}
              hover
              className="group flex flex-col p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`grid size-11 place-items-center rounded-xl ring-1 ring-inset ${toneTile(department.tone)}`}
                >
                  <Icon className="size-5" />
                </span>
                <Badge tone={department.hiring ? "green" : "slate"} dot={department.hiring}>
                  {department.hiring ? "Hiring" : "Closed"}
                </Badge>
              </div>

              <h2 className="mt-5 text-base font-bold text-white">
                {department.abbr}
              </h2>
              <p className="mt-1 text-sm text-slate-300">{department.name}</p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">
                {department.tagline}
              </p>

              <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  <Users className="size-3.5" />
                  {department.roster} members
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-400 transition-all group-hover:gap-2.5">
                  View
                  <ArrowRight className="size-3.5" />
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {hasPermission("departments.view") && hubs.length > 0 && (
        <section className="mt-14">
          <div className="mb-5 flex items-center gap-3">
            <LayoutGrid className="size-5 text-primary-400" />
            <h2 className="text-lg font-bold tracking-tight text-white">Department hubs</h2>
          </div>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-slate-400">
            Each department runs its own internal site — roster, fleet, uniforms, chain of command
            and its own resources. What you can do inside one depends on the Discord roles you
            hold there.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hubs.map((hub) => (
              <Card
                key={hub.id}
                as={Link}
                to={`/departments/${hub.id}/hub`}
                hover
                className="group flex flex-col p-5"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-xl text-[11px] font-extrabold ring-1 ring-inset"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${accentOf(hub).color} 15%, transparent)`,
                      color: accentOf(hub).soft,
                    }}
                  >
                    {hub.shortName.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-white">{hub.shortName}</div>
                    <div className="truncate text-xs text-slate-500">{hub.tagline}</div>
                  </div>
                </div>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-400">
                  {hub.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary-400 transition-all group-hover:gap-2.5">
                  Open hub
                  <ArrowRight className="size-3.5" />
                </span>
              </Card>
            ))}
          </div>
        </section>
      )}
    </Section>
  );
}
