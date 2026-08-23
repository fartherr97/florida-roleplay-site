import { cn } from "../../lib/cn";

/**
 * The single button primitive for the whole site. Polymorphic via `as` so it can
 * render a react-router <Link> or an <a> while keeping identical styling.
 */
const VARIANTS = {
  primary:
    "text-white bg-primary-500 hover:bg-primary-600 shadow-[0_10px_30px_-10px_rgba(242,128,13,0.7)] hover:shadow-[0_14px_36px_-10px_rgba(242,128,13,0.8)]",
  secondary:
    "text-slate-200 bg-surface-1 ring-1 ring-inset ring-white/[0.08] hover:ring-white/20 hover:text-white",
  ghost:
    "text-slate-200 bg-white/[0.02] ring-1 ring-inset ring-white/10 hover:bg-white/[0.06]",
  discord: "text-white bg-[#5865f2] hover:bg-[#4752c4]",
  danger: "text-white bg-rose-600 hover:bg-rose-500",
};

const SIZES = {
  sm: "h-9 px-4 text-sm gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-14 px-6 text-base gap-2.5",
};

const BASE =
  "inline-flex items-center justify-center rounded-xl font-bold tracking-tight " +
  "transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/70 " +
  "disabled:opacity-50 disabled:pointer-events-none";

export default function Button({
  as: Tag = "button",
  variant = "primary",
  size = "md",
  block = false,
  className,
  ...props
}) {
  return (
    <Tag
      className={cn(
        BASE,
        VARIANTS[variant] ?? VARIANTS.primary,
        SIZES[size] ?? SIZES.md,
        block && "w-full",
        className,
      )}
      {...props}
    />
  );
}
