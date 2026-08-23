import { Link } from "react-router-dom";
import { KeyRound, Lock, ServerCrash, SlidersHorizontal } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Section from "../layout/Section";
import BotError from "./BotError";
import { signInUrl } from "../../lib/botApi";
import { apiOriginProblem } from "../../lib/botSameSite";
import { useBotAuth } from "../../context/useBotAuth";
import { SITE } from "../../data/mockData";

/**
 * The three ways into the dashboard, and the two ways it can be unusable.
 *
 * The distinction that matters is signed-out versus not-staff. Somebody who
 * authenticated with Discord perfectly well and simply is not staff has not hit
 * an error and should not be shown one, or invited to try signing in again —
 * they would get the same result. That state gets its own page saying plainly
 * what is missing and who to ask.
 */
export default function BotGate({ children }) {
  const { state, error, refresh } = useBotAuth();
  const originProblem = apiOriginProblem();

  if (state === "loading") {
    return (
      <Section className="max-w-3xl">
        <div className="space-y-4">
          <div className="h-11 w-64 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />
        </div>
      </Section>
    );
  }

  if (state === "unconfigured" || originProblem?.kind === "unset") {
    return (
      <Panel
        icon={<SlidersHorizontal className="size-7" />}
        tone="amber"
        title="The dashboard is not configured yet"
        body="This build has no bot API address, so there is nothing for it to talk to."
      >
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          Set <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">VITE_API_URL</code>{" "}
          to the bot API and rebuild the client. It has to be a subdomain of whatever
          domain serves this site — see <code className="text-xs">client/.env.example</code>.
        </p>
      </Panel>
    );
  }

  if (state === "error") {
    return (
      <Section className="max-w-2xl">
        <BotError error={error} onRetry={refresh} />
        {originProblem && <OriginWarning problem={originProblem} />}
      </Section>
    );
  }

  if (state === "not-staff") {
    return (
      <Panel
        icon={<Lock className="size-7" />}
        tone="rose"
        title="You're signed in, but not on the staff team"
        body={
          error?.message ??
          "Your Discord account does not have website access."
        }
      >
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          Access to this dashboard comes from holding a Discord role that an administrator
          has mapped to an access tier — the same roles that grant bot access. Signing in
          again will not change that. If you think you should have it, ask in{" "}
          <a
            href={SITE.discordInvite}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary-400 underline-offset-2 hover:underline"
          >
            the Discord
          </a>
          .
        </p>
        <Button as={Link} to="/" variant="secondary" size="sm" className="mt-6">
          Back to the site
        </Button>
      </Panel>
    );
  }

  if (state === "signed-out") {
    return (
      <Panel
        icon={<KeyRound className="size-7" />}
        tone="primary"
        title="Sign in to manage the bot"
        body="This dashboard uses your Discord account. Only staff can open it."
      >
        {originProblem && <OriginWarning problem={originProblem} />}
        {/* A full page navigation, not a fetch: this redirects to Discord. */}
        <Button as="a" href={signInUrl()} variant="discord" size="lg" block className="mt-6">
          Continue with Discord
        </Button>
      </Panel>
    );
  }

  return (
    <>
      {originProblem && (
        <Section className="max-w-5xl pb-0">
          <OriginWarning problem={originProblem} />
        </Section>
      )}
      {children}
    </>
  );
}

/**
 * Surfaced even when signed in, because a cross-site API produces a dashboard
 * that loads and then fails every write with a 401 that looks like a permission
 * problem. Naming it is the only way anyone finds it.
 */
function OriginWarning({ problem }) {
  return (
    <Card className="mb-5 flex items-start gap-3 p-5 ring-1 ring-inset ring-amber-400/25">
      <ServerCrash className="mt-0.5 size-5 shrink-0 text-amber-400" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-200">{problem.title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{problem.detail}</p>
      </div>
    </Card>
  );
}

function Panel({ icon, tone, title, body, children }) {
  const tones = {
    primary: "bg-primary-500/15 text-primary-400 ring-primary-400/25",
    amber: "bg-amber-500/15 text-amber-300 ring-amber-400/25",
    rose: "bg-rose-500/15 text-rose-300 ring-rose-400/25",
  };
  return (
    <Section className="max-w-xl">
      <Card className="p-8 text-center sm:p-10">
        <span
          className={`mx-auto grid size-16 place-items-center rounded-2xl ring-1 ring-inset ${tones[tone]}`}
        >
          {icon}
        </span>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">{body}</p>
        <div className="text-left">{children}</div>
      </Card>
    </Section>
  );
}
