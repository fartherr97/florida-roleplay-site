/**
 * The department config context object, kept apart from the provider component
 * so both the provider and the useDeptConfig hook can import it without a module
 * exporting a mix of components and non-components.
 */
import { createContext } from "react";

const DeptConfigContext = createContext({
  id: null,
  config: null,
  loading: true,
  error: null,
  /** Capability keys the caller holds in this department. */
  capabilities: new Set(),
  can: () => false,
  /** Apply a change to the local config and queue a save. */
  mutate: () => {},
  /** Replace one page's own data — the narrow write the page editors use. */
  savePage: async () => {},
  reload: () => {},
  /** "idle" | "saving" | "saved" | "error" */
  saveState: "idle",
  saveMessage: "",
});

export default DeptConfigContext;
