import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ExternalLink, Menu } from "lucide-react";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Logo from "../layout/Logo";
import NavDropdown from "../layout/NavDropdown";
import UserChip from "../layout/UserChip";
import HubDrawer from "./HubDrawer";
import { useAuth } from "../../context/useAuth";
import { hubIcon } from "../../lib/hubIcons";
import { PREVIEW_RANKS } from "../../data/mockData";
import { cn } from "../../lib/cn";

/** Vertical hairline separating the bar's regions, as on the public site. */
function Divider() {
  return <span className="h-6 w-px shrink-0 bg-white/10" aria-hidden="true" />;
}

/**
 * Top navigation for a hub, built in the public site's idiom: full-width and
 * sticky, brand on the left, colour-coded group dropdowns in the middle, and the
 * current rank plus the user chip on the right. Below the `hub` breakpoint it
 * collapses into the same right-hand drawer the public site uses.
 *
 * Groups whose every entry the current rank cannot open are dropped rather than
 * rendered as dead ends; the route gate and the API still enforce the roles.
 */
export default function HubTopBar({ hub }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(
    () => typeof window !== "undefined" && window.scrollY > 8,
  );
  const location = useLocation();
  const { user, hasPermission, loading, previewRank } = useAuth();

  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const groups = hub.groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => loading || hasPermission(item.permission),
      ),
    }))
    .filter((group) => group.items.length > 0);

  const rank =
    PREVIEW_RANKS.find((r) => r.id === previewRank)?.label ?? user?.rank ?? null;

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 h-16 border-b transition-colors duration-300",
          scrolled
            ? "border-white/[0.06] bg-[#0a0e1a]/80 backdrop-blur-xl"
            : "border-white/[0.06] bg-[#0a0e1a]/60 backdrop-blur-xl",
        )}
      >
        <div className="flex h-full items-center gap-3 px-4 sm:px-6 lg:px-8">
          {/* Brand — links back to the hub's own landing page. */}
          <Link to={hub.base} className="flex shrink-0 items-center gap-2.5">
            <Logo />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-extrabold leading-tight tracking-[-0.3px] text-white">
                Florida <span className="text-primary-500">Roleplay</span>
              </span>
              <span className="block truncate text-[10px] font-bold uppercase leading-tight tracking-[0.16em] text-brand-400">
                {hub.name}
              </span>
            </span>
          </Link>

          {/* Colour-coded group dropdowns */}
          <nav className="hidden flex-1 items-center justify-center gap-3 hub:flex">
            <Divider />
            {groups.map((group, index) => (
              <div key={group.id} className="flex items-center gap-3">
                {index > 0 && <Divider />}
                <NavDropdown
                  label={group.label}
                  tone={group.tone}
                  items={group.items}
                  resolveIcon={hubIcon}
                />
              </div>
            ))}
            <Divider />
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 hub:ml-3">
            {/* Wrapped rather than given `hidden` classes of their own: Badge
                sets `inline-flex` in its base, and utility order in the
                stylesheet — not in the attribute — would decide the winner. */}
            {previewRank && (
              <span className="hidden md:block">
                <Badge tone="primary" dot>
                  Preview
                </Badge>
              </span>
            )}
            {rank && (
              <span className="hidden sm:block">
                <Badge tone="brand">{rank}</Badge>
              </span>
            )}

            <span className="hidden lg:block">
              <Button as={Link} to="/" variant="ghost" size="sm">
                Main site
                <ExternalLink className="size-4" />
              </Button>
            </span>

            <UserChip />

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              className="grid size-9 place-items-center rounded-xl text-slate-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-white hub:hidden"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <HubDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        hub={hub}
        groups={groups}
      />
    </>
  );
}
