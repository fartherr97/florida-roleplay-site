import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

/**
 * Portalled dialog with a blurred scrim. Closes on backdrop click and Escape;
 * locks body scroll while open.
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  className,
  children,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            // A plain scrim, not a backdrop-blur. Blurring the whole viewport forces
            // the browser to re-composite everything behind the dialog on every repaint
            // — so a modal over a long roster stutters on each keystroke. A darker solid
            // scrim reads the same and costs nothing per frame.
            className="absolute inset-0 bg-black/70"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              "card relative w-full overflow-hidden shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]",
              // `cn` is a plain join, not tailwind-merge, so a hardcoded max-width would
              // sit alongside a caller's `max-w-*` and win by CSS order — leaving "wide"
              // modals rendering narrow. Only apply the default when none was passed.
              !/(?:^|\s)max-w-/.test(className ?? "") && "max-w-lg",
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
              <div className="min-w-0">
                {title && (
                  <h2 className="truncate text-base font-bold text-white">{title}</h2>
                )}
                {subtitle && (
                  <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 ring-1 ring-inset ring-white/10 transition hover:text-white hover:bg-white/[0.06]"
              >
                <X className="size-4" />
              </button>
            </div>
            {/* Scrolls rather than clipping: the card sets overflow-hidden, so a
                form taller than the window would otherwise lose its footer. */}
            <div className="max-h-[calc(100vh-9rem)] overflow-y-auto p-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
