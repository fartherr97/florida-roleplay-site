import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { iconFor } from "../../lib/icons";
import { cn } from "../../lib/cn";

/**
 * One colour-coded nav group in the top bar. Opens on hover (with a short close
 * delay so the pointer can travel to the panel) and on click; closes on outside
 * click, Escape and route change. Arrow keys move focus between rows.
 */
export default function NavDropdown({ label, tone, items }) {
  // Hover and click are tracked separately: a pointer that merely passes over
  // the trigger opens the panel transiently, while a click pins it open. Without
  // the split, hovering (which happens first) would open the panel and the click
  // that follows would immediately toggle it shut.
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = pinned || hovered;
  const rootRef = useRef(null);
  const itemRefs = useRef([]);
  const closeTimer = useRef(null);
  const location = useLocation();
  const menuId = useId();
  const [lastPath, setLastPath] = useState(location.pathname);

  // Close whenever the route changes — the panel should never outlive a click.
  // Adjusting during render (rather than in an effect) avoids a visible frame
  // of the old panel on the new page.
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setPinned(false);
    setHovered(false);
  }

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setHovered(false), 120);
  };

  const close = () => {
    cancelClose();
    setPinned(false);
    setHovered(false);
  };

  useEffect(() => () => cancelClose(), []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const focusItem = (index) => {
    const list = itemRefs.current.filter(Boolean);
    if (list.length === 0) return;
    const next = (index + list.length) % list.length;
    list[next]?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setPinned(true);
      setTimeout(() => focusItem(0), 0);
      return;
    }
    if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      focusItem(-1);
    }
  };

  const onItemKeyDown = (e, index) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(index + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(index - 1);
    } else if (e.key === "Escape") {
      close();
      rootRef.current?.querySelector("button")?.focus();
    }
  };

  if (items.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setHovered(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          // Clicking an already-open (hovered) panel pins it; clicking a pinned
          // panel dismisses it, clearing hover too so it does not spring back
          // under a stationary pointer.
          if (pinned) close();
          else setPinned(true);
        }}
        onKeyDown={onKeyDown}
        className={cn(
          "inline-flex items-center gap-1.5 text-[13px] font-medium transition hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/70 rounded-md px-1 py-1",
          tone.text,
        )}
      >
        {label}
        <ChevronDown
          className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="absolute left-0 top-full z-40 mt-3 w-80 rounded-2xl border border-white/10 bg-[#1a2234] p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]"
          >
            {items.map((item, index) => {
              const Icon = iconFor(item.icon);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  role="menuitem"
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  onKeyDown={(e) => onItemKeyDown(e, index)}
                  onClick={close}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:bg-white/[0.06]"
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-lg ring-1 ring-inset",
                      tone.tile,
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
