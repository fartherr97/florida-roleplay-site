/**
 * The support-config context object, kept apart from the provider component so
 * both the provider and the useSupportConfig hook can import it without a module
 * exporting a mix of components and non-components.
 */
import { createContext } from "react";
import { DEFAULT_TICKET_TYPES, typeMapOf } from "../lib/support";

const SupportConfigContext = createContext({
  /** The live ticket-category catalogue (falls back to the built-in defaults). */
  types: DEFAULT_TICKET_TYPES,
  typeMap: typeMapOf(DEFAULT_TICKET_TYPES),
  /** Whether the caller may edit the catalogue. */
  canConfigure: false,
  loading: true,
  reload: () => {},
});

export default SupportConfigContext;
