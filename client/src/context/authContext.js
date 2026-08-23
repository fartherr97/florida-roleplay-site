/**
 * The context object itself lives apart from the provider component so that both
 * the provider and the useAuth hook can import it without a module exporting a
 * mix of components and non-components.
 */
import { createContext } from "react";

const AuthContext = createContext({
  user: null,
  loading: true,
  hasRole: () => false,
  signOut: () => {},
  refresh: () => {},
});

export default AuthContext;
