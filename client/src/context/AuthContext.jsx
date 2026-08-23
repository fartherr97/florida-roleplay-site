/**
 * Current-user provider backed by GET /api/me. Discord OAuth is not wired yet, so
 * the API resolves a development user and this provider simply mirrors it.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import AuthContext from "./authContext";
import { api } from "../lib/api";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Bumping this key re-runs the fetch; the effect never touches state
  // synchronously, so a refresh cannot cascade an extra render.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((me) => {
        if (active) setUser(me ?? null);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const value = useMemo(() => {
    const roles = user?.roles ?? [];
    return {
      user,
      loading,
      /** True when the user holds any of the supplied roles. */
      hasRole: (required) => {
        if (!required || required.length === 0) return Boolean(user);
        if (!user) return false;
        return required.some((role) => roles.includes(role));
      },
      // Signing out is local-only until OAuth lands.
      signOut: () => setUser(null),
      refresh,
    };
  }, [user, loading, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
