import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ExternalLink, Menu } from "lucide-react";
import Button from "../ui/Button";
import Logo from "./Logo";
import NavDropdown from "./NavDropdown";
import MobileNav from "./MobileNav";
import UserChip from "./UserChip";
import { navGroups, primaryLinks } from "../../data/navigation";
import { guardFor } from "../../lib/guards";
import { useAuth } from "../../context/useAuth";
import { SITE } from "../../data/mockData";
import { cn } from "../../lib/cn";

/** Vertical hairline separating the bar's regions. */
function Divider() {
  return <span className="h-6 w-px shrink-0 bg-white/10" aria-hidden="true" />;
}

/**
 * The site's full-width sticky navigation. Transparent over the landing hero,
 * fading to frosted navy once the page scrolls. Below the `nav` breakpoint the
 * links and dropdown groups collapse into the drawer, while Connect and the
 * user chip stay put.
 */
export default function TopBar() {
  const [scrolled, setScrolled] = useState(
    () => typeof window !== "undefined" && window.scrollY > 8,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { hasPermission, loading } = useAuth();
  const [lastPath, setLastPath] = useState(location.pathname);

  // Dismiss the drawer on navigation, adjusted during render so the new page
  // never paints with the old drawer still open.
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setDrawerOpen(false);
  }

  // The bar only starts transparent where a full-bleed hero sits behind it.
  const overHero = location.pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Hide destinations the user cannot open, using the same guard table the
  // route gate reads. Convenience only — the server middleware is the actual
  // boundary. While /api/me is still resolving, nothing is hidden, so links
  // never flicker out from under a signed-in user.
  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            const guard = guardFor(item.to);
            return !guard || loading || hasPermission(guard.permission);
          }),
        }))
        .filter((group) => group.items.length > 0),
    [hasPermission, loading],
  );

  const solid = scrolled || !overHero;

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 h-16 transition-colors duration-300",
          solid
            ? "border-b border-white/[0.06] bg-[#0a0e1a]/80 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <div className="flex h-full items-center gap-3 px-4 sm:px-6 lg:px-8">
          {/* 1 — Brand */}
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <Logo />
            <span className="text-[17px] font-extrabold tracking-[-0.3px] text-white">
              Florida <span className="text-primary-500">Roleplay</span>
            </span>
          </Link>

          {/* 2 — Primary links */}
          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-x-3.5 nav:flex">
            {primaryLinks.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="whitespace-nowrap text-[13px] font-medium text-slate-300 transition hover:text-white"
                >
                  {link.label}
                </a>
              ) : (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "relative whitespace-nowrap py-2 text-[13px] font-medium transition",
                      isActive ? "text-white" : "text-slate-300 hover:text-white",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {link.label}
                      {isActive && (
                        <motion.span
                          layoutId="topbar-active-underline"
                          className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-primary-500"
                          transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ),
            )}
          </nav>

          {/* 3/4 — Divider, then the colour-coded dropdown groups */}
          <div className="hidden items-center gap-3 nav:flex">
            <Divider />
            {visibleGroups.map((group, index) => (
              <div key={group.id} className="flex items-center gap-3">
                {index > 0 && <Divider />}
                <NavDropdown
                  label={group.label}
                  tone={group.tone}
                  items={group.items}
                />
              </div>
            ))}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 nav:ml-4">
            {/* 5 — Connect CTA. Wrapped rather than given a `hidden` class of
                its own: Button sets `inline-flex` in its base, and utility
                order in the stylesheet — not in the attribute — would decide
                the winner. The drawer carries a full-width Connect below sm. */}
            <span className="hidden sm:block">
              <Button as="a" href={SITE.fivemConnect} variant="primary" size="sm">
                Connect
                <ExternalLink className="size-4" />
              </Button>
            </span>

            {/* 6 — User chip (or Sign In) */}
            <UserChip />

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              className="grid size-9 place-items-center rounded-xl text-slate-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-white nav:hidden"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <MobileNav
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        primaryLinks={primaryLinks}
        groups={visibleGroups}
      />
    </>
  );
}
