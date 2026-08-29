import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Bot, ChevronDown, Crown, ExternalLink, FileText, Newspaper,
  ShieldCheck, UserPlus,
} from "lucide-react";
import { FaDiscord } from "react-icons/fa6";
import Section from "../components/layout/Section";
import SocialLinks from "../components/layout/SocialLinks";
import AssistantModal from "../components/landing/AssistantModal";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { api } from "../lib/api";
import { iconFor } from "../lib/icons";
import { accentOf } from "../lib/departmentConfig";
import {
  SITE, features, heroCopy,
  departments as seedDepartments, patchNotes,
} from "../data/mockData";
import { formatDate } from "../lib/format";

/** The three law-enforcement departments, in reading order. */
const LEO_IDS = ["fhp", "bcso", "mpd"];

/** Department crests, hosted on the community site. */
const DEPT_LOGOS = {
  fhp: "https://www.flrp.us/images/480f8f75e967b7e4.png",
  bcso: "https://www.flrp.us/images/c45e2a2852eba7fb.png",
  mpd: "https://www.flrp.us/images/72517584c4a23ba3.png",
};

/** The director seats, shown as Vacant until the Discord sync fills them. */
const DIRECTOR_SEATS = [
  { seat: "Staff Director", vacant: true },
  { seat: "ES Director", vacant: true },
  { seat: "Dev. Director", vacant: true },
  { seat: "Civilian Director", vacant: true },
];

