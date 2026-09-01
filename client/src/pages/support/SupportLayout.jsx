import { createElement, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  BookText,
  Home,
  Inbox,
  LayoutList,
  LifeBuoy,
  LogOut,
  Menu,
  Plus,
  SlidersHorizontal,
  UserCheck,
  Webhook,
  Workflow,
  X,
} from "lucide-react";
import Button from "../../components/ui/Button";
import { SupportConfigProvider } from "../../context/SupportConfigContext";
import { useSupportConfig } from "../../context/useSupportConfig";
import { useAuth } from "../../context/useAuth";
import { cn } from "../../lib/cn";

/**
 * Wraps every support screen in the ticket-category provider, and gives the
 * portal its own chrome: a slim toolbar with a menu button, and a slide-out
 * drawer that navigates the whole portal from one place — the member's own
 * tickets, the agent queues, and the staff tools, each shown only to whoever
 * may reach it. The catalogue is loaded once here and shared, rather than
 * fetched per page.
 */
export default function SupportLayout() {
  return (
    <SupportConfigProvider>
      <SupportChrome />
      <Outlet />
    </SupportConfigProvider>
  );
}

function SupportChrome() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Signed out, the pages themselves show the access screen — the portal chrome
  // would only be a menu to places that would all bounce them.
  if (!user) return null;

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 pb-2 pt-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open the support menu"
          className="inline-flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-white"
        >
          <Menu className="size-4" />
          Menu
        </button>
        <Link to="/support" className="flex items-center gap-2 text-sm font-bold text-white">
          <LifeBuoy className="size-4 text-primary-400" />
          <span className="hidden sm:inline">Support Portal</span>
        </Link>
        <Button as={Link} to="/support/new" size="sm" className="ml-auto">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Create Ticket</span>
        </Button>
      </div>

      <SupportDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function SupportDrawer({ open, onClose }) {
  const { user, hasPermission, signOut, previewRank } = useAuth();
  const { types, canConfigure } = useSupportConfig();
  const location = useLocation();

  // An agent is anyone who works tickets rather than only raising them: the
  // central team, or anyone holding a department's work permission.
  const isAgent = useMemo(() => {
    if (hasPermission("support.work") || hasPermission("support.manage")) return true;
    return (types ?? []).some((t) => (t.workPermissions ?? []).some((p) => hasPermission(p)));
  }, [types, hasPermission]);
  const isLead = hasPermission("support.manage");
  const canWebhooks = hasPermission("support.webhooks");

  // Close on navigation and on Escape; lock the page behind the scrim.
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const rank = user?.rank ?? (previewRank ? String(previewRank) : null);
  const access = isLead ? "Manager access" : isAgent ? "Agent access" : "Member access";

  const initials = (user?.displayName || user?.username || "?")
    .split(/[\s.]+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Support menu"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-y-0 left-0 flex w-[19rem] max-w-[85vw] flex-col border-r border-white/[0.08] bg-[#0b0f1c] shadow-[0_0_80px_-10px_rgba(0,0,0,0.9)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
              <span className="flex items-center gap-2 text-sm font-black tracking-tight text-white">
                <LifeBuoy className="size-5 text-primary-400" />
                FLRP Support
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close the support menu"
                className="grid size-8 place-items-center rounded-lg text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-5">
              <DrawerSection title="Tickets">
                <DrawerLink to="/support" end icon={Inbox} label="My tickets" />
                <DrawerLink to="/support/new" icon={Plus} label="Create ticket" />
              </DrawerSection>

              {isAgent && (
                <DrawerSection title="Queues">
                  <DrawerLink to="/support/queue" icon={LayoutList} label="Ticket queues" />
                  <DrawerLink to="/support/queue?tab=mine" icon={UserCheck} label="My assigned" />
                  <DrawerLink to="/support/queue?tab=archived" icon={Archive} label="Archived tickets" />
                </DrawerSection>
              )}

              {(isLead || canConfigure || canWebhooks) && (
                <DrawerSection title="Staff tools">
                  {isLead && <DrawerLink to="/support/flows" icon={Workflow} label="Response flows" />}
                  {canConfigure && (
                    <DrawerLink to="/support/types" icon={SlidersHorizontal} label="Ticket categories" />
                  )}
                  {canWebhooks && (
                    <DrawerLink to="/support/webhooks" icon={Webhook} label="Ticket webhooks" />
                  )}
                </DrawerSection>
              )}

              <DrawerSection title="Useful links">
                <DrawerLink to="/rules" icon={BookText} label="Rules" />
                <DrawerLink to="/" end icon={Home} label="Main site" />
              </DrawerSection>
            </nav>

            <div className="border-t border-white/[0.06] p-3">
              <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5 ring-1 ring-inset ring-white/[0.06]">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="size-9 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-500/20 text-xs font-bold text-primary-300">
                    {initials}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {user?.displayName || user?.username}
                  </p>
                  <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-primary-400">
                    {rank ? `${rank} · ${access}` : access}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  onClose();
                  await signOut();
                }}
                className="mt-2 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-rose-500/10 hover:text-rose-200"
              >
                <LogOut className="size-4 text-slate-500" />
                Sign out
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function DrawerSection({ title, children }) {
  return (
    <div>
      <p className="px-3 pb-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-slate-600">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

/**
 * A drawer row. Active is computed by hand rather than left to NavLink, because
 * the queue rows differ only by their `?tab=` — NavLink ignores the query and
 * would light all three up at once on the queue page.
 */
function DrawerLink({ to, icon, label, end = false }) {
  const location = useLocation();
  const target = new URL(to, "http://x");
  const path = target.pathname;
  const onPath = end ? location.pathname === path : location.pathname === path || location.pathname.startsWith(`${path}/`);

  let active = onPath;
  if (onPath && path === "/support/queue") {
    const wantTab = target.searchParams.get("tab") ?? "all";
    const haveTab = new URLSearchParams(location.search).get("tab") ?? "all";
    active = wantTab === haveTab;
  }

  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
        active
          ? "bg-brand-500/15 text-white ring-1 ring-inset ring-brand-400/30"
          : "text-slate-300 hover:bg-white/[0.05] hover:text-white",
      )}
    >
      {createElement(icon, { className: cn("size-4 shrink-0", active ? "text-brand-300" : "text-slate-400") })}
      {label}
    </Link>
  );
}
