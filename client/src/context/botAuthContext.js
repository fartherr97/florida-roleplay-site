/**
 * The bot dashboard's session context object, kept apart from the provider so
 * both it and the useBotAuth hook can import it without a module exporting a
 * mix of components and non-components.
 *
 * Entirely separate from src/context/authContext.js — that one is this site's
 * own Express session, this one is the bot API's. Conflating them would put the
 * dashboard behind the wrong authority.
 */
import { createContext } from "react";

const BotAuthContext = createContext({
  /** "loading" | "signed-out" | "not-staff" | "signed-in" | "unconfigured" | "error" */
  state: "loading",
  user: null,
  /** Capability grants, for deciding what to SHOW. Never what to allow. */
  capabilities: [],
  grants: [],
  permissions: [],
  error: null,
  refresh: () => {},
  signOut: async () => {},
});

export default BotAuthContext;
