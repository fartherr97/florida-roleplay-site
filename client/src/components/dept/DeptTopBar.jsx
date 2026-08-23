import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Menu } from "lucide-react";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import NavDropdown from "../layout/NavDropdown";
import UserChip from "../layout/UserChip";
import DeptDrawer from "./DeptDrawer";
import DeptBrandMark from "./DeptBrandMark";
import { hubIcon } from "../../lib/hubIcons";
import { cn } from "../../lib/cn";

/** NavDropdown takes its colours as class names; the department's accent is a
 *  CSS variable, so both slots point at the utilities in src/index.css. */
const ACCENT_TONE = { text: "dept-accent-text", tile: "dept-accent-tile" };

/**
 * Top navigation for a department site, in the same idiom as the staff and
 * civilian hubs — sticky, brand on the left, group dropdowns in the middle, user
 * chip on the right. The difference is that nothing here is hardcoded: the
 * groups, their pages and the accent all come from the department's config, so
 * one component serves every department.
 */
export default function DeptTopBar({ config, base, groups, saveState, saveMessage }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(
    () => typeof window !== "undefined" && window.scrollY > 8,
  );
  const location = useLocation();

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

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 h-16 border-b border-white/[0.06] backdrop-blur-xl transition-colors duration-300",
          scrolled ? "bg-[#0a0e1a]/80" : "bg-[#0a0e1a]/60",
        )}
      >
        <div className="flex h-full items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link to={base} className="flex min-w-0 shrink-0 items-center gap-2.5">
            <DeptBrandMark config={config} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-extrabold leading-tight tracking-[-0.3px] text-white">
                {config.branding.shortName}
              </span>
              <span className="dept-accent-text block truncate text-[10px] font-bold uppercase leading-tight tracking-[0.16em]">
                {config.branding.tagline}
              </span>
            </span>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-3 hub:flex">
            <span className="h-6 w-px shrink-0 bg-white/10" aria-hidden="true" />
            {groups.map((group, index) => (
              <div key={group.id} className="flex items-center gap-3">
                {index > 0 && <span className="h-6 w-px shrink-0 bg-white/10" aria-hidden="true" />}
                <NavDropdown
                  label={group.label}
                  tone={ACCENT_TONE}
                  items={group.pages.map((page) => ({
                    to: `${base}/${page.id}`,
                    label: page.label,
                    icon: page.icon,
                  }))}
                  resolveIcon={hubIcon}
                />
              </div>
            ))}
            <span className="h-6 w-px shrink-0 bg-white/10" aria-hidden="true" />
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 hub:ml-3">
            {/* Wrapped rather than given `hidden` classes of their own: Badge and
                Button set `inline-flex` in their base, and utility order in the
                stylesheet — not in the attribute — would decide the winner. */}
            {saveState !== "idle" && (
              <span className="hidden md:block" title={saveMessage || undefined}>
                <Badge tone={SAVE_TONES[saveState]} dot={saveState === "saving"}>
                  {SAVE_LABELS[saveState]}
                </Badge>
              </span>
            )}

            <span className="hidden lg:block">
              <Button as={Link} to="/departments" variant="ghost" size="sm">
                <ArrowLeft className="size-4" />
                Departments
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

      <DeptDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        config={config}
        base={base}
        groups={groups}
      />
    </>
  );
}

const SAVE_LABELS = { saving: "Saving", saved: "Saved", error: "Not saved" };
const SAVE_TONES = { saving: "amber", saved: "green", error: "rose" };
