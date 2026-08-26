/**
 * Loads the ticket-category catalogue once for the whole support portal.
 *
 * Categories used to be code; they are configuration now, so every support
 * screen needs the live list rather than the built-in defaults — a renamed
 * department queue or a newly added category has to render everywhere. Loading
 * it here, once, keeps every screen consistent and saves each one its own fetch.
 *
 * The catalogue is not sensitive to read (a member needs it to open a ticket and
 * to see a category's name on their own), so this loads for anyone signed in and
 * falls back to the built-in defaults when the API is unreachable.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import SupportConfigContext from "./supportConfigContext";
import { api } from "../lib/api";
import { DEFAULT_TICKET_TYPES, normalizeTicketTypes, typeMapOf } from "../lib/support";

export function SupportConfigProvider({ children }) {
  const [state, setState] = useState({ types: DEFAULT_TICKET_TYPES, canConfigure: false, loading: true });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .supportTypes()
      .then((result) => {
        if (!active) return;
        const types = normalizeTicketTypes(result?.types);
        setState({
          types: types.length ? types : DEFAULT_TICKET_TYPES,
          canConfigure: result?.canConfigure === true,
          loading: false,
        });
      })
      .catch(() => active && setState((prev) => ({ ...prev, loading: false })));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  const value = useMemo(
    () => ({
      types: state.types,
      typeMap: typeMapOf(state.types),
      canConfigure: state.canConfigure,
      loading: state.loading,
      reload,
    }),
    [state, reload],
  );

  return <SupportConfigContext.Provider value={value}>{children}</SupportConfigContext.Provider>;
}

export default SupportConfigProvider;
