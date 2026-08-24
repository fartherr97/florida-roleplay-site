import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import PublicLayout from "./components/layout/PublicLayout";
import AccessDenied from "./components/auth/AccessDenied";
import NotFound from "./components/auth/NotFound";
import { AuthProvider } from "./context/AuthContext";
import { BotAuthProvider } from "./context/BotAuthContext";

import Landing from "./pages/Landing";
import Rules from "./pages/Rules";
import Applications from "./pages/Applications";
import ApplicationForm from "./pages/ApplicationForm";
import Departments from "./pages/Departments";
import DepartmentDetail from "./pages/DepartmentDetail";
import Store from "./pages/Store";
import Supporters from "./pages/Supporters";
import KnowledgeBase from "./pages/KnowledgeBase";
import Article from "./pages/Article";
import Events from "./pages/Events";
import Reports from "./pages/Reports";
import Staff from "./pages/Staff";
import Join from "./pages/Join";
import PatchNotes from "./pages/PatchNotes";
import SignIn from "./pages/SignIn";
import CreateAccount from "./pages/CreateAccount";
import HubShell from "./components/hub/HubShell";
import DeptShell from "./components/dept/DeptShell";
import ApplyIndex from "./pages/apply/ApplyIndex";
import ApplyForm from "./pages/apply/ApplyForm";
import ApplySubmitted from "./pages/apply/ApplySubmitted";
import ApplyManage from "./pages/apply/ApplyManage";
import ApplyBuilder from "./pages/apply/ApplyBuilder";
import ApplyReview from "./pages/apply/ApplyReview";
import TransferPortal from "./pages/transfers/TransferPortal";
import TransferNew from "./pages/transfers/TransferNew";
import TransferTicket from "./pages/transfers/TransferTicket";
import TransferSettings from "./pages/transfers/TransferSettings";
import SupportHome from "./pages/support/SupportHome";
import SupportNew from "./pages/support/SupportNew";
import SupportQueue from "./pages/support/SupportQueue";
import SupportFlows from "./pages/support/SupportFlows";
import SupportTicket from "./pages/support/SupportTicket";
import HubLanding from "./pages/hub/HubLanding";
import { CIVILIAN_HUB, STAFF_HUB } from "./data/hubs";
import { CIVILIAN_RANKS } from "./data/mockData";

import HubHome from "./pages/hub/HubHome";
import HubRoster from "./pages/hub/HubRoster";
import HubDashboard from "./pages/hub/HubDashboard";
import HubChecklist from "./pages/hub/HubChecklist";
import HubDaDatabase from "./pages/hub/HubDaDatabase";
import HubDaHub from "./pages/hub/HubDaHub";
import HubReports from "./pages/hub/HubReports";
import HubTraining from "./pages/hub/HubTraining";
import HubAnalytics from "./pages/hub/HubAnalytics";
import HubAdministration from "./pages/hub/HubAdministration";
import HubLinks from "./pages/hub/HubLinks";
import HubHeadAdmin from "./pages/hub/HubHeadAdmin";
import HubSubmissions from "./pages/hub/HubSubmissions";
import HubExamMembers from "./pages/hub/HubExamMembers";
import HubAuditLog from "./pages/hub/HubAuditLog";
import HubManagement from "./pages/hub/HubManagement";
import HubPermissions from "./pages/hub/HubPermissions";
import HubDiscordRoles from "./pages/hub/HubDiscordRoles";
import HubForms from "./pages/hub/HubForms";
import HubPromotionBoard from "./pages/hub/HubPromotionBoard";
import CivHome from "./pages/civ/CivHome";
import CivCharacters from "./pages/civ/CivCharacters";
import CivVehicles from "./pages/civ/CivVehicles";
import CivProperties from "./pages/civ/CivProperties";
import CivLicences from "./pages/civ/CivLicences";
import CivRoster from "./pages/civ/CivRoster";
import CivBusinesses from "./pages/civ/CivBusinesses";
import CivJobs from "./pages/civ/CivJobs";
import CivClassifieds from "./pages/civ/CivClassifieds";
import CivPenalCode from "./pages/civ/CivPenalCode";
import CivGuides from "./pages/civ/CivGuides";
import CivForms from "./pages/civ/CivForms";
import Moderation from "./pages/staff/Moderation";
import Support from "./pages/staff/Support";
import Leadership from "./pages/management/Leadership";
import DepartmentHeads from "./pages/management/DepartmentHeads";
import Contact from "./pages/management/Contact";
import BotShell from "./components/bot/BotShell";
import BotOverview from "./pages/management/bot/BotOverview";
import BotRosters from "./pages/management/bot/BotRosters";
import BotRosterDetail from "./pages/management/bot/BotRosterDetail";
import BotPermissions from "./pages/management/bot/BotPermissions";
import BotServers from "./pages/management/bot/BotServers";
import BotSync from "./pages/management/bot/BotSync";
import BotAudit from "./pages/management/bot/BotAudit";

