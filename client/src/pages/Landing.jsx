import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Bot, ChevronDown, FileText, Newspaper,
  UserPlus,
} from "lucide-react";
import { FaDiscord } from "react-icons/fa6";
import Section from "../components/layout/Section";
import SocialLinks from "../components/layout/SocialLinks";
import AssistantModal from "../components/landing/AssistantModal";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { api } from "../lib/api";
import { iconFor } from "../lib/icons";
import { toneTile } from "../lib/tones";
import {
  SITE, features, heroCopy,
  departments as seedDepartments, patchNotes,
} from "../data/mockData";
import { formatDate } from "../lib/format";

/** The public landing page — full-bleed hero over stacked content sections. */
export default function Landing() {
  const [departments, setDepartments] = useState(seedDepartments);
  const [latest, setLatest] = useState(patchNotes[0]);
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api.departments(), api.latestPatchNote()])
      .then(([d, p]) => {
        if (!active) return;
        if (d?.length) setDepartments(d);
        if (p) setLatest(p);
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {departments.map((department) => {
            const Icon = iconFor(department.icon);
            return (
              <Card
                key={department.id}
                as={Link}
                to={`/departments/${department.id}`}
                hover
                className="group block p-5"
              >
                <span
                  className={`grid size-11 place-items-center rounded-xl ring-1 ring-inset ${toneTile(department.tone)}`}
                >
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-sm font-bold text-white">{department.abbr}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {department.name}
                </p>
                <p className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary-400">
                  View
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </p>
              </Card>
            );
          })}
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
              <Button as={Link} to="/applications/whitelist" size="lg">
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
