import { useLocation } from "react-router-dom";
import Glow from "./Glow";
import TopBar from "./TopBar";
import Footer from "./Footer";
import AnimatedOutlet from "./AnimatedOutlet";
import RequireRole from "../auth/RequireRole";
import { guardFor } from "../../lib/guards";

/**
 * Shell for every public page. `main` is deliberately unconstrained so the
 * landing hero can run full-bleed; interior pages wrap themselves in <Section>.
 *
 * Role gating is declared in src/lib/guards.js and applied here, around the
 * entire shell — so a denial replaces the TopBar and Footer with the Access
 * Denied page rather than rendering between them, while the URL stays exactly
 * where the user asked for it.
 */
export default function PublicLayout() {
  const { pathname } = useLocation();
  const guard = guardFor(pathname);

  return (
    <RequireRole roles={guard?.roles ?? []} reason={guard?.reason}>
      <div className="flex min-h-full flex-col">
        <Glow />
        <TopBar />
        {/* overflow-x-clip contains the outlet's horizontal slide transition, so
            a route change never gives the page a horizontal scrollbar. */}
        <main className="flex-1 overflow-x-clip">
          <AnimatedOutlet />
        </main>
        <Footer />
      </div>
    </RequireRole>
  );
}
