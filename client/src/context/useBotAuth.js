import { useContext } from "react";
import BotAuthContext from "./botAuthContext";

/** The bot API session: who is signed in and what the dashboard should show them. */
export function useBotAuth() {
  return useContext(BotAuthContext);
}

export default useBotAuth;
