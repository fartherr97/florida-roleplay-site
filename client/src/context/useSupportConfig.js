import { useContext } from "react";
import SupportConfigContext from "./supportConfigContext";

/** Reads the live ticket-category catalogue and whether the caller may edit it. */
export function useSupportConfig() {
  return useContext(SupportConfigContext);
}

export default useSupportConfig;
