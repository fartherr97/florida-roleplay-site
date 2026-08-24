import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut } from "lucide-react";
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
export default function UserChip({ className, showRank = false }) {
  const { user, loading, hasPermission, previewRank, signOut } = useAuth();
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
  // The band a rank sits in, for the line under the name. Read off the ladder
  // rather than hard-coded, so a tier added above Ownership needs nothing here.
  const tier = tierFor(rank);
  const staff = hasPermission("staff.view");

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
        {/* The rank line only appears where there is room for it and where it
            means something — inside a hub. On the public site the chip stays a
            name, because a visitor's rank is not what they are there for. */}
        <span className="hidden min-w-0 sm:block text-left">
          <span className="block max-w-[11rem] truncate text-sm font-medium leading-tight text-slate-200">
            {showRank && rank ? `${rank} · ${user.displayName || user.username}` : user.displayName || user.username}
          </span>
          {showRank && tier && (
            <span className="block truncate text-[10px] font-bold uppercase leading-tight tracking-[0.14em] text-primary-400">
              {tier}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div
          role="menu"
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
          {staff && (
            <Link
              to="/staff"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              <LayoutDashboard className="size-4 text-slate-500" />
              Staff Hub
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-300 transition hover:bg-rose-500/10 hover:text-rose-200"
          >
            <LogOut className="size-4 text-slate-500" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Which band a rank belongs to, for the line under the name in a hub. */
const TIERS = [
  { label: "Ownership", ranks: ["Ownership"] },
  { label: "Leadership", ranks: ["Directorship", "Head Admin"] },
  { label: "Administration", ranks: ["Sr. Admin", "Admin", "Jr. Admin"] },
  { label: "Moderation", ranks: ["Sr. Mod", "Mod", "Trial Mod"] },
];

function tierFor(rank) {
  if (!rank) return null;
  return TIERS.find((tier) => tier.ranks.includes(rank))?.label ?? null;
}
