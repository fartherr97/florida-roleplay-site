import { Outlet } from "react-router-dom";
import { SupportConfigProvider } from "../../context/SupportConfigContext";

/**
 * Wraps every support screen in the ticket-category provider, so the live
 * catalogue is loaded once and shared rather than fetched per page.
 */
export default function SupportLayout() {
  return (
    <SupportConfigProvider>
      <Outlet />
    </SupportConfigProvider>
  );
}
