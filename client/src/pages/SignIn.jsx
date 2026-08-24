import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import Section from "../components/layout/Section";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { api, loginUrl } from "../lib/api";
import { SITE } from "../data/mockData";

/**
 * Discord OAuth sign-in. "Continue with Discord" is a full-page navigation to
 * the API's /auth/login, which sets the CSRF state cookie and redirects to
 * Discord — so the browser, not a fetch, follows the handshake and comes back
 * with the session cookie. The callback bounces failures back here with an
 * `?error=` we translate into a line the visitor can act on.
 */
const ERRORS = {
  not_in_guild:
    "That Discord account isn't in our server. Join the Discord first, then sign in.",
  denied: "Sign-in was cancelled. You can try again whenever you're ready.",
  state: "That sign-in link expired. Please try again.",
  failed: "Something went wrong talking to Discord. Please try again.",
  unconfigured: "Discord sign-in isn't set up on this server yet.",
};

export default function SignIn() {
  const [params] = useSearchParams();
  const [configured, setConfigured] = useState(true);
  const errorKey = params.get("error");
  const returnTo = params.get("returnTo") || "/";

  useEffect(() => {
    let active = true;
    api.authConfig().then((cfg) => {
      if (active) setConfigured(Boolean(cfg?.configured));
    });
    return () => {
      active = false;
    };
  }, []);

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

          {errorKey && (
            <p className="mx-auto mt-6 max-w-sm rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {ERRORS[errorKey] ?? "Sign-in didn't complete. Please try again."}
              {errorKey === "not_in_guild" && (
                <>
                  {" "}
                  <a
                    href={SITE.discordInvite}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-semibold text-rose-100 underline"
                  >
                    Join the Discord
                  </a>
                  .
                </>
              )}
            </p>
          )}

          <Button
            as="a"
            href={configured ? loginUrl(returnTo) : SITE.discordInvite}
            {...(configured ? {} : { target: "_blank", rel: "noreferrer noopener" })}
            variant="discord"
            size="lg"
            block
            className="mt-8"
          >
            Continue with Discord
          </Button>

          {!configured && (
            <p className="mt-6 text-xs text-slate-500">
              Discord sign-in isn't configured on this server yet — this button
              opens our Discord instead.
            </p>
          )}
          <p className="mt-6 text-sm text-slate-400">
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
