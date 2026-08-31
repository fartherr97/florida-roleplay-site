import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ExternalLink, Menu } from "lucide-react";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Logo from "../layout/Logo";
import NavDropdown from "../layout/NavDropdown";
import UserChip from "../layout/UserChip";
import HubDrawer from "./HubDrawer";
import { useAuth } from "../../context/useAuth";
import { hubIcon } from "../../lib/hubIcons";
import { cn } from "../../lib/cn";

/** The More menu borrows the bar's own palette rather than a group colour. */
const TAB_MENU_TONE = {
  text: "text-slate-300",
  tile: "bg-white/[0.06] text-slate-300 ring-white/10",
};

const TAB_MENU_TONE_ACTIVE = { ...TAB_MENU_TONE, text: "text-white" };

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
  const { user, hasPermission, loading } = useAuth();

  // Shared so only one group dropdown is open at a time (see NavDropdown).
  const [hoverGroup, setHoverGroup] = useState(null);

  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setDrawerOpen(false);
    setHoverGroup(null);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A hub either carries a flat row of tabs or colour-coded group dropdowns.
  // The staff team has enough destinations that a row of tabs reads faster than
  // three menus you have to open to find out what is in them.
  const tabs = (hub.tabs ?? []).filter((tab) => loading || hasPermission(tab.permission));

  // Priority-plus overflow for the flat row.
  //
  // Eleven tabs only fit above about 1900px. Left as a plain scrolling strip,
  // Site Administration was simply absent on a 1440px laptop with nothing to
  // say so — a menu you cannot see is a page nobody opens. So the row measures
  // itself and moves whatever will not fit into a More dropdown.
  const navRef = useRef(null);
  const [layout, setLayout] = useState(null);

  useEffect(() => {
    const el = navRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    // Widths are taken from the first pass, when every tab is still rendered;
    // after that only the available width changes, and re-measuring a truncated
    // row would lose the ones already moved into the menu.
    const measure = () => {
      setLayout((prev) => ({
        avail: el.clientWidth,
        count: tabs.length,
        widths:
          prev?.count === tabs.length
            ? prev.widths
            : [...el.querySelectorAll("[data-tab]")].map((node) => node.getBoundingClientRect().width),
      }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [tabs.length]);

  // How many tabs fit, leaving room for the More trigger when one is needed.
  const visibleCount = useMemo(() => {
    if (!layout || layout.widths.length !== tabs.length) return tabs.length;
    const GAP = 4;
    const MORE = 76;
    const total = layout.widths.reduce((sum, w) => sum + w + GAP, 0);
    if (total <= layout.avail) return tabs.length;
    let used = MORE;
    let count = 0;
    for (const width of layout.widths) {
      used += width + GAP;
      if (used > layout.avail) break;
      count += 1;
    }
    // One lonely tab beside a More button reads worse than the menu alone.
    return count < 2 ? 0 : count;
  }, [layout, tabs.length]);

  const shownTabs = tabs.slice(0, visibleCount);
  const overflowTabs = tabs.slice(visibleCount);
  const overflowActive = overflowTabs.some((tab) => location.pathname.startsWith(tab.to));

  const groups = (hub.groups ?? [])
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => loading || hasPermission(item.permission),
      ),
    }))
    .filter((group) => group.items.length > 0);

  const rank = user?.rank ?? null;

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

          {/* Colour-coded group dropdowns, sitting against the brand rather than
              centred. A hub carries only two or three groups, and centring that
              few left them stranded mid-bar with the brand far off to one side.
              The trailing divider goes with the centring: left-aligned, it would
              have hung off the last group with nothing after it. */}
          {hub.flat ? (
            /* A flat tab row. It never wraps — the bar is a fixed height and a
               second line of tabs would push the page down every time the
               window narrowed a little — so what will not fit goes into More. */
            <nav
              ref={navRef}
              className="hidden min-w-0 flex-1 items-center gap-1 hub:flex"
            >
              {shownTabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  data-tab
                  className={({ isActive }) =>
                    cn(
                      "relative whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-medium transition",
                      isActive
                        ? "text-white"
                        : tab.accent
                          ? "text-primary-400 hover:text-primary-300"
                          : "text-slate-300 hover:text-white",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {tab.label}
                      {isActive && (
                        <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary-500" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}

              {overflowTabs.length > 0 && (
                <span className="relative ml-1 shrink-0 px-2">
                  <NavDropdown
                    label="More"
                    // The trigger carries the active state when the current page
                    // is one of the tabs inside it, so the bar never looks like
                    // nothing at all is selected.
                    tone={overflowActive ? TAB_MENU_TONE_ACTIVE : TAB_MENU_TONE}
                    items={overflowTabs}
                    resolveIcon={hubIcon}
                    groupId="more"
                    hoverGroup={hoverGroup}
                    onHover={setHoverGroup}
                  />
                  {overflowActive && (
                    <span className="absolute inset-x-2 -bottom-1.5 h-0.5 rounded-full bg-primary-500" />
                  )}
                </span>
              )}
            </nav>
          ) : (
            <nav className="hidden min-w-0 flex-1 items-center justify-start gap-3 hub:flex">
              <Divider />
              {groups.map((group, index) => (
                <div key={group.id} className="flex items-center gap-3">
                  {index > 0 && <Divider />}
                  <NavDropdown
                    label={group.label}
                    tone={group.tone}
                    items={group.items}
                    resolveIcon={hubIcon}
                    groupId={group.id}
                    hoverGroup={hoverGroup}
                    onHover={setHoverGroup}
                  />
                </div>
              ))}
            </nav>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 hub:ml-3">
            {/* Wrapped rather than given `hidden` classes of their own: Badge
                sets `inline-flex` in its base, and utility order in the
                stylesheet — not in the attribute — would decide the winner. */}
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

      {/* The drawer only knows about groups, so a flat hub hands it one made
          from its tabs — otherwise the mobile menu would be empty. */}
      <HubDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        hub={hub}
        groups={
          hub.flat
            ? [{ id: "tabs", label: hub.name, tone: hub.tone ?? {}, items: tabs }]
            : groups
        }
      />
    </>
  );
}