/** The public landing page — full-bleed hero over stacked content sections. */
export default function Landing() {
  const [departments, setDepartments] = useState(seedDepartments);
  const [latest, setLatest] = useState(patchNotes[0]);
  const [leadership, setLeadership] = useState({ ownership: [], directors: [] });
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api.departments(), api.latestPatchNote(), api.leadership()])
      .then(([d, p, l]) => {
        if (!active) return;
        if (d?.length) setDepartments(d);
        if (p) setLatest(p);
        if (l) setLeadership({ ownership: l.ownership ?? [], directors: l.directors ?? [] });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const scrollToContent = () => {
    document.getElementById("explore")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      {/* 1 — Hero. Pulled up under the transparent top bar. */}
      <section className="relative -mt-16 flex min-h-[92vh] items-center overflow-hidden">
        <img
          src={SITE.heroImage}
          alt=""
          aria-hidden="true"
          loading="eager"
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-[#0a0e1a]/75" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0e1a]/60 via-transparent to-[#0a0e1a]" />

        <div className="relative mx-auto w-full max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
          <h1 className="animate-fade-up text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
            {heroCopy.headline}
            <br />
            <span className="text-primary-500">{heroCopy.brand}</span>
          </h1>

          <p className="animate-fade-up delay-100 mt-5 max-w-2xl text-lg text-slate-300">
            {heroCopy.subtitle}
          </p>
          <p className="animate-fade-up delay-100 mt-3 text-sm font-bold text-primary-400">
            {heroCopy.tagline}
          </p>

          <div className="animate-fade-up delay-200 mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button as={Link} to="/join" size="lg" variant="primary" className="w-full sm:w-auto">
              <FileText className="size-5" />
              Join Florida Roleplay
            </Button>
            <Button as={Link} to="/create-account" size="lg" variant="secondary" className="w-full sm:w-auto">
              <UserPlus className="size-5" />
              Create Account
            </Button>
            <Button
              as="a"
              href={SITE.discordInvite}
              target="_blank"
              rel="noreferrer noopener"
              size="lg"
              variant="discord"
              className="w-full sm:w-auto"
            >
              <FaDiscord className="size-5" />
              Discord
            </Button>
          </div>

          <div className="animate-fade-up delay-300 mt-8 max-w-md">
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="flex h-14 w-full items-center justify-between gap-3 rounded-xl bg-primary-500 px-5 font-bold tracking-tight text-white shadow-[0_10px_30px_-10px_rgba(242,128,13,0.7)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/70"
            >
              <span className="flex items-center gap-2.5">
                <Bot className="size-5" />
                Come play with {SITE.assistantName}!
              </span>
              <ChevronDown className="size-5" />
            </button>
            <p className="mt-3 text-sm text-slate-400">
              {SITE.assistantName} is our in-house assistant — ask about the rules,
              applications or how to get whitelisted and get an answer straight away.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={scrollToContent}
          className="animate-fade-up delay-400 absolute inset-x-0 bottom-6 mx-auto flex w-max flex-col items-center gap-2 text-slate-500 transition hover:text-slate-300"
        >
          <span className="text-xs uppercase tracking-[0.16em]">Explore More</span>
          <ChevronDown className="animate-float size-5" />
        </button>
      </section>


      {/* 2 — Feature grid */}
      <Section
        id="explore"
        reveal
        eyebrow="Why Florida Roleplay"
        title="Built for people who take the scene seriously"
        subtitle="Three things we refuse to compromise on, and the reason members stay for years rather than weeks."
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = iconFor(feature.icon);
            return (
              <Card key={feature.id} hover className="p-6">
                <span className="grid size-11 place-items-center rounded-xl bg-primary-500/15 text-primary-400 ring-1 ring-inset ring-primary-400/20">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {feature.body}
                </p>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* 4 — Departments preview */}
      <Section
        reveal
        eyebrow="Emergency Services"
        title="Three agencies"
        subtitle="Every department runs its own command structure, fleet and hiring process."
      >
        <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-3">
          {LEO_IDS.map((id) => departments.find((d) => d.id === id))
            .filter(Boolean)
            .map((department) => {
              const Icon = iconFor(department.icon);
              const accent = accentOf({ accent: department.tone });
              const logo = DEPT_LOGOS[department.id];
              return (
                <Card
                  key={department.id}
                  as={Link}
                  to={`/departments/${department.id}`}
                  hover
                  className="group relative flex flex-col items-center overflow-hidden p-7 text-center"
                >
                  {/* Faint accent wash from the top, deepening on hover. */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-60 transition-opacity duration-500 group-hover:opacity-100"
                    style={{ background: `radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, ${accent.color} 22%, transparent), transparent 70%)` }}
                  />
                  <span
                    className="relative grid size-20 place-items-center rounded-2xl ring-1 ring-inset transition-transform duration-500 group-hover:-translate-y-0.5"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${accent.color} 12%, transparent)`,
                      "--tw-ring-color": `color-mix(in srgb, ${accent.color} 32%, transparent)`,
                    }}
                  >
                    {logo ? (
                      <img
                        src={logo}
                        alt={`${department.abbr} crest`}
                        className="size-14 object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.4)]"
                      />
                    ) : (
                      <Icon className="size-8" style={{ color: accent.color }} />
                    )}
                  </span>
                  <h3 className="relative mt-5 text-lg font-black tracking-tight text-white">
                    {department.abbr}
                  </h3>
                  <p className="relative mt-1 text-xs font-semibold" style={{ color: accent.soft }}>
                    {department.name}
                  </p>
                  {department.tagline && (
                    <p className="relative mt-3 line-clamp-2 text-xs leading-relaxed text-slate-400">
                      {department.tagline}
                    </p>
                  )}
                  <p className="relative mt-5 inline-flex items-center gap-1 text-xs font-bold text-primary-400">
                    View department
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </p>
                </Card>
              );
            })}
        </div>
      </Section>

      {/* 4.5 — Leadership, synced from Discord. Always shown; the director seats
          fall back to Vacant until the sync fills them. */}
      <Section reveal eyebrow="The Team" title="Leadership" subtitle="The people who run Florida Roleplay, straight from Discord.">
        <div className="space-y-8">
          {leadership.ownership.length > 0 && (
            <LeadershipGroup label="Ownership" icon={Crown} members={leadership.ownership} />
          )}
          <LeadershipGroup
            label="Board of Directors"
            icon={ShieldCheck}
            members={leadership.directors.length ? leadership.directors : DIRECTOR_SEATS}
          />
        </div>
      </Section>

      {/* 5 — Latest patch note */}
      {latest && (
        <Section reveal eyebrow="Changelog" title="Latest from the dev team">
          <Card
            as={Link}
            to="/patch-notes"
            hover
            className="group flex items-center gap-5 p-5"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-500/15 text-primary-400 ring-1 ring-inset ring-primary-400/20">
              <Newspaper className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {latest.version} · {formatDate(latest.releasedAt)}
              </p>
              <p className="mt-1 truncate text-sm font-bold text-white">
                {latest.title}
              </p>
            </div>
            <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-primary-400 transition-all group-hover:gap-2.5 sm:inline-flex">
              Open
              <ArrowRight className="size-3.5" />
            </span>
          </Card>
        </Section>
      )}

      {/* 6 — Closing CTA */}
      <Section reveal className="pb-20">
        <Card className="relative overflow-hidden p-8 text-center sm:p-12">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary-600/10 to-transparent" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to write your character?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-400">
              Whitelisting takes a day or two. Read the rules, submit an
              application and you could be on the road this weekend.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                as="a"
                href="https://flrp.us/whitelist"
                target="_blank"
                rel="noreferrer noopener"
                size="lg"
              >
                Apply for Whitelist
              </Button>
              <Button as={Link} to="/rules" size="lg" variant="secondary">
                Read the Rules
              </Button>
            </div>
            <SocialLinks className="mt-12" />
          </div>
        </Card>
      </Section>

      <AssistantModal open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </>
  );
}

/** One leadership band (Ownership / Board of Directors) with a header + count. */
function LeadershipGroup({ label, icon: Icon, members }) {
  if (!members || members.length === 0) return null;
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-lg bg-primary-500/12 text-primary-300 ring-1 ring-inset ring-primary-400/20">
          <Icon className="size-4" />
        </span>
        <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-white">{label}</h3>
        <span className="h-px flex-1 bg-white/[0.06]" />
        <span className="text-xs font-bold tabular-nums text-slate-500">
          {String(members.length).padStart(2, "0")}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m, i) => (
          <LeadershipCard key={m.discordId || m.seat || `${m.name}-${i}`} member={m} />
        ))}
      </div>
    </div>
  );
}

/** A single leader: avatar, role/seat, their Discord nickname line and a profile
 *  link — or, for an unfilled director seat, a dashed "Vacant" card. */
function LeadershipCard({ member }) {
  // The small label is the fixed seat name for directors, else their live role.
  const label = member.seat || member.role;

  if (member.vacant) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full border border-dashed border-white/15 text-slate-600">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          {label && (
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              {label}
            </p>
          )}
          <p className="mt-0.5 truncate text-sm font-semibold italic text-slate-500">Vacant</p>
        </div>
      </div>
    );
  }

  const initials = (member.name || "?")
    .split(/[\s.|]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  // Reconstruct the "callsign | role | name" line the way it reads in Discord.
  const line = [member.callsign, member.role, member.name].filter(Boolean).join(" | ");
  const href = member.discordId ? `https://discord.com/users/${member.discordId}` : null;

  return (
    <Card className="group relative flex items-center gap-4 p-4">
      {member.avatar ? (
        <img
          src={member.avatar}
          alt=""
          className="size-14 shrink-0 rounded-full object-cover ring-2 ring-inset ring-white/10"
        />
      ) : (
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary-500/15 text-sm font-bold text-primary-300 ring-2 ring-inset ring-primary-400/20">
          {initials || "?"}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {label && (
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-primary-400">
            {label}
          </p>
        )}
        <p className="mt-0.5 truncate text-sm font-bold text-white" title={line}>
          {line || member.name}
        </p>
        {member.handle && (
          <p className="mt-0.5 truncate text-xs text-slate-500">@{member.handle}</p>
        )}
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${member.name}'s Discord profile`}
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.03] text-slate-400 ring-1 ring-inset ring-white/[0.08] transition hover:bg-primary-500/15 hover:text-primary-300"
        >
          <ExternalLink className="size-4" />
        </a>
      )}
    </Card>
  );
}
