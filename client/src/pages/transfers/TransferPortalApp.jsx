// ─────────────────────────────────────────────────────────────────────────────
// ES Transfer Portal — Main Application
//
// A port of github.com/fartherr97/es-transfer-portal (app/page.jsx), branded for
// Florida Roleplay. The original is a single-page React app rendered by the
// Next.js App Router; this is the same app rendered by React Router at
// /transfers, talking to the /api/transfers router instead of Next route
// handlers.
//
// High-level structure, unchanged from the original:
//   Config        — portalConfig.js: departments, ranks, status labels, tabs
//   Utils         — portalUtils.js: api fetch, dates, initials
//   Toast System  — portalPrimitives.jsx (provider) + usePortalToast.js (hook)
//   Primitives    — portalPrimitives.jsx: Btn, Input, Avatar, badges
//   Components    — this file: ProfilePill, TopBar, LandingPage
//   Tab Views     — PortalTabs.jsx: Overview, Request, Queue, Analytics, Settings
//   Ticket View   — TicketView.jsx: actions, chat, history
//   Portal View   — this file: renders the active tab
//   Root          — this file: the landing → portal → ticket state machine
//
// It keeps its own top bar and footer rather than sitting inside the site
// chrome, exactly as upstream — the same shape the department hubs already
// take here. "Main site" in the profile menu is the way back out.
//
// Three things differ from upstream, all forced by the move:
//   • Identity comes from this site's auth context, mapped to the original's
//     session shape by sessionFrom() — not from its own Discord OAuth.
//   • next/image is gone, and there is no per-department artwork yet, so
//     DeptLogo falls back to a coloured abbreviation tile.
//   • The view state lives in the URL (/transfers, /transfers/queue,
//     /transfers/t/TR-123) rather than in useState alone, so a ticket link can
//     be pasted to a department head and the browser Back button works.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Plus,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { SITE } from "../../data/mockData";
import { DEPTS, PORTAL_TABS, ds, isStaffUser, sessionFrom } from "./portalConfig";
import {
  Avatar,
  DeptLogo,
  ToastProvider,
} from "./portalPrimitives";
import { useToast } from "./usePortalToast";
import {
  AnalyticsTab,
  MyTransfersView,
  OverviewTab,
  QueueTab,
  RequestTab,
  SettingsTab,
} from "./PortalTabs";
import TicketView from "./TicketView";

/* ─── Profile Pill ─────────────────────────────────────────────────────────── */

