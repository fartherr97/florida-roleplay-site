import { Link, NavLink } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Logo from "../layout/Logo";
import { hubGroups } from "../../data/hubNavigation";
import { hubIcon } from "../../lib/hubIcons";
import { useAuth } from "../../context/useAuth";
import { cn } from "../../lib/cn";

/**
 * Hub navigation, grouped the way the community's hub is. Entries the current
 * rank cannot open are hidden rather than shown as dead ends — the route guard
 * and the API both still enforce the same roles.
 */
export default function HubSidebar({ onNavigate }) {
  const { hasRole, loading } = useAuth();

  const groups = hubGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => loading || hasRole(item.roles)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] px-5">
        <Link to="/staff-hub" className="flex items-center gap-2.5" onClick={onNavigate}>
          <Logo />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-white">
              Florida <span className="text-primary-500">RP</span>
            </span>
            <span className="block truncate text-[10px] font-bold uppercase tracking-[0.16em] text-brand-400">
              Staff Hub
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {groups.map((group) => (
          <div key={group.id}>
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = hubIcon(item.icon);
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                          isActive
                            ? "bg-primary-500/12 font-semibold text-white ring-1 ring-inset ring-primary-400/25"
                            : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
                        )
                      }
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/[0.06] p-3">
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back to the main site
        </Link>
      </div>
    </div>
  );
}
