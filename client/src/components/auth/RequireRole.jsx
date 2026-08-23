import AccessDenied from "./AccessDenied";
import { useAuth } from "../../context/useAuth";

/**
 * Route guard. Roles match as "any of"; an empty list means the route is public
 * and children render untouched.
 *
 * The denial renders in place at the requested URL rather than redirecting, so
 * the link survives a refresh and starts working the moment the user's Discord
 * roles change. PublicLayout wraps the whole shell in this guard (reading the
 * required roles from each route's `handle`), which is what lets AccessDenied
 * replace the TopBar and Footer instead of appearing between them.
 */
export default function RequireRole({ roles = [], reason = "role", children }) {
  const { user, loading, hasRole } = useAuth();

  if (roles.length === 0) return children;

  // Skeleton while /api/me resolves — never flash a denial at a signed-in user.
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center p-4">
        <div className="w-full max-w-3xl space-y-4">
          <div className="h-10 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />
        </div>
      </div>
    );
  }

  if (!user) return <AccessDenied reason="signed-out" />;
  if (!hasRole(roles)) return <AccessDenied reason={reason} />;

  return children;
}
