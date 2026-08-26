/**
 * Loads the bot API session from GET /me.
 *
 * A 401 here has two distinct meanings and the dashboard treats them
 * differently: no session at all is "sign in", while a session belonging to
 * somebody the bot does not consider staff is a state to explain, not an error
 * to retry. The API's message is what separates them.
 *
 * `capabilities` is exposed for deciding what to render. It is never consulted
 * to decide whether an action is allowed — the API re-checks every call, and a
 * dashboard that hides a button has not prevented anything.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import BotAuthContext from "./botAuthContext";
import {
  ApiError,
  ApiNotConfiguredError,
  api,
  isConfigured,
  setCsrfToken,
  signOut,
} from "../lib/botApi";

export function BotAuthProvider({ children }) {
  // Stamped with the request it answered, so "still loading" is derived during
  // render rather than set from inside the effect.
  const [loaded, setLoaded] = useState({ key: null, value: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // Nothing to ask when there is no API address — that state is derived
    // during render below rather than set from in here.
    if (!isConfigured) return undefined;
    let active = true;

    api("/me")
      .then((me) => {
        if (!active) return;
        // Hold the CSRF token from the session response so writes can echo it
        // back without depending on the cross-subdomain cookie being readable.
        setCsrfToken(me?.csrfToken);
        setLoaded({
          key: reloadKey,
          value: {
            state: "signed-in",
            user: me?.user ?? null,
            grants: me?.grants ?? [],
            permissions: me?.permissions ?? [],
            capabilities: me?.capabilities ?? [],
          },
        });
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiNotConfiguredError) {
          setLoaded({ key: reloadKey, value: { state: "unconfigured" } });
          return;
        }
        if (error instanceof ApiError && error.isUnauthenticated) {
          setLoaded({
            key: reloadKey,
            value: { state: error.isNotStaff ? "not-staff" : "signed-out", error },
          });
          return;
        }
        // A network failure is not a signed-out state, and telling somebody to
        // sign in when the API is unreachable sends them round a loop.
        setLoaded({ key: reloadKey, value: { state: "error", error } });
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  // Memoised so the context value below is not rebuilt on every render: the
  // unconfigured branch returns a fresh object literal each time otherwise.
  const fresh = useMemo(
    () =>
      !isConfigured
        ? { state: "unconfigured" }
        : loaded.key === reloadKey
          ? loaded.value
          : null,
    [loaded, reloadKey],
  );
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const value = useMemo(
    () => ({
      state: fresh?.state ?? "loading",
      user: fresh?.user ?? null,
      grants: fresh?.grants ?? [],
      permissions: fresh?.permissions ?? [],
      capabilities: fresh?.capabilities ?? [],
      error: fresh?.error ?? null,
      refresh,
      signOut: async () => {
        // A failed logout still clears the local view: the session may already
        // be gone, which is exactly when the call fails.
        await signOut().catch(() => {});
        refresh();
      },
    }),
    [fresh, refresh],
  );

  return <BotAuthContext.Provider value={value}>{children}</BotAuthContext.Provider>;
}

export default BotAuthProvider;
