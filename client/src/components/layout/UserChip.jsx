import { Link } from "react-router-dom";
import Button from "../ui/Button";
import { useAuth } from "../../context/useAuth";
import { PREVIEW_RANKS } from "../../data/mockData";

import { cn } from "../../lib/cn";

/**
 * Avatar + username pill in the top bar. Signed out it becomes a ghost Sign In
 * button instead, so the bar never shows an empty slot. The username drops away
 * below `sm` so the chip stays a bare avatar on narrow phones.
 */
export default function UserChip({ className, showRank = false }) {
  const { user, loading, hasPermission, previewRank } = useAuth();

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

  // Only staff have somewhere to go from the chip; everyone else gets a plain pill.
  const staff = hasPermission("staff.view");
  const Tag = staff ? Link : "span";

  return (
    <Tag
      to={staff ? "/staff" : undefined}
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
      <span className="hidden min-w-0 sm:block">
        <span className="block max-w-[11rem] truncate text-sm font-medium leading-tight text-slate-200">
          {showRank && rank ? `${rank} · ${user.displayName || user.username}` : user.displayName || user.username}
        </span>
        {showRank && tier && (
          <span className="block truncate text-[10px] font-bold uppercase leading-tight tracking-[0.14em] text-primary-400">
            {tier}
          </span>
        )}
      </span>
    </Tag>
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
