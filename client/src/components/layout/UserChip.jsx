import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../../context/useAuth";
import { PREVIEW_RANKS } from "../../data/mockData";
import Button from "../ui/Button";
import { cn } from "../../lib/cn";

/**
 * Avatar + username pill in the top bar. Signed out it becomes a ghost Sign In
 * button so the bar never shows an empty slot; signed in it opens a small menu
 * with the Staff Hub (for staff) and a real Sign out that ends the Discord
 * session server-side. The username drops away below `sm` so the chip stays a
 * bare avatar on narrow phones.
 */
export default function UserChip({ className }) {
  const { user, loading, previewRank, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the menu on an outside click or Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (loading) {
    return (
      <div
        className={cn(
          "h-9 w-28 animate-pulse rounded-full bg-white/[0.04]",
          className,
        )}
      />
    );
  }

  if (!user) {
    return (
      <Button
        as={Link}
        to="/sign-in"
        variant="ghost"
        size="sm"
        className={className}
      >
        Sign In
      </Button>
    );
  }

  const initials = (user.displayName || user.username || "?")
    .split(/[\s.]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const rank = PREVIEW_RANKS.find((r) => r.id === previewRank)?.label ?? user.rank ?? null;

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate("/");
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2.5 rounded-full bg-white/[0.03] p-1 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] sm:pr-3",
          className,
        )}
      >
        <span className="relative">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt=""
              className="size-8 rounded-full object-cover"
            />
          ) : (
            <span className="grid size-8 place-items-center rounded-full bg-primary-500/20 text-[11px] font-bold text-primary-300">
              {initials}
            </span>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0a0e1a]" />
        </span>
        {/* Just the member's Discord main-guild display name — no rank prefix
            or tier line. The name is the member's own; their rank is on their
            roster, not stamped in front of them here. */}
        <span className="hidden min-w-0 sm:block text-left">
          <span className="block max-w-[11rem] truncate text-sm font-medium leading-tight text-slate-200">
            {user.displayName || user.username}
          </span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-52 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d1220] p-1.5 shadow-xl shadow-black/40"
          >
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-medium text-slate-200">
                {user.displayName || user.username}
              </p>
              {rank && (
                <p className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-primary-400">
                  {rank}
                </p>
              )}
            </div>
            <div className="my-1 h-px bg-white/[0.06]" />
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-300 transition hover:bg-rose-500/10 hover:text-rose-200"
            >
              <LogOut className="size-4 text-slate-500" />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
