/**
 * Current-user provider backed by GET /api/me. A signed-in user is a real
 * Discord OAuth session; in development the API can also resolve a stand-in
 * caller, which this provider mirrors the same way.
 *
 * The provider also supports a **preview rank**: the Staff Hub lets you browse as
 * any rank so the portal can be reviewed without switching Discord accounts. A
 * preview only ever replaces the role list client-side — the server middleware
 * still decides what the API will return — and it disables itself the moment the
 * API reports a real session (`user.authenticated`), so it can never sit on top
 * of a genuine sign-in.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import AuthContext from "./authContext";
import { api } from "../lib/api";
import { PREVIEW_RANKS } from "../data/mockData";
import { DEFAULT_GRANTS, grantsPermission } from "../data/permissions";

const PREVIEW_KEY = "flrp.previewRank";

/** sessionStorage is unavailable in some embeddings; never let that throw. */
function readStoredPreview() {
  try {
    return sessionStorage.getItem(PREVIEW_KEY) || null;
  } catch {
    return null;
  }
}

function writeStoredPreview(rankId) {
  try {
    if (rankId) sessionStorage.setItem(PREVIEW_KEY, rankId);
    else sessionStorage.removeItem(PREVIEW_KEY);
  } catch {
    /* ignore — preview is a convenience, not state worth failing over */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Bumping this key re-runs the fetch; the effect never touches state
  // synchronously, so a refresh cannot cascade an extra render.
  const [reloadKey, setReloadKey] = useState(0);
  const [previewRank, setPreviewRankState] = useState(readStoredPreview);
  // Grants are configuration, not identity, so they load alongside the user and
  // fall back to the defaults rather than locking everyone out if the API is
  // unreachable.
  const [grants, setGrants] = useState(DEFAULT_GRANTS);

  useEffect(() => {
    let active = true;
    Promise.all([api.me(), api.permissionGrants()])
      .then(([me, nextGrants]) => {
        if (!active) return;
        setUser(me ?? null);
        if (nextGrants && Object.keys(nextGrants).length) setGrants(nextGrants);
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

  const setPreviewRank = useCallback((rankId) => {
    writeStoredPreview(rankId);
    setPreviewRankState(rankId);
  }, []);

  const value = useMemo(() => {
    // A real Discord session ends preview mode outright.
    const previewAvailable = !user?.authenticated;
    const rank = previewAvailable
      ? PREVIEW_RANKS.find((r) => r.id === previewRank) ?? null
      : null;

    const effectiveUser = rank
      ? { ...(user ?? {}), ...PREVIEW_IDENTITY, rank: rank.label, roles: rank.roles }
      : user;
    const roles = effectiveUser?.roles ?? [];

    return {
      user: effectiveUser,
      loading,
      /** True when the user holds any of the supplied roles. */
      hasRole: (required) => {
        if (!required || required.length === 0) return Boolean(effectiveUser);
        if (!effectiveUser) return false;
        return required.some((role) => roles.includes(role));
      },
      /**
       * True when one of the user's Discord roles is granted `permission`.
       * This is what routes and buttons should ask; ranks are an implementation
       * detail of the grants.
       */
      hasPermission: (permission) => {
        if (!permission) return Boolean(effectiveUser);
        if (!effectiveUser) return false;
        return grantsPermission(permission, roles, grants);
      },
      grants,
      setGrants,
      // End the Discord session server-side, then clear it locally. The
      // network call is best-effort: whatever it returns, the UI signs out.
      signOut: async () => {
        setPreviewRank(null);
        await api.logout().catch(() => {});
        setUser(null);
      },
      refresh,
      previewAvailable,
      previewRank: rank?.id ?? null,
      setPreviewRank,
    };
  }, [user, loading, refresh, previewRank, setPreviewRank, grants]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Identity shown while previewing, so it is never mistaken for a real account. */
const PREVIEW_IDENTITY = {
  id: "preview",
  username: "preview",
  displayName: "Preview User",
  avatar: null,
  preview: true,
};

export default AuthProvider;
