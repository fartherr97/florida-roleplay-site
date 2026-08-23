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
const STAFF_NOTE =
  "If you believe this is a mistake, please reach out to your supervisor directly in the Discord server.";

const REASONS = {
  "signed-out": {
    code: "AUTH_SIGNED_OUT",
    headline: "Denied.",
    message:
      "You need to be signed in with Discord before this portal can check your roles.",
    note: STAFF_NOTE,
  },
  role: {
    code: "AUTH_ROLE_MISSING",
    headline: "Denied.",
    message:
      "Your Discord account doesn't have any roles that associate you as a Staff member on this portal.",
    note: STAFF_NOTE,
  },
  department: {
    code: "AUTH_DEPT_MISMATCH",
    headline: "Denied.",
    message:
      "Your Discord roles don't place you in the department that owns this page.",
    note: STAFF_NOTE,
  },
  whitelist: {
    code: "AUTH_NOT_WHITELISTED",
    headline: "Denied.",
    message:
      "Your Discord account isn't whitelisted yet, so there's no character record for this page to show.",
    note: "Submit a whitelist application and this page will start working as soon as it's approved — usually within 24 to 48 hours.",
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
      note={copy.note}
      code={code || copy.code}
      actions={
        <>
          <Button as={Link} to="/" variant="secondary">
            ← Return Home
          </Button>
          {reason === "whitelist" ? (
            <Button as={Link} to="/applications/whitelist" variant="primary">
              Apply for whitelist
            </Button>
          ) : (
            !user && (
              <Button as={Link} to="/sign-in" variant="discord">
                Login with Discord
              </Button>
            )
          )}
        </>
      }
    />
  );
}