function ProfilePill({ user, onMyTransfers, onPortal }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-all duration-200 hover:border-white/15"
        style={{ backgroundColor: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
      >
        <Avatar name={user.displayName} src={user.avatar} size="sm" />
        <div className="hidden text-left sm:block">
          <p className="font-display text-xs font-bold leading-none text-white">
            {user.displayName}
          </p>
          <p className="mt-0.5 text-[10px] leading-none" style={{ color: "var(--color-primary)" }}>
            {roleLabel(user) ?? "Transferee"}
          </p>
        </div>
        <ChevronDown
          className={`size-3.5 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-52 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border py-1 shadow-2xl shadow-black/50"
          style={{ backgroundColor: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
        >
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-sky-500 to-transparent" />
          <div className="py-1">
            <DropItem
              icon={<ListChecks className="size-4" strokeWidth={1.5} />}
              label="My Transfer Requests"
              onClick={() => {
                onMyTransfers();
                setOpen(false);
              }}
            />
            <DropItem
              icon={<Plus className="size-4" strokeWidth={1.5} />}
              label="Submit New Transfer"
              onClick={() => {
                onPortal("request");
                setOpen(false);
              }}
            />
            {isStaffUser(user) && (
              <DropItem
                icon={<LayoutDashboard className="size-4" strokeWidth={1.5} />}
                label="Management Portal"
                onClick={() => {
                  onPortal("overview");
                  setOpen(false);
                }}
              />
            )}
          </div>
          {/* Upstream signs you out of the portal here, because the portal owns
              its own session. This one shares the site's, so the honest exit is
              back to the site rather than a sign-out that would take the whole
              site with it. */}
          <div className="border-t pt-1" style={{ borderColor: "var(--color-border)" }}>
            <DropItem
              as={Link}
              to="/"
              icon={<LogOut className="size-4" strokeWidth={1.5} />}
              label="Back to the main site"
              onClick={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function roleLabel(u) {
  if (u?.isManagement) return "Directorship";
  if (u?.isDeptHead) return "Department Head";
  return null;
}

function DropItem({ icon, label, onClick, danger, as: Tag = "button", to }) {
  return (
    <Tag
      type={Tag === "button" ? "button" : undefined}
      to={to}
      role="menuitem"
      onClick={onClick}
      className={`group relative flex w-full items-center gap-3 border-l-2 px-4 py-2.5 text-sm transition-all duration-150 hover:-translate-y-px hover:bg-white/5
        ${
          danger
            ? "border-transparent text-rose-400 hover:border-rose-500"
            : "border-transparent text-slate-300 hover:border-sky-500 hover:text-white"
        }`}
    >
      <span
        className={
          danger
            ? "text-rose-400"
            : "text-slate-500 transition-colors duration-150 group-hover:text-sky-400"
        }
      >
        {icon}
      </span>
      {label}
    </Tag>
  );
}

/* ─── Top Bar ──────────────────────────────────────────────────────────────── */

function TopBar({ view, portalTab, setPortalTab, user, onMyTransfers, onPortal, onHome }) {
  // Staff get the full portal tab nav; transferees only ever submit, so they
  // see a simple breadcrumb instead.
  const isPortal = view === "portal" && isStaffUser(user);

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md"
      style={{ backgroundColor: "rgba(10, 14, 26, 0.9)", borderColor: "var(--color-border)" }}
    >
      <div className="mx-auto flex max-w-6xl items-stretch px-4 sm:px-6">
        {/* Brand */}
        <button
          type="button"
          onClick={onHome}
          className="flex shrink-0 items-center gap-2.5 py-3 pr-3 transition-opacity hover:opacity-80 sm:pr-5"
        >
          <img
            src={SITE.logoUrl}
            alt=""
            width={34}
            height={34}
            className="size-[34px] shrink-0 object-contain sm:size-[38px]"
          />
          <p className="font-display hidden whitespace-nowrap text-[15px] font-bold text-white sm:block">
            Florida <span style={{ color: "var(--color-primary)" }}>Roleplay</span>
          </p>
        </button>

        {/* Divider */}
        <div className="my-3 w-px shrink-0" style={{ backgroundColor: "var(--color-border)" }} />

        {/* Nav: tabs when in portal, breadcrumb otherwise */}
        <div className="flex flex-1 items-center overflow-hidden">
          {isPortal ? (
            <nav className="flex h-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {PORTAL_TABS.filter((t) => !t.managementOnly || user?.isManagement).map(
                ({ id, label }) => {
                  const active = portalTab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPortalTab(id)}
                      className={`nav-tab shrink-0 whitespace-nowrap px-3 py-3 text-xs font-semibold transition-colors duration-200 sm:px-5 sm:text-sm ${active ? "nav-active" : "text-slate-400 hover:text-slate-100"}`}
                      style={active ? { color: "#3b82f6" } : {}}
                    >
                      {label}
                    </button>
                  );
                },
              )}
            </nav>
          ) : (
            <p className="truncate px-3 text-xs text-slate-500 sm:px-5 sm:text-sm">
              {view === "my-transfers"
                ? "My Transfer Requests"
                : view === "ticket"
                  ? "Transfer Ticket"
                  : view === "portal"
                    ? "Submit Transfer"
                    : "ES Transfer Portal"}
            </p>
          )}
        </div>

        {/* Right: connect or profile */}
        <div className="flex items-center gap-2 py-2 pl-2 sm:pl-4">
          {user ? (
            <ProfilePill user={user} onMyTransfers={onMyTransfers} onPortal={onPortal} />
          ) : (
            <SignInBtn label="Connect" />
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Upstream's Discord connect button.
 *
 * It links at this site's sign-in rather than carrying a second OAuth flow of
 * its own — one portal with its own idea of who you are is how somebody ends up
 * signed in on the site and anonymous here.
 */
function SignInBtn({ label = "Sign in with Discord", className = "" }) {
  return (
    <Link
      to="/sign-in"
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-px hover:shadow-lg sm:py-2 ${className}`}
      style={{ backgroundColor: "#5865f2" }}
    >
      <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
      </svg>
      {label}
    </Link>
  );
}

/* ─── Landing Page ─────────────────────────────────────────────────────────── */

function LandingPage({ user, onSubmit, onPortal }) {
  return (
    <div className="landing-bg flex min-h-[calc(100vh-53px)] flex-col items-center justify-center px-4 py-20">
      <div className="flex w-full max-w-3xl flex-col items-center text-center">
        {/* Logo */}
        <div className="animate-fade-up">
          <div className="relative inline-block">
            <img
              src={SITE.logoUrl}
              alt=""
              width={120}
              height={120}
              className="animate-float relative size-[120px] object-contain drop-shadow-2xl"
            />
          </div>
        </div>

        {/* Badge pill */}
        <div className="animate-fade-up delay-100 mt-6">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest sm:px-3.5 sm:text-[11px]"
            style={{
              backgroundColor: "rgba(242,128,13,0.1)",
              borderColor: "rgba(242,128,13,0.3)",
              color: "var(--color-primary)",
            }}
          >
            <Zap className="size-3 shrink-0" strokeWidth={2} fill="currentColor" />
            Emergency Services Transfer Portal
          </span>
        </div>

        {/* Heading */}
        <h1 className="animate-fade-up delay-200 font-display mt-6 leading-tight tracking-tight">
          <span className="block text-3xl font-semibold text-slate-200 sm:text-4xl lg:text-5xl">
            Florida Roleplay
          </span>
          <span className="mt-1 block text-xl font-bold text-sky-400 sm:text-2xl lg:text-3xl">
            Emergency Services Transfer Portal
          </span>
        </h1>

        {/* Subtitle */}
        <p className="animate-fade-up delay-300 mt-4 max-w-md px-2 text-sm leading-relaxed text-slate-400 sm:mt-5 sm:px-0 sm:text-[15px]">
          Submit and track inter-department transfer requests across{" "}
          {Object.keys(DEPTS).slice(0, -1).join(", ")} and {Object.keys(DEPTS).slice(-1)}.
        </p>

        {/* CTAs */}
        <div className="animate-fade-up delay-400 mt-7 flex w-full flex-col items-center gap-3 px-2 sm:mt-8 sm:flex-row sm:flex-wrap sm:justify-center sm:px-0">
          {user ? (
            <button
              type="button"
              onClick={onSubmit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-px hover:shadow-xl sm:w-auto"
              style={{
                backgroundColor: "var(--color-primary)",
                boxShadow: "0 4px 24px rgba(242,128,13,0.3)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-primary)";
              }}
            >
              <Plus className="size-4" strokeWidth={2} />
              Submit Transfer Request
            </button>
          ) : (
            <div className="w-full sm:w-auto">
              <SignInBtn label="Sign in to Submit" className="w-full justify-center" />
            </div>
          )}

          <button
            type="button"
            onClick={onPortal}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-6 py-3 text-sm font-bold text-slate-200 transition-all duration-200 hover:-translate-y-px hover:border-white/20 hover:text-white sm:w-auto"
            style={{ backgroundColor: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
          >
            Enter Portal
            <ArrowRight className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Dept badges */}
        <div className="animate-fade-up delay-400 mt-12 flex flex-wrap justify-center gap-2">
          {Object.entries(DEPTS).map(([key, d]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold"
              style={ds(d.color).chip}
            >
              <DeptLogo dept={key} size={14} />
              {key}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Portal View ──────────────────────────────────────────────────────────── */

function PortalView({ tab, setTab, user, session, onOpenTicket }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
      {tab === "overview" && (
        <OverviewTab onNavigate={setTab} onOpenTicket={onOpenTicket} user={user} />
      )}
      {tab === "request" && (
        <RequestTab onOpenTicket={onOpenTicket} isStaff={isStaffUser(user)} session={session} />
      )}
      {tab === "queue" && <QueueTab onOpenTicket={onOpenTicket} user={user} />}
      {tab === "analytics" &&
        (user?.isManagement ? (
          <AnalyticsTab />
        ) : (
          <div className="card p-10 text-center text-sm text-slate-500">
            Analytics is available to Directorship only.
          </div>
        ))}
      {tab === "settings" &&
        (user?.isManagement ? (
          <SettingsTab />
        ) : (
          <div className="card p-10 text-center text-sm text-slate-500">
            Settings is available to Directorship only.
          </div>
        ))}
    </main>
  );
}

/* ─── Root ─────────────────────────────────────────────────────────────────── */

const TAB_IDS = PORTAL_TABS.map((t) => t.id);

export default function TransferPortalApp() {
  return (
    <ToastProvider>
      <PortalRoot />
    </ToastProvider>
  );
}

function PortalRoot() {
  const { user: siteUser, loading } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const toast = useToast();

  // The view comes out of the URL rather than out of useState alone. Upstream
  // holds it in component state, which means a ticket has no address: a
  // department head cannot be sent a link to the one they are being asked about,
  // and Back leaves the portal entirely.
  const ticketId = params.ticketId ?? null;
  const section = params.section ?? null;

  const view = ticketId
    ? "ticket"
    : section === "mine"
      ? "my-transfers"
      : section && TAB_IDS.includes(section)
        ? "portal"
        : "landing";
  const portalTab = TAB_IDS.includes(section) ? section : "overview";

  const session = sessionFrom(siteUser);

  const goPortal = useCallback((tab = "overview") => navigate(`/transfers/${tab}`), [navigate]);
  const goSubmit = useCallback(() => navigate("/transfers/request"), [navigate]);
  const goMine = useCallback(() => navigate("/transfers/mine"), [navigate]);
  const goHome = useCallback(() => navigate("/transfers"), [navigate]);

  const openTicket = useCallback(
    (id) => {
      if (!id) return;
      navigate(`/transfers/t/${encodeURIComponent(id)}`);
    },
    [navigate],
  );

  // Going "back" from a ticket returns staff to the queue, transferees to their list.
  const ticketBack = useCallback(() => {
    if (isStaffUser(session)) goPortal("queue");
    else goMine();
  }, [session, goPortal, goMine]);

  // A section that needs a signed-in caller says so once rather than rendering
  // a screen of empty states behind a bar that says you are connected.
  const needsAuth = view !== "landing" && !loading && !session;
  useEffect(() => {
    if (needsAuth) toast("Sign in with Discord to use the transfer portal.", "info");
  }, [needsAuth, toast]);

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "var(--color-bg)" }}>
      <TopBar
        view={view}
        portalTab={portalTab}
        setPortalTab={goPortal}
        user={session}
        onMyTransfers={goMine}
        onPortal={goPortal}
        onHome={goHome}
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-24 text-sm text-slate-600">
          Loading…
        </div>
      ) : needsAuth ? (
        <main className="mx-auto w-full max-w-md px-4 py-24 text-center">
          <div className="card p-10">
            <p className="font-display font-bold text-white">Sign in to continue</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              The transfer portal reads who you are from your Discord roles — which department you
              are in, and whether you command one.
            </p>
            <div className="mt-6 flex justify-center">
              <SignInBtn />
            </div>
          </div>
        </main>
      ) : (
        <>
          {view === "landing" && (
            <LandingPage
              user={session}
              onSubmit={goSubmit}
              onPortal={() => {
                if (!session) {
                  navigate("/sign-in");
                  return;
                }
                if (isStaffUser(session)) goPortal("overview");
                else goMine();
              }}
            />
          )}

          {view === "portal" && (
            <PortalView
              tab={portalTab}
              setTab={goPortal}
              user={session}
              session={session}
              onOpenTicket={openTicket}
            />
          )}

          {view === "my-transfers" && (
            <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
              <MyTransfersView user={session} onSubmit={goSubmit} onOpenTicket={openTicket} />
            </div>
          )}

          {view === "ticket" && (
            <TicketView ticketId={ticketId} user={session} onBack={ticketBack} />
          )}
        </>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-white/[0.06] px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-1 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <img src={SITE.logoUrl} alt="" width={18} height={18} className="size-[18px] object-contain opacity-70" />
            <span className="text-xs text-slate-600">Florida Roleplay</span>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-700 transition-colors hover:text-slate-400"
          >
            Emergency Services Transfer Portal · Main site
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </footer>
    </div>
  );
}
