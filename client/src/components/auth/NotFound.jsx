import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import Button from "../ui/Button";
import StatusPanel from "./StatusPanel";

/** 404 page built on the same panel as AccessDenied so the two read as a pair. */
export default function NotFound() {
  return (
    <StatusPanel
      badgeLabel="Route Missing"
      badgeTone="amber"
      errorLabel="Error 404"
      icon={
        <div className="animate-float grid size-36 place-items-center rounded-3xl bg-gradient-to-br from-amber-500/90 to-amber-700/90 ring-1 ring-inset ring-white/15 shadow-[0_0_80px_-10px_rgba(245,158,11,0.55)]">
          <Compass className="size-14 text-white" />
        </div>
      }
      headlineTop="Page"
      headlineBottom="Not Found."
      headlineTone="text-amber-400"
      message="That address doesn't match anything on the portal — it may have moved, or the link may be out of date."
      note="Check the address for typos, or head back to the homepage and use the navigation to find what you were looking for."
      code="ROUTE_NOT_FOUND"
      footerDashes={["bg-emerald-500", "bg-emerald-500", "bg-amber-500"]}
      footerLabel="Route Failed"
      actions={
        <>
          <Button as={Link} to="/" variant="secondary">
            ← Return Home
          </Button>
          <Button as={Link} to="/knowledge-base" variant="ghost">
            Browse Knowledge Base
          </Button>
        </>
      }
    />
  );
}
