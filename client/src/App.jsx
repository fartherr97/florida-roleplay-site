import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import PublicLayout from "./components/layout/PublicLayout";
import AccessDenied from "./components/auth/AccessDenied";
import NotFound from "./components/auth/NotFound";
import { AuthProvider } from "./context/AuthContext";

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
import Moderation from "./pages/staff/Moderation";
import Support from "./pages/staff/Support";
import Leadership from "./pages/management/Leadership";
import DepartmentHeads from "./pages/management/DepartmentHeads";
import Contact from "./pages/management/Contact";

/**
 * Route table. Everything the nav points at resolves to a real page; role-gated
 * routes render the denial in place at the requested URL rather than
 * redirecting, so links stay shareable and start working once roles change.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Landing />} />
            <Route path="rules" element={<Rules />} />

            <Route path="applications" element={<Applications />} />
            <Route path="applications/:type" element={<ApplicationForm />} />

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

            {/* Friendly redirects for legacy paths */}
            <Route path="home" element={<Navigate to="/" replace />} />
            <Route path="apply" element={<Navigate to="/applications" replace />} />
            <Route path="whitelist" element={<Navigate to="/applications/whitelist" replace />} />
            <Route path="donate" element={<Navigate to="/store" replace />} />
            <Route path="shop" element={<Navigate to="/store" replace />} />
            <Route path="faq" element={<Navigate to="/knowledge-base" replace />} />
            <Route path="support" element={<Navigate to="/knowledge-base" replace />} />
            <Route path="changelog" element={<Navigate to="/patch-notes" replace />} />
            <Route path="updates" element={<Navigate to="/patch-notes" replace />} />
            <Route path="complaints" element={<Navigate to="/reports" replace />} />
            <Route path="team" element={<Navigate to="/staff" replace />} />
            <Route path="connect" element={<Navigate to="/join" replace />} />
            <Route path="login" element={<Navigate to="/sign-in" replace />} />
            <Route path="register" element={<Navigate to="/create-account" replace />} />
          </Route>

          {/* Registered for direct hits; guards render 403 in place instead. */}
          <Route path="/403" element={<AccessDenied reason="role" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
