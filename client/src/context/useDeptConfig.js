import { useContext } from "react";
import DeptConfigContext from "./deptConfigContext";

/** Reads the active department's config, the caller's capabilities and the save helpers. */
export function useDeptConfig() {
  return useContext(DeptConfigContext);
}

export default useDeptConfig;
