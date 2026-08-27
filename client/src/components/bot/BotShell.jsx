import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
import Section from "../layout/Section";
import PageHeader from "../layout/PageHeader";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import BotGate from "./BotGate";
import BotErrorBoundary from "./BotErrorBoundary";
import { useBotAuth } from "../../context/useBotAuth";
import { cn } from "../../lib/cn";

/**
 * Chrome for the bot dashboard.
 *
 * It sits inside the public site's own layout — same top bar, same footer — so
 * it reads as part of the site rather than a second product bolted on. What it
 * adds is its own section nav and the bot session's identity, which is a
 * different session from the site's.
 */
const SECTIONS = [
  { to: "/management/bot", label: "Overview", end: true },
  { to: "/management/bot/rosters", label: "Rosters" },
  { to: "/management/bot/permissions", label: "Permissions" },
  { to: "/management/bot/access", label: "Access" },
  { to: "/management/bot/transfers", label: "Transfers" },
  { to: "/management/bot/servers", label: "Servers" },
  { to: "/management/bot/mappings", label: "Mappings" },
  { to: "/management/bot/webhooks", label: "Webhooks" },
  { to: "/management/bot/sync", label: "Sync" },
  { to: "/management/bot/audit", label: "Audit" },
];

export default function BotShell() {
  const location = useLocation();
  return (
    <BotGate>
      <Section className="max-w-6xl">
        <Header />
        <nav className="mb-8 flex flex-wrap gap-1.5 border-b border-white/[0.06] pb-3">
          {SECTIONS.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              end={section.end}
              className={({ isActive }) =>
                cn(
                  "rounded-xl px-3.5 py-2 text-sm font-semibold transition",
                  isActive
                    ? "bg-primary-500/15 text-primary-300 ring-1 ring-inset ring-primary-400/25"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
                )
              }
            >
              {section.label}
            </NavLink>
          ))}
        </nav>
        <BotErrorBoundary key={location.pathname}>
          <Outlet />
        </BotErrorBoundary>
      </Section>
    </BotGate>
  );
}

function Header() {
  const { user, signOut } = useBotAuth();

  return (
    <PageHeader
      eyebrow="Management"
      title="Bot Dashboard"
      subtitle="Staff permissions, server configuration and the rosters the bot maintains."
      actions={
        <>
          {user && (
            <Badge tone="slate">
              {user.displayName ?? user.username ?? user.discordUserId ?? "Signed in"}
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </>
      }
    />
  );
}
