import { Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import Section from "../components/layout/Section";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { SITE } from "../data/mockData";

const STEPS = [
  "Authorise with Discord — we only read your username, avatar and roles.",
  "Submit the community whitelist application.",
  "Get approved and connect to the server.",
];

/**
 * Account creation entry point. Like sign-in, the Discord handshake is stubbed
 * until real OAuth is implemented.
 */
export default function CreateAccount() {
  return (
    <Section className="max-w-lg">
      <Card className="relative overflow-hidden p-8 text-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary-600/10 to-transparent" />
        <div className="relative">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-500/15 text-primary-400 ring-1 ring-inset ring-primary-400/20">
            <UserPlus className="size-6" />
          </span>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-white">
            Create your account
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
            There's no signup form — your Discord account is your account here.
          </p>

          <ol className="mt-7 space-y-3 text-left">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/[0.04] text-[11px] font-bold text-primary-400 ring-1 ring-inset ring-white/10">
                  {index + 1}
                </span>
                <span className="text-sm text-slate-300">{step}</span>
              </li>
            ))}
          </ol>

          <Button
            as="a"
            href={SITE.discordInvite}
            target="_blank"
            rel="noreferrer noopener"
            variant="discord"
            size="lg"
            block
            className="mt-8"
          >
            Continue with Discord
          </Button>

          <p className="mt-6 text-xs text-slate-500">
            {/* TODO: replace with the real OAuth redirect once the flow is live. */}
            OAuth is not wired up yet — this button opens our Discord instead.
          </p>
          <p className="mt-4 text-sm text-slate-400">
            Already set up?{" "}
            <Link to="/sign-in" className="font-semibold text-primary-400 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </Card>
    </Section>
  );
}
