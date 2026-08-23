import { useContext } from "react";
import AuthContext from "./authContext";

/** Reads the current user, loading state and role helpers. */
export function useAuth() {
  return useContext(AuthContext);
}

export default useAuth;
