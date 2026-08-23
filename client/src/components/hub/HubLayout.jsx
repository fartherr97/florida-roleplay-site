import { useEffect, useState } from "react";
import { Link, useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import HubSidebar from "./HubSidebar";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import RequireRole from "../auth/RequireRole";
import { useAuth } from "../../context/useAuth";
import { guardFor } from "../../lib/guards";
import { STAFF_RANKS } from "../../data/mockData";

/**
 * Shell for every page inside the Staff Hub: a fixed sidebar on `lg` and up, a
 * slide-in drawer below it, and a slim bar carrying the current rank. The public
 * site's TopBar and Footer are deliberately absent — the hub is its own tool.
 *
 * Rank gating is applied here around the whole shell, the same way PublicLayout
 * does it, so a denial replaces the sidebar and bar with the Access Denied page
 * at the requested URL instead of rendering inside a hub the user cannot use.
 */
export default function HubLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const outlet = useOutlet();
  const { user, previewRank } = useAuth();

  const rank = STAFF_RANKS.find((r) => r.id === previewRank);
  const rankLabel = rank?.label ?? user?.rank ?? "Staff";

  // Lock page scroll behind the drawer.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setDrawerOpen(false);
  }

  const guard = guardFor(location.pathname);

  return (
    <RequireRole roles={guard?.roles ?? []} reason={guard?.reason}>
        <div className="landing-bg min-h-screen lg:flex">
        {/* Fixed sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-white/[0.06] bg-[#0a0e1a]/70 backdrop-blur-xl lg:sticky lg:top-0 lg:block lg:h-screen">
          <HubSidebar />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#0a0e1a]/80 px-4 backdrop-blur-xl sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open hub navigation"
              aria-expanded={drawerOpen}
              className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
            >
              <Menu className="size-5" />
            </button>

            <Link to="/staff-hub" className="min-w-0 lg:hidden">
              <span className="block truncate text-sm font-bold text-white">
                Staff Hub
              </span>
            </Link>

            <div className="ml-auto flex shrink-0 items-center gap-3">
              {previewRank && (
                <Badge tone="primary" dot className="hidden sm:inline-flex">
                  Preview
                </Badge>
              )}
              <Badge tone="brand">{rankLabel}</Badge>
              <Button as={Link} to="/staff-hub" variant="ghost" size="sm">
                Portal
              </Button>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-x-clip px-4 py-8 sm:px-6 lg:px-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="mx-auto w-full max-w-6xl"
              >
                {outlet}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Drawer below lg */}
        <AnimatePresence>
          {drawerOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setDrawerOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                className="absolute left-0 top-0 h-full w-72 border-r border-white/[0.06] bg-[#0a0e1a]"
              >
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close hub navigation"
                  className="absolute right-3 top-3.5 z-10 grid size-8 place-items-center rounded-lg text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <X className="size-4" />
                </button>
                <HubSidebar onNavigate={() => setDrawerOpen(false)} />
              </motion.aside>
            </div>
          )}
        </AnimatePresence>
      </div>
    </RequireRole>
  );
}
