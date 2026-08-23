/**
 * Current-user provider backed by GET /api/me. Discord OAuth is not wired yet, so
 * the API resolves a development user and this provider simply mirrors it.
 *
 * While OAuth is stubbed the provider also supports a **preview rank**: the Staff
 * Hub lets you browse as any rank so the portal can be reviewed before Discord
 * roles exist. A preview only ever replaces the role list client-side — the
 * server middleware still decides what the API will return — and the whole
 * mechanism disables itself the moment the API reports a real session
 * (`user.authenticated`), so it cannot outlive the stub.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import AuthContext from "./authContext";
import { api } from "../lib/api";
import { PREVIEW_RANKS } from "../data/mockData";

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
      // Signing out is local-only until OAuth lands.
      signOut: () => {
        setPreviewRank(null);
        setUser(null);
      },
      refresh,
      previewAvailable,
      previewRank: rank?.id ?? null,
      setPreviewRank,
    };
  }, [user, loading, refresh, previewRank, setPreviewRank]);

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
