import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";

/**
 * Custom dropdown used instead of a native <select> so the popover can match the
 * rest of the design system. Accepts options as plain strings or {value,label}.
 *
 * The listbox is portalled to <body> and positioned with `fixed` off the
 * trigger's rect, so it is never clipped by an ancestor that scrolls or hides
 * its overflow — most importantly a Modal's scrolling body, where an absolutely
 * positioned popover used to be cut to a sliver. It follows the trigger on
 * scroll and resize, and flips above when there isn't room below.
 */
function normalize(option) {
  return typeof option === "string" ? { value: option, label: option } : option;
}

const GAP = 8;
const MAX_HEIGHT = 288; // matches max-h-72

export default function Select({
  value,
  onChange,
  options = [],
  placeholder = "Select an option",
  id,
  className,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const items = options.map(normalize);
  const selected = items.find((o) => o.value === value);

  const reposition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - GAP;
    // Flip above only when there is clearly more room there.
    const flip = below < Math.min(MAX_HEIGHT, 200) && r.top - GAP > below;
    setRect({
      left: r.left,
      width: r.width,
      top: r.bottom + GAP,
      bottom: window.innerHeight - r.top + GAP,
      flip,
      space: Math.max(120, flip ? r.top - GAP * 2 : below),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (listRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Capture so a scroll inside the Modal body (not the window) still updates us.
    const onScroll = () => reposition();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, reposition]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-12 w-full items-center justify-between gap-2 rounded-2xl bg-black/30 px-4 text-left text-sm",
          "ring-1 ring-inset ring-white/10 transition focus:outline-none focus:ring-2 focus:ring-brand-500/70",
          "disabled:opacity-50 disabled:pointer-events-none",
          selected ? "text-slate-100" : "text-slate-500",
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-slate-400 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && rect && (
              <motion.ul
                ref={listRef}
                role="listbox"
                initial={{ opacity: 0, y: rect.flip ? 6 : -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: rect.flip ? 6 : -6, scale: 0.98 }}
                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  position: "fixed",
                  left: rect.left,
                  width: rect.width,
                  maxHeight: Math.min(MAX_HEIGHT, rect.space),
                  ...(rect.flip ? { bottom: rect.bottom } : { top: rect.top }),
                }}
                className="z-[60] overflow-auto rounded-2xl border border-white/10 bg-[#1a2234] p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]"
              >
                {items.map((option) => {
                  const active = option.value === value;
                  return (
                    <li key={option.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          onChange?.(option.value);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition",
                          active
                            ? "bg-primary-500/15 text-white"
                            : "text-slate-300 hover:bg-white/[0.06]",
                        )}
                      >
                        <span className="truncate">{option.label}</span>
                        {active && <Check className="size-4 shrink-0 text-primary-400" />}
                      </button>
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
