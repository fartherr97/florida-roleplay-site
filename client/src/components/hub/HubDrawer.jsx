import { useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import Logo from "../layout/Logo";
import { hubIcon } from "../../lib/hubIcons";
import { cn } from "../../lib/cn";

/**
 * Hub navigation below the point where the full top bar fits — the same
 * right-hand drawer the public site uses, with each nav group rendered under its
 * tone-coloured heading.
 */
export default function HubDrawer({ open, onClose, hub, groups }) {
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-white/[0.06] bg-[#0a0e1a]"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
              <Link to={hub.base} onClick={onClose} className="flex items-center gap-2.5">
                <Logo />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-white">
                    Florida <span className="text-primary-500">Roleplay</span>
                  </span>
                  <span className="block truncate text-[10px] font-bold uppercase tracking-[0.16em] text-brand-400">
                    {hub.name}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close navigation"
                className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
              {groups.map((group) => (
                <div key={group.id}>
                  <p
                    className={cn(
                      "px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.16em]",
                      group.tone.text,
                    )}
                  >
                    {group.label}
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = hubIcon(item.icon);
                      return (
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            onClick={onClose}
                            className={({ isActive }) =>
                              cn(
                                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                                isActive
                                  ? "bg-white/[0.06] font-semibold text-white"
                                  : "text-slate-300 hover:bg-white/[0.06] hover:text-white",
                              )
                            }
                          >
                            <span
                              className={cn(
                                "grid size-7 shrink-0 place-items-center rounded-lg ring-1 ring-inset",
                                group.tone.tile,
                              )}
                            >
                              <Icon className="size-4" />
                            </span>
                            <span className="truncate">{item.label}</span>
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>

            <div className="shrink-0 border-t border-white/[0.06] p-4">
              <Link
                to="/"
                onClick={onClose}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
              >
                <ArrowLeft className="size-4" />
                Back to the main site
              </Link>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