/**
 * Route table. Everything the nav points at resolves to a real page; role-gated
 * routes render the denial in place at the requested URL rather than
 * redirecting, so links stay shareable and start working once roles change.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BotAuthProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Landing />} />
            <Route path="rules" element={<Rules />} />

            <Route path="applications" element={<Applications />} />
            <Route path="applications/:type" element={<ApplicationForm />} />

            {/* The configurable application system. /manage sits above /:slug so
                a department cannot claim the address by naming a form "manage". */}
            <Route path="apply" element={<ApplyIndex />} />
            <Route path="apply/manage" element={<ApplyManage />} />
            <Route path="apply/manage/submissions/:reference" element={<ApplyReview />} />
            <Route path="apply/manage/:id" element={<ApplyBuilder />} />
            <Route path="apply/:slug" element={<ApplyForm />} />
            <Route path="apply/:slug/submitted" element={<ApplySubmitted />} />

            {/* The Emergency Services transfer portal. /new and /settings sit
                above /:id so a ticket id can never shadow them. */}
            <Route path="transfers" element={<TransferPortal />} />
            <Route path="transfers/new" element={<TransferNew />} />
            <Route path="transfers/settings" element={<TransferSettings />} />
            <Route path="transfers/:id" element={<TransferTicket />} />

            {/* The support portal. The named routes sit above /:id so a ticket
                reference can never shadow them. */}
            <Route path="support" element={<SupportHome />} />
            <Route path="support/new" element={<SupportNew />} />
            <Route path="support/queue" element={<SupportQueue />} />
            <Route path="support/flows" element={<SupportFlows />} />
            <Route path="support/:id" element={<SupportTicket />} />

            <Route path="departments" element={<Departments />} />
            <Route path="departments/:id" element={<DepartmentDetail />} />

            <Route path="store" element={<Store />} />
            <Route path="supporters" element={<Supporters />} />
            <Route path="knowledge-base" element={<KnowledgeBase />} />
            <Route path="knowledge-base/:slug" element={<Article />} />
            <Route path="events" element={<Events />} />
            <Route path="reports" element={<Reports />} />
            <Route path="join" element={<Join />} />
            <Route path="patch-notes" element={<PatchNotes />} />
            <Route path="sign-in" element={<SignIn />} />
            <Route path="create-account" element={<CreateAccount />} />

            {/* Role-gated staff and management areas. The roles live in
                src/lib/guards.js, which PublicLayout applies around the whole
                shell so a denial replaces the chrome rather than sitting
                inside it. */}
            <Route path="staff" element={<Staff />} />
            <Route path="staff/moderation" element={<Moderation />} />
            <Route path="staff/support" element={<Support />} />
            <Route path="management/leadership" element={<Leadership />} />
            <Route path="management/department-heads" element={<DepartmentHeads />} />
            {/* Public: reaching leadership should not require a role. */}
            <Route path="management/contact" element={<Contact />} />

            {/* The bot dashboard. Deliberately not behind this site's guard
                table: authorisation belongs to the bot API, which re-checks
                every call, and gating it here would be a second opinion that
                could disagree. BotShell renders the sign-in and not-staff
                states from the bot's own session instead. */}
            <Route path="management/bot" element={<BotShell />}>
              <Route index element={<BotOverview />} />
              <Route path="rosters" element={<BotRosters />} />
              <Route path="rosters/:slug" element={<BotRosterDetail />} />
              <Route path="permissions" element={<BotPermissions />} />
              <Route path="servers" element={<BotServers />} />
              <Route path="sync" element={<BotSync />} />
              <Route path="audit" element={<BotAudit />} />
            </Route>

            {/* Friendly redirects for legacy paths */}
            <Route path="home" element={<Navigate to="/" replace />} />
            <Route path="whitelist" element={<Navigate to="/applications/whitelist" replace />} />
            <Route path="donate" element={<Navigate to="/store" replace />} />
            <Route path="shop" element={<Navigate to="/store" replace />} />
            <Route path="faq" element={<Navigate to="/knowledge-base" replace />} />
            <Route path="changelog" element={<Navigate to="/patch-notes" replace />} />
            <Route path="updates" element={<Navigate to="/patch-notes" replace />} />
            <Route path="complaints" element={<Navigate to="/reports" replace />} />
            <Route path="team" element={<Navigate to="/staff" replace />} />
            <Route path="staff-portal" element={<Navigate to="/staff-hub" replace />} />
            <Route path="staff-roster" element={<Navigate to="/staff-hub/roster" replace />} />
            <Route path="trial-mod-checklist" element={<Navigate to="/staff-hub/trial-checklist" replace />} />
            <Route path="staff-da-database" element={<Navigate to="/staff-hub/da-database" replace />} />
            <Route path="staff-hub/director" element={<Navigate to="/staff-hub/head-admin" replace />} />
            <Route path="civilian-portal" element={<Navigate to="/civilian-hub" replace />} />
            <Route path="penal-code" element={<Navigate to="/civilian-hub/penal-code" replace />} />
            <Route path="jobs" element={<Navigate to="/civilian-hub/jobs" replace />} />
            <Route path="businesses" element={<Navigate to="/civilian-hub/businesses" replace />} />
            <Route path="roster" element={<Navigate to="/civilian-hub/roster" replace />} />
            <Route path="community-roster" element={<Navigate to="/civilian-hub/roster" replace />} />
            <Route path="connect" element={<Navigate to="/join" replace />} />
            <Route path="login" element={<Navigate to="/sign-in" replace />} />
            <Route path="register" element={<Navigate to="/create-account" replace />} />
          </Route>

          {/* Staff Hub — its own shell, so neither the public TopBar nor the
              Footer wraps it. The landing page is public (it is the sign-in
              entry point); every inner route is rank-gated by src/lib/guards.js
              alongside the sidebar that lists it. */}
          <Route path="/staff-hub" element={<HubLanding hub={STAFF_HUB} />} />
          {/* A pathless layout route, so the landing above can own /staff-hub
              itself without two siblings competing for the same path. */}
          <Route element={<HubShell hub={STAFF_HUB} />}>
            <Route path="/staff-hub/home" element={<HubHome />} />
            <Route path="/staff-hub/roster" element={<HubRoster />} />
            <Route path="/staff-hub/forms" element={<HubForms />} />
            <Route path="/staff-hub/promotion-board" element={<HubPromotionBoard />} />
            <Route path="/staff-hub/dashboard" element={<HubDashboard />} />
            <Route path="/staff-hub/trial-checklist" element={<HubChecklist />} />
            <Route path="/staff-hub/da-hub" element={<HubDaHub />} />
            <Route path="/staff-hub/reports" element={<HubReports />} />
            <Route path="/staff-hub/training" element={<HubTraining />} />
            <Route path="/staff-hub/analytics" element={<HubAnalytics />} />
            <Route path="/staff-hub/administration" element={<HubAdministration />} />
            <Route path="/staff-hub/da-database" element={<HubDaDatabase />} />

            <Route
              path="/staff-hub/resources"
              element={
                <HubLinks
                  section="allStaff"
                  icon="BookOpen"
                  title="Resources"
                  subtitle="Handbook, templates and policy every staff member needs to hand."
                  badge="All staff"
                  badgeTone="brand"
                />
              }
            />
            <Route
              path="/staff-hub/administrators"
              element={
                <HubLinks
                  section="administrators"
                  icon="Shield"
                  title="Administrators"
                  subtitle="Appeal queues, escalation tooling and evaluation paperwork."
                  badge="Administrator+"
                  badgeTone="primary"
                />
              }
            />
            <Route
              path="/staff-hub/senior-admins"
              element={
                <HubLinks
                  section="seniorAdmins"
                  icon="ShieldCheck"
                  title="Senior Admins+"
                  subtitle="Team administration, permanent records and recruitment planning."
                  badge="Senior Admin+"
                  badgeTone="amber"
                />
              }
            />
            <Route path="/staff-hub/head-admin" element={<HubHeadAdmin />} />

            <Route path="/staff-hub/submissions" element={<HubSubmissions />} />
            <Route path="/staff-hub/exam-members" element={<HubExamMembers />} />
            <Route path="/staff-hub/audit-log" element={<HubAuditLog />} />
            <Route path="/staff-hub/management" element={<HubManagement />} />
            <Route path="/staff-hub/permissions" element={<HubPermissions />} />
            <Route path="/staff-hub/discord-roles" element={<HubDiscordRoles />} />
          </Route>

          {/* Civilian Hub — same shape: a public landing page, then a gated
              shell over its sections. */}
          <Route path="/civilian-hub" element={<HubLanding hub={CIVILIAN_HUB} chips={CIVILIAN_RANKS} chipNote="Certification tiers are granted in Discord. Personal records need a whitelisted character; the community pages are open to any member." />} />
          <Route element={<HubShell hub={CIVILIAN_HUB} />}>
            <Route path="/civilian-hub/home" element={<CivHome />} />
            <Route path="/civilian-hub/characters" element={<CivCharacters />} />
            <Route path="/civilian-hub/vehicles" element={<CivVehicles />} />
            <Route path="/civilian-hub/properties" element={<CivProperties />} />
            <Route path="/civilian-hub/licences" element={<CivLicences />} />
            <Route path="/civilian-hub/roster" element={<CivRoster />} />
            <Route path="/civilian-hub/forms" element={<CivForms />} />
            <Route path="/civilian-hub/businesses" element={<CivBusinesses />} />
            <Route path="/civilian-hub/jobs" element={<CivJobs />} />
            <Route path="/civilian-hub/classifieds" element={<CivClassifieds />} />
            <Route path="/civilian-hub/penal-code" element={<CivPenalCode />} />
            <Route path="/civilian-hub/guides" element={<CivGuides />} />
          </Route>

          {/* Department sites. One route serves every department: the :deptId
              segment picks which saved config loads, and the pages inside come
              out of that config rather than out of this table. */}
          <Route path="/departments/:deptId/hub" element={<DeptShell />} />
          <Route path="/departments/:deptId/hub/:pageId" element={<DeptShell />} />

          {/* Registered for direct hits; guards render 403 in place instead. */}
          <Route path="/403" element={<AccessDenied reason="role" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </BotAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
