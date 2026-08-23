import { Link } from "react-router-dom";
import Button from "../ui/Button";
import { useAuth } from "../../context/useAuth";
import { STAFF_ANY } from "../../data/hubs";
import { cn } from "../../lib/cn";

/**
 * Avatar + username pill in the top bar. Signed out it becomes a ghost Sign In
 * button instead, so the bar never shows an empty slot. The username drops away
 * below `sm` so the chip stays a bare avatar on narrow phones.
 */
export default function UserChip({ className }) {
  const { user, loading, hasRole } = useAuth();

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

  // Only staff have somewhere to go from the chip; everyone else gets a plain pill.
  const staff = hasRole(STAFF_ANY);
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
      <span className="hidden max-w-[9rem] truncate text-sm font-medium text-slate-200 sm:block">
        {user.displayName || user.username}
      </span>
    </Tag>
  );
}
