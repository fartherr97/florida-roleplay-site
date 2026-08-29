import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Zap } from "lucide-react";
import { FaDiscord } from "react-icons/fa6";
import Button from "../../components/ui/Button";
import SocialLinks from "../../components/layout/SocialLinks";
import Logo from "../../components/layout/Logo";
import HubBrandMark from "../../components/hub/HubBrandMark";
import { useAuth } from "../../context/useAuth";
import { api, loginUrl } from "../../lib/api";
import { SITE, STAFF_RANKS } from "../../data/mockData";
import { cn } from "../../lib/cn";

/** Chip colours, matching the tones the preview switcher uses. */
const CHIP_TONES = {
  slate: "text-slate-300 ring-slate-400/30 bg-slate-500/[0.07]",
  brand: "text-brand-300 ring-brand-400/30 bg-brand-500/[0.07]",
  green: "text-emerald-300 ring-emerald-400/30 bg-emerald-500/[0.07]",
  primary: "text-primary-300 ring-primary-400/30 bg-primary-500/[0.07]",
  amber: "text-amber-300 ring-amber-400/30 bg-amber-500/[0.07]",
  rose: "text-rose-300 ring-rose-400/30 bg-rose-500/[0.07]",
};

/**
 * Entry point for a hub. It is deliberately its own shell — a slim portal bar
 * over a centred column — rather than a page inside either the site or the hub
 * chrome, so each hub reads as a distinct tool the way the community's other
 * portals do. One component serves both hubs; only the copy and the chips differ.
 */
export default function HubLanding({ hub, chips = STAFF_RANKS, chipNote }) {
  const { user } = useAuth();

  // The site has one Discord sign-in for everything; a hub landing is just an
  // entry to it, never a second login. `configured` gates whether that OAuth is
  // wired on this deployment — when it is not, the button falls back to the
  // community Discord invite so the page is never a dead end.
  const [configured, setConfigured] = useState(true);
  useEffect(() => {
    let active = true;
    api.authConfig().then((cfg) => active && setConfigured(Boolean(cfg?.configured)));
    return () => {
      active = false;
    };
  }, []);

  const authenticated = Boolean(user?.authenticated);
  const enterTo = `${hub.base}/home`;
  const enterLabel = `Enter ${hub.name === "Staff Hub" ? "Hub" : hub.name}`;
  const signInHref = configured ? loginUrl(enterTo) : SITE.discordInvite;
  const signInProps = configured ? {} : { target: "_blank", rel: "noreferrer noopener" };

  return (
    <div className="landing-bg flex min-h-screen flex-col">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#0a0e1a]/80 px-4 backdrop-blur-xl sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-3" title="Back to the main site">
          <Logo />
          <span className="hidden h-6 w-px bg-white/10 sm:block" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">
            Florida <span className="text-primary-500">Roleplay</span>
          </p>
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-brand-400">
            {hub.name}
          </p>
        </div>

        {authenticated ? (
          <Button as={Link} to={enterTo} variant="secondary" size="sm" className="ml-auto shrink-0">
            {enterLabel}
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            as="a"
            href={signInHref}
            {...signInProps}
            variant="discord"
            size="sm"
            className="ml-auto shrink-0"
          >
            <FaDiscord className="size-4" />
            Sign in
          </Button>
        )}
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-xl text-center">
          <div className="flex justify-center">
            <HubBrandMark className="animate-fade-up" />
          </div>

          <p className="animate-fade-up delay-100 mt-8 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary-400 ring-1 ring-inset ring-primary-400/40">
            <Zap className="size-3.5" />
            {hub.eyebrow}
          </p>

          <h1 className="animate-fade-up delay-100 mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Florida Roleplay
          </h1>
          <p className="animate-fade-up delay-100 mt-1 text-2xl font-extrabold tracking-tight text-brand-400 sm:text-3xl">
            {hub.tagline}
          </p>

          <p className="animate-fade-up delay-200 mx-auto mt-5 max-w-md text-slate-400">
            {hub.description}
          </p>

          <div className="animate-fade-up delay-300 mt-8 space-y-3">
            {authenticated ? (
              <Button as={Link} to={enterTo} variant="primary" size="lg" block>
                {enterLabel}
                <ArrowRight className="size-5" />
              </Button>
            ) : (
              <Button as="a" href={signInHref} {...signInProps} variant="discord" size="lg" block>
                <FaDiscord className="size-5" />
                Sign in with Discord
              </Button>
            )}
          </div>

          <p className="animate-fade-up delay-300 mt-4 text-sm text-slate-500">
            {authenticated
              ? "You're signed in — the hub opens to whatever your Discord roles grant."
              : "One Discord sign-in covers the whole site; your roles decide what opens."}
          </p>

          <div className="animate-fade-up delay-400 mt-9 flex flex-wrap justify-center gap-2">
            {chips.map((chip) => (
              <span
                key={chip.id}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ring-1 ring-inset",
                  CHIP_TONES[chip.tone] ?? CHIP_TONES.slate,
                )}
              >
                <span className="size-2.5 rounded-[3px] bg-current" />
                {chip.label}
              </span>
            ))}
          </div>
          {chipNote && (
            <p className="animate-fade-up delay-400 mt-3 text-xs text-slate-600">
              {chipNote}
            </p>
          )}

          <SocialLinks className="mt-12" />
        </div>
      </main>
    </div>
  );
}
