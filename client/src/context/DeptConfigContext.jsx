/**
 * Loads one department's config and holds every edit made to it.
 *
 * A department site *is* its config, so this provider is the whole editing
 * model: `mutate` applies a change locally and debounces a save, which is what
 * makes the Builder Portal feel like editing a document rather than filling in a
 * form and pressing Save. `savePage` is the narrow counterpart used by the page
 * editors — it writes one page's own data and can never touch anything else,
 * matching the two write surfaces the API exposes.
 *
 * Capabilities come from the API rather than being recomputed here: the server
 * already resolved them against the caller's Discord roles, and deriving a
 * second answer client-side is how a UI ends up offering a button that 403s.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeptConfigContext from "./deptConfigContext";
import { api, ApiForbiddenError } from "../lib/api";
import { normalizeConfig } from "../lib/departmentConfig";

/** Long enough to coalesce a burst of typing, short enough to feel saved. */
const SAVE_DEBOUNCE_MS = 900;

/** How many steps back the Builder's undo reaches. */
const HISTORY_LIMIT = 10;

export function DeptConfigProvider({ id, children }) {
  // Results are stamped with the id they were fetched for, so switching
  // departments derives "loading" during render rather than needing an effect to
  // reset state — which would render the previous department's config first.
  const [loaded, setLoaded] = useState({ id: null, config: null, capabilities: [], error: null });
  const [draft, setDraft] = useState({ id: null, config: null });
  const [history, setHistory] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [save, setSave] = useState({ state: "idle", message: "" });
  const timer = useRef(null);

  useEffect(() => {
    let active = true;
    api
      .deptConfig(id)
      .then((result) => {
        if (!active) return;
        if (!result?.config) {
          setLoaded({ id, config: null, capabilities: [], error: "not-found" });
          return;
        }
        setLoaded({
          id,
          config: normalizeConfig(result.config, id),
          capabilities: result.capabilities ?? [],
          error: null,
        });
      })
      .catch((err) => {
        if (!active) return;
        setLoaded({
          id,
          config: null,
          capabilities: [],
          error: err instanceof ApiForbiddenError ? "forbidden" : "error",
        });
      });
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  // Clear a pending save when the provider goes away, so a debounce started on
  // the way out never lands against a department that is no longer open.
  useEffect(() => () => clearTimeout(timer.current), []);

  const fresh = loaded.id === id;
  const config = (draft.id === id ? draft.config : null) ?? (fresh ? loaded.config : null);
  const capabilities = useMemo(
    () => new Set(fresh ? loaded.capabilities : []),
    [fresh, loaded.capabilities],
  );

  const flush = useCallback(
    (next) => {
      setSave({ state: "saving", message: "" });
      api
        .saveDeptConfig(id, next)
        .then((result) => {
          setSave({ state: "saved", message: result?.message ?? "" });
        })
        .catch((err) => {
          setSave({
            state: "error",
            message: err?.errors?.join(" ") || err?.message || "That change was rejected.",
          });
        });
    },
    [id],
  );

  /**
   * Apply a change and queue a save. `updater` takes the current config and
   * returns the next one; the previous config goes onto the undo stack.
   */
  const mutate = useCallback(
    (updater, { immediate = false } = {}) => {
      if (!config) return;
      const next = normalizeConfig(
        typeof updater === "function" ? updater(config) : updater,
        id,
      );
      setDraft({ id, config: next });
      setHistory((stack) => [config, ...stack].slice(0, HISTORY_LIMIT));
      setSave({ state: "saving", message: "" });

      clearTimeout(timer.current);
      if (immediate) flush(next);
      else timer.current = setTimeout(() => flush(next), SAVE_DEBOUNCE_MS);
    },
    [config, flush, id],
  );

  /**
   * Step back one change.
   *
   * The side effects deliberately sit outside the state updater: React calls
   * updaters twice under StrictMode to surface impure ones, which turned a
   * single Undo into two saves and two version-history rows. Reading the stack
   * from state here and updating it separately keeps the updater pure.
   */
  const undo = useCallback(() => {
    const previous = history[0];
    if (!previous) return;
    setHistory((stack) => stack.slice(1));
    setDraft({ id, config: previous });
    clearTimeout(timer.current);
    flush(previous);
  }, [flush, history, id]);

  /** Write one page's own data. Used by the roster, fleet, calendar and log editors. */
  const savePage = useCallback(
    async (pageId, pageConfig) => {
      setDraft((current) => {
        const base = current.id === id ? current.config : config;
        if (!base) return current;
        return {
          id,
          config: {
            ...base,
            pages: base.pages.map((page) =>
              page.id === pageId ? { ...page, config: pageConfig } : page,
            ),
          },
        };
      });
      setSave({ state: "saving", message: "" });
      try {
        const result = await api.saveDeptPage(id, pageId, pageConfig);
        setSave({ state: "saved", message: result?.message ?? "" });
        return result;
      } catch (err) {
        setSave({
          state: "error",
          message: err?.errors?.join(" ") || err?.message || "That change was rejected.",
        });
        throw err;
      }
    },
    [config, id],
  );

  const value = useMemo(
    () => ({
      id,
      config,
      loading: !fresh,
      error: fresh ? loaded.error : null,
      capabilities,
      can: (capability) => capabilities.has(capability),
      mutate,
      savePage,
      undo,
      canUndo: history.length > 0,
      reload: () => {
        setDraft({ id: null, config: null });
        setHistory([]);
        setReloadKey((key) => key + 1);
      },
      saveState: save.state,
      saveMessage: save.message,
    }),
    [
      capabilities,
      config,
      fresh,
      history,
      id,
      loaded.error,
      mutate,
      save.message,
      save.state,
      savePage,
      undo,
    ],
  );

  return <DeptConfigContext.Provider value={value}>{children}</DeptConfigContext.Provider>;
}

export default DeptConfigProvider;
