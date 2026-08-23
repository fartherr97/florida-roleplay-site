import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import Section from "../components/layout/Section";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { SITE } from "../data/mockData";

/**
 * Discord OAuth entry point. The flow is stubbed — the button points at the
 * Discord invite until the real OAuth handshake is implemented server-side.
 */
export default function SignIn() {
  return (
    <Section className="max-w-lg">
      <Card className="relative overflow-hidden p-8 text-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary-600/10 to-transparent" />
        <div className="relative">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#5865f2]/15 text-[#8b93f8] ring-1 ring-inset ring-[#5865f2]/25">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-white">
            Sign in
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
            {SITE.name} uses Discord for sign-in. Your Discord roles decide which
            parts of the portal you can open — no separate password to remember.
          </p>

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
            New here?{" "}
            <Link
              to="/create-account"
              className="font-semibold text-primary-400 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </Card>
    </Section>
  );
}
