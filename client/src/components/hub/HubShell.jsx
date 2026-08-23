import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Glow from "../layout/Glow";
import Footer from "../layout/Footer";
import HubTopBar from "./HubTopBar";
import RequireRole from "../auth/RequireRole";
import { guardFor } from "../../lib/guards";
import { hubContainer } from "../../lib/hubLayout";

/**
 * Shell for every page inside a hub. It mirrors the public site's layout — glow,
 * sticky top bar, animated outlet, footer — so moving between the site and a hub
 * feels like one product, while the bar's contents stay hub-specific.
 *
 * Rank gating is applied here around the whole shell, the same way PublicLayout
 * does it, so a denial replaces the chrome with the Access Denied page at the
 * requested URL rather than rendering inside a hub the user cannot use.
 */
export default function HubShell({ hub }) {
  const location = useLocation();
  const outlet = useOutlet();
  const guard = guardFor(location.pathname);

  return (
    <RequireRole permission={guard?.permission} reason={guard?.reason}>
      <div className="flex min-h-full flex-col">
        <Glow />
        <HubTopBar hub={hub} />
        <main className="flex-1 overflow-x-clip">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className={hubContainer(location.pathname)}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
        <Footer />
      </div>
    </RequireRole>
  );
}
