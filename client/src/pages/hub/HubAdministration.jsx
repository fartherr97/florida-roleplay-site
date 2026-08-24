import { createElement } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import { useAuth } from "../../context/useAuth";
import { hubIcon } from "../../lib/hubIcons";
import { STAFF_HUB } from "../../data/hubs";

/**
 * Everything that is configured rather than worked.
 *
 * These used to be three dropdowns in the top bar competing with the pages
 * people open every shift. Gathering them behind one tab is what let the bar
 * become a row of eleven daily destinations instead of a menu you have to read
 * — and a launcher page can say what each one is for, which a dropdown item
 * cannot.
 *
 * Each entry keeps its own gate; this page only decides what to list.
 */
export default function HubAdministration() {
  const { hasPermission, loading } = useAuth();

  const groups = STAFF_HUB.administration
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => loading || hasPermission(item.permission)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <HubPageHeader
        icon="SlidersHorizontal"
        eyebrow="Staff Hub"
        title="Site Administration"
        subtitle="The parts of the portal you configure rather than work. Everything here is gated on its own — you are seeing what you can open."
      />

      {groups.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-semibold text-white">Nothing here for your rank.</p>
          <p className="mt-1 text-sm text-slate-400">
            These are configuration tools; they open up as you move up.
          </p>
        </Card>
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.id}>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
                  {group.label}
                </h2>
                <span className="h-px flex-1 bg-white/[0.06]" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {group.items.map((item) => (
                  <Card key={item.to} as={Link} to={item.to} hover className="flex items-start gap-4 p-5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-slate-300 ring-1 ring-inset ring-white/[0.06]">
                      {createElement(hubIcon(item.icon), { className: "size-5" })}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-white">{item.label}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
                        {item.detail}
                      </span>
                    </span>
                    <ArrowRight className="mt-1 size-4 shrink-0 text-slate-600" />
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
