import { Suspense, lazy, useMemo } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Footer from "../layout/Footer";
import DeptTopBar from "./DeptTopBar";
import AccessDenied from "../auth/AccessDenied";
import NotFound from "../auth/NotFound";
import RequireRole from "../auth/RequireRole";
import { DeptConfigProvider } from "../../context/DeptConfigContext";
import { useDeptConfig } from "../../context/useDeptConfig";
import { useAuth } from "../../context/useAuth";
import { canOpenPage, navFor, resolvePage, themeVars } from "../../lib/departmentConfig";

import DeptHome from "../../pages/dept/DeptHome";
import DeptWelcome from "../../pages/dept/DeptWelcome";
import DeptContent from "../../pages/dept/DeptContent";
import DeptRoster from "../../pages/dept/DeptRoster";
import DeptFleet from "../../pages/dept/DeptFleet";
import DeptUniforms from "../../pages/dept/DeptUniforms";
import DeptChain from "../../pages/dept/DeptChain";
import DeptCalendar from "../../pages/dept/DeptCalendar";
import DeptAdminLog from "../../pages/dept/DeptAdminLog";
import DeptActivity from "../../pages/dept/DeptActivity";
import DeptHours from "../../pages/dept/DeptHours";
import DeptAudit from "../../pages/dept/DeptAudit";
import DeptAccess from "../../pages/dept/DeptAccess";

// The Builder Portal is the heaviest page here and only opens for people who can
// manage a department, so it loads on demand rather than riding in the bundle
// every visitor downloads.
const DeptBuilder = lazy(() => import("../../pages/dept/builder/DeptBuilder"));

/**
 * Which component renders each page type. This map is the engine: a page in a
 * config names a type, and that type resolves to one of these. Adding a new kind
 * of page means writing a component, registering it here, and listing it in
 * PAGE_TYPES in src/lib/departmentConfig.js — nothing else in the app changes,
 * and every department gets it at once.
 */
const PAGE_COMPONENTS = {
  home: DeptHome,
  welcome: DeptWelcome,
  content: DeptContent,
  roster: DeptRoster,
  fleet: DeptFleet,
  uniforms: DeptUniforms,
  chain: DeptChain,
  calendar: DeptCalendar,
  adminlog: DeptAdminLog,
  activity: DeptActivity,
  hours: DeptHours,
  audit: DeptAudit,
  access: DeptAccess,
  builder: DeptBuilder,
};

/** Skeleton while the config loads, so a department never flashes empty chrome. */
function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-10 sm:px-6 lg:px-8">
      <div className="h-11 w-72 animate-pulse rounded-2xl bg-white/[0.04]" />
      <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />
    </div>
  );
}

/**
 * The chrome and routing for one department site.
 *
 * Unlike the staff and civilian hubs, whose pages are route table entries, a
 * department's pages come out of its config — so there is one route
 * (/departments/:deptId/hub/:pageId) and this component decides what it renders.
 */
function DeptShellInner() {
  const { pageId } = useParams();
  const { config, loading, error, capabilities, saveState, saveMessage } = useDeptConfig();
  const { user } = useAuth();

  // The effective roles, so a previewed rank sees the same pages the API will
  // serve it rather than the signed-in account's.
  const ctx = useMemo(
    () => ({ capabilities, roleKeys: user?.roles ?? [] }),
    [capabilities, user],
  );

  const groups = useMemo(() => (config ? navFor(config, ctx) : []), [config, ctx]);
  const page = useMemo(
    () => (config ? resolvePage(config, pageId, ctx) : null),
    [config, ctx, pageId],
  );

  if (loading) return <Loading />;
  if (error === "forbidden") return <AccessDenied reason="department" />;
  if (error || !config) return <NotFound />;

  // A page id in the URL that this department does not have is a 404; one it has
  // but the caller may not open is a denial — the distinction matters, because
  // the second becomes reachable the moment their Discord roles change.
  const named = pageId ? config.pages.find((p) => p.id === pageId) : page;
  if (pageId && !named) return <NotFound />;
  if (named && !canOpenPage(named, ctx)) return <AccessDenied reason="department" />;

  const base = `/departments/${config.id}/hub`;
  const Component = named ? PAGE_COMPONENTS[named.type] ?? DeptContent : null;

  return (
    <div
      className="dept-hub hub-shell-gradient flex min-h-full flex-col"
      style={themeVars(config.branding)}
    >
      <DeptTopBar
        config={config}
        base={base}
        groups={groups}
        saveState={saveState}
        saveMessage={saveMessage}
      />
      <main className="flex-1 overflow-x-clip">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={named?.id ?? "empty"}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className={
              // A roster is a dense table with a sidebar beside it; at the
              // site's usual measure the two together leave the table too
              // little room. Every other page type reads better narrow.
              named?.type === "roster"
                ? "mx-auto w-full max-w-[1700px] px-4 py-10 sm:px-6 lg:px-8"
                : "mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
            }
          >
            {Component ? (
              <Suspense fallback={<Loading />}>
                <Component page={named} config={config} />
              </Suspense>
            ) : (
              <p className="text-sm text-slate-400">
                This department has no pages you can open yet.
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}

/**
 * Route element for every department site. `departments.view` gates the hub as a
 * whole — the server enforces it on every endpoint too — and each page inside
 * then applies its own capability rules.
 */
export default function DeptShell() {
  const { deptId } = useParams();
  return (
    <RequireRole permission="departments.view" reason="department">
      <DeptConfigProvider id={deptId}>
        <DeptShellInner />
      </DeptConfigProvider>
    </RequireRole>
  );
}
