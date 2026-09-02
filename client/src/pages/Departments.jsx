import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Users } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/useAuth";
import { accentOf, RECRUITMENT_STATUS_MAP } from "../lib/departmentConfig";
import { departments as seedDepartments } from "../data/mockData";

/** The three law-enforcement departments, in the order they read across the split. */
const LEO_IDS = ["fhp", "bso", "mpd"];

/** Department crests, hosted on the community site. */
const DEPT_LOGOS = {
  fhp: "https://www.flrp.us/images/480f8f75e967b7e4.png",
  bso: "https://www.flrp.us/images/c45e2a2852eba7fb.png",
  mpd: "https://www.flrp.us/images/72517584c4a23ba3.png",
};

/**
 * The departments landing — a full-height three-way split, one panel per
 * law-enforcement department in its own colour. Each panel is a compressed
 * version of that department's own landing page; hovering one opens it up, and
 * its button drops you straight into that department's hub.
 */
export default function Departments() {
  const [departments, setDepartments] = useState(seedDepartments);
  const [hubs, setHubs] = useState([]);
  // Live member counts, projected from the actual roster per department, keyed
  // by id — so the headcount matches the roster rather than a static record.
  const [counts, setCounts] = useState({});
  const { hasPermission } = useAuth();
  const canEnter = hasPermission("departments.view");

  useEffect(() => {
    let active = true;
    api.departments().then((data) => {
      if (active && data?.length) setDepartments(data);
    });
    api.deptList().then((data) => {
      if (active) setHubs(data ?? []);
    });
    Promise.all(
      LEO_IDS.map((id) =>
        api
          .deptPublic(id)
          .then((d) => [id, d?.memberCount])
          .catch(() => [id, null]),
      ),
    ).then((entries) => {
      if (active) setCounts(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, []);

  // Merge the recruitment-facing department list with the hub summaries, so each
  // panel has its accent, crest, tagline and headcount from one shape.
  const panels = useMemo(
    () =>
      LEO_IDS.map((id) => {
        const dept = departments.find((d) => d.id === id) ?? {};
        const hub = hubs.find((h) => h.id === id) ?? {};
        const accent = accentOf({ accent: hub.accent ?? dept.tone });
        return {
          id,
          abbr: dept.abbr ?? hub.shortName ?? id.toUpperCase(),
          name: dept.name ?? hub.name ?? id.toUpperCase(),
          tagline: hub.tagline ?? dept.tagline ?? "",
          description: dept.tagline ?? hub.description ?? "",
          members: counts[id] ?? dept.roster ?? null,
          status: RECRUITMENT_STATUS_MAP[hub.recruitment?.status] ?? RECRUITMENT_STATUS_MAP.hiring,
          logo: DEPT_LOGOS[id],
          color: accent.color,
          soft: accent.soft,
        };
      }),
    [departments, hubs, counts],
  );

  return (
    <div className="relative">
      {/* Overlaid title, legible over any panel thanks to the scrim behind it. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-[#0a0e1a] via-[#0a0e1a]/70 to-transparent pb-16 pt-10 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary-400">
          Emergency Services
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Departments
        </h1>
        <p className="mx-auto mt-2 max-w-xl px-4 text-sm text-slate-300">
          Three agencies, each with its own command, fleet and recruitment. Pick one to step inside.
        </p>
      </div>

      <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
        {panels.map((panel, index) => (
          <DepartmentPanel key={panel.id} panel={panel} first={index === 0} canEnter={canEnter} />
        ))}
      </div>
    </div>
  );
}

function DepartmentPanel({ panel, first, canEnter }) {
  return (
    <section
      className={[
        "group relative flex min-h-[60vh] flex-1 items-end overflow-hidden transition-[flex-grow] duration-500 ease-out lg:min-h-0 lg:hover:flex-[1.35]",
        first ? "" : "border-t border-white/10 lg:border-l lg:border-t-0",
      ].join(" ")}
      style={{ "--p": panel.color, "--ps": panel.soft }}
    >
      {/* Accent wash from the top, deepening on hover. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 80% at 50% 0%, color-mix(in srgb, var(--p) 26%, transparent), transparent 62%), linear-gradient(180deg, #0a0f1e 0%, #0a0e1a 100%)",
        }}
      />
      {/* The crest as a large, faint watermark that lifts on hover. */}
      {panel.logo && (
        <img
          src={panel.logo}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[38%] w-[55%] max-w-[16rem] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.06] transition-all duration-700 ease-out group-hover:opacity-[0.1]"
        />
      )}
      {/* Bottom accent glow, revealed on hover. */}
      <div
        className="absolute inset-x-0 bottom-0 h-2/3 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: "linear-gradient(0deg, color-mix(in srgb, var(--p) 20%, transparent), transparent)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e1a] via-[#0a0e1a]/30 to-transparent" />

      {/* Content, anchored to the bottom of the panel. */}
      <div className="relative z-10 w-full px-6 pb-12 pt-28 text-center sm:px-8">
        {panel.logo && (
          <img
            src={panel.logo}
            alt={`${panel.name} crest`}
            className="mx-auto size-14 object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:-translate-y-0.5"
          />
        )}
        <h2
          className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl"
          style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}
        >
          {panel.abbr}
        </h2>
        <p className="mt-1.5 text-sm font-bold" style={{ color: panel.soft }}>
          {panel.name}
        </p>

        <div className="mt-3 flex items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
          {panel.members != null && (
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              {panel.members} members
            </span>
          )}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5"
            style={{
              backgroundColor: `color-mix(in srgb, ${panel.status.color} 16%, transparent)`,
              color: panel.status.color,
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: panel.status.color }}
            />
            {panel.status.label}
          </span>
        </div>

        {/* The description opens up when the panel is focused, on desktop. */}
        {panel.description && (
          <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-slate-300 lg:max-h-0 lg:overflow-hidden lg:opacity-0 lg:transition-all lg:duration-500 lg:group-hover:max-h-28 lg:group-hover:opacity-100">
            {panel.description}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {canEnter ? (
            <>
              <Link
                to={`/departments/${panel.id}/hub`}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold ring-1 ring-inset transition hover:brightness-125"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--p) 20%, transparent)",
                  color: panel.soft,
                  "--tw-ring-color": "color-mix(in srgb, var(--p) 42%, transparent)",
                }}
              >
                Enter Hub
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to={`/departments/${panel.id}`}
                className="text-xs font-semibold text-slate-400 underline-offset-4 transition hover:text-white hover:underline"
              >
                Recruitment
              </Link>
            </>
          ) : (
            <Link
              to={`/departments/${panel.id}`}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold ring-1 ring-inset transition hover:brightness-125"
              style={{
                backgroundColor: "color-mix(in srgb, var(--p) 20%, transparent)",
                color: panel.soft,
                "--tw-ring-color": "color-mix(in srgb, var(--p) 42%, transparent)",
              }}
            >
              View Department
              <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
