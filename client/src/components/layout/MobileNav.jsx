import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink, X } from "lucide-react";
import Button from "../ui/Button";
import Logo from "./Logo";
import { iconFor } from "../../lib/icons";
import { cn } from "../../lib/cn";
import { SITE } from "../../data/mockData";

/**
 * Full-height drawer holding the nav links and dropdown groups below the xl
 * breakpoint, where the full bar cannot fit. Groups become accordions under
 * their tone-coloured headings.
 */
export default function MobileNav({ open, onClose, primaryLinks, groups }) {
  const [expanded, setExpanded] = useState(null);

  // Lock page scroll behind the drawer.
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
        <div className="fixed inset-0 z-50 nav:hidden">
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
              <Link to="/" onClick={onClose} className="flex items-center gap-2.5">
                <Logo />
                <span className="text-[17px] font-extrabold tracking-[-0.3px] text-white">
                  Florida <span className="text-primary-500">Roleplay</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close navigation"
                className="grid size-8 place-items-center rounded-lg text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 py-5">
              <ul className="space-y-1">
                {primaryLinks.map((link) =>
                  link.external ? (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        onClick={onClose}
                        className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        {link.label}
                        <ExternalLink className="size-3.5 text-slate-500" />
                      </a>
                    </li>
                  ) : (
                    <li key={link.to}>
                      <NavLink
                        to={link.to}
                        end={link.to === "/"}
                        onClick={onClose}
                        className={({ isActive }) =>
                          cn(
                            "block rounded-xl px-3 py-2.5 text-sm font-medium transition",
                            isActive
                              ? "bg-white/[0.06] text-white"
                              : "text-slate-300 hover:bg-white/[0.06] hover:text-white",
                          )
                        }
                      >
                        {link.label}
                      </NavLink>
                    </li>
                  ),
                )}
              </ul>

              <div className="mt-6 space-y-2">
                {groups.map((group) => {
                  const isOpen = expanded === group.id;
                  return (
                    <div
                      key={group.id}
                      className="overflow-hidden rounded-xl ring-1 ring-inset ring-white/[0.06]"
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setExpanded(isOpen ? null : group.id)}
                        className={cn(
                          "flex w-full items-center justify-between px-3 py-3 text-[11px] font-bold uppercase tracking-[0.14em] transition hover:bg-white/[0.04]",
                          group.tone.text,
                        )}
                      >
                        {group.label}
                        <ChevronDown
                          className={cn(
                            "size-4 transition-transform duration-200",
                            isOpen && "rotate-180",
                          )}
                        />
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.ul
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                            className="overflow-hidden px-1.5 pb-1.5"
                          >
                            {group.items.map((item) => {
                              const Icon = iconFor(item.icon);
                              return (
                                <li key={item.to}>
                                  <Link
                                    to={item.to}
                                    onClick={onClose}
                                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
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
                                  </Link>
                                </li>
                              );
                            })}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </nav>

            <div className="shrink-0 space-y-2 border-t border-white/[0.06] p-4">
              <Button as={Link} to="/apply" onClick={onClose} variant="secondary" block>
                Apply
              </Button>
              <Button as="a" href={SITE.fivemConnect} variant="primary" block>
                Connect to Server
                <ExternalLink className="size-4" />
              </Button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
