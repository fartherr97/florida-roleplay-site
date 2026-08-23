import { useCallback, useEffect, useState } from "react";
import { api } from "./botApi";

/**
 * Loads one endpoint and tracks its state.
 *
 * The result is stamped with the request that produced it, so "still loading"
 * is derived during render rather than set from inside the effect. That matters
 * when a screen switches between resources: without it the new view renders the
 * previous resource's data for a frame before the reset lands.
 *
 * Errors are kept rather than thrown. Every one of these endpoints can answer
 * 401, 403, 404 or 429 as a normal part of operating, and each wants different
 * copy — the caller decides, usually by handing the error to <BotError>.
 */
export function useBotResource(path, { skip = false } = {}) {
  const [loaded, setLoaded] = useState({ key: null, data: null, error: null });
  const [reloadKey, setReloadKey] = useState(0);

  const key = skip ? null : `${path}#${reloadKey}`;

  useEffect(() => {
    if (key === null) return undefined;
    const controller = new AbortController();
    let active = true;

    api(path, { signal: controller.signal })
      .then((data) => active && setLoaded({ key, data, error: null }))
      .catch((error) => {
        // An aborted request is a navigation, not a failure to report.
        if (!active || error.name === "AbortError") return;
        setLoaded({ key, data: null, error });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [key, path]);

  const settled = loaded.key === key;

  return {
    data: settled ? loaded.data : null,
    error: settled ? loaded.error : null,
    loading: key !== null && !settled,
    reload: useCallback(() => setReloadKey((n) => n + 1), []),
  };
}

export default useBotResource;
