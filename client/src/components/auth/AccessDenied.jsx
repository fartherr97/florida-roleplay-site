import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import Button from "../ui/Button";
import StatusPanel from "./StatusPanel";
import { useAuth } from "../../context/useAuth";

/**
 * 403 page, rendered in place at the requested URL so the link stays refreshable
 * and shareable. Copy is driven by the `reason` map, and `code` may be passed
 * straight through from an API 403 body.
 */
const REASONS = {
  "signed-out": {
    code: "AUTH_SIGNED_OUT",
    headline: "Denied.",
    message:
      "You need to be signed in with Discord before this portal can check your roles.",
  },
  role: {
    code: "AUTH_ROLE_MISSING",
    headline: "Denied.",
    message:
      "Your Discord account doesn't have any roles that associate you as a Staff member on this portal.",
  },
  department: {
    code: "AUTH_DEPT_MISMATCH",
    headline: "Denied.",
    message:
      "Your Discord roles don't place you in the department that owns this page.",
  },
};

export default function AccessDenied({ reason = "role", code }) {
  const { user } = useAuth();
  const copy = REASONS[reason] ?? REASONS.role;

  return (
    <StatusPanel
      badgeLabel="Access Restricted"
      badgeTone="rose"
      errorLabel="Error 403"
      icon={
        <div className="animate-float grid size-36 place-items-center rounded-3xl bg-gradient-to-br from-violet-600/90 to-violet-800/90 ring-1 ring-inset ring-white/15 shadow-[0_0_80px_-10px_rgba(139,92,246,0.55)]">
          <Lock className="size-14 text-white" />
        </div>
      }
      headlineTop="Access"
      headlineBottom={copy.headline}
      headlineTone="text-rose-500"
      message={copy.message}
      note="If you believe this is a mistake, please reach out to your supervisor directly in the Discord server."
      code={code || copy.code}
      actions={
        <>
          <Button as={Link} to="/" variant="secondary">
            ← Return Home
          </Button>
          {!user && (
            <Button as={Link} to="/sign-in" variant="discord">
              Login with Discord
            </Button>
          )}
        </>
      }
    />
  );
}
