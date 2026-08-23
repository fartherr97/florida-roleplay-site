import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import Section from "../components/layout/Section";
import PageHeader from "../components/layout/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import CopyField from "../components/ui/CopyField";
import { SITE } from "../data/mockData";

const STEPS = [
  {
    title: "Install FiveM",
    body: "Download FiveM from the official site and point it at your legitimate copy of GTA V. The launcher will tell you if it cannot verify the game.",
    action: {
      label: "Get FiveM",
      href: "https://fivem.net/",
      external: true,
      variant: "secondary",
    },
  },
  {
    title: "Join our Discord",
    body: "Whitelisting, applications, support tickets and department recruitment all run through Discord. Your Discord account is the identity the server recognises.",
    action: {
      label: "Open Discord invite",
      href: SITE.discordInvite,
      external: true,
      variant: "discord",
    },
  },
  {
    title: "Read the rules",
    body: "Read them properly — the whitelist interview references them directly, and skimming is the most common reason an application is declined.",
    action: { label: "Read the rules", to: "/rules", variant: "secondary" },
  },
  {
    title: "Apply for whitelist",
    body: "Submit the community whitelist application. Most are reviewed within 24 to 48 hours and the outcome arrives as a Discord direct message.",
    action: {
      label: "Start application",
      to: "/applications/whitelist",
      variant: "primary",
    },
  },
  {
    title: "Connect and play",
    body: "Once you're approved, connect directly from FiveM using the address below. Your first spawn is at the DMV — take the practical test and get on the road.",
  },
];

/** Step-by-step guide from a fresh install to a first scene. */
export default function Join() {
  return (
    <Section>
      <PageHeader
        eyebrow="Getting started"
        title="Join Florida Roleplay"
        subtitle="Five steps, roughly twenty minutes of setup and a day or two of review."
      />

      <ol className="space-y-4">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <Card className="flex flex-col gap-5 p-6 sm:flex-row">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-500/15 text-base font-extrabold text-primary-400 ring-1 ring-inset ring-primary-400/20">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-white">{step.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {step.body}
                </p>

                {step.action && (
                  <div className="mt-5">
                    {step.action.external ? (
                      <Button
                        as="a"
                        href={step.action.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        size="sm"
                        variant={step.action.variant}
                      >
                        {step.action.label}
                        <ExternalLink className="size-4" />
                      </Button>
                    ) : (
                      <Button
                        as={Link}
                        to={step.action.to}
                        size="sm"
                        variant={step.action.variant}
                      >
                        {step.action.label}
                      </Button>
                    )}
                  </div>
                )}

                {index === STEPS.length - 1 && (
                  <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <CopyField label="Server" value={SITE.serverAddress} />
                    <Button as="a" href={SITE.fivemConnect} size="sm">
                      Connect now
                      <ExternalLink className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </Section>
  );
}
