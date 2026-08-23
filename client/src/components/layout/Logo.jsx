import { SITE } from "../../data/mockData";
import { cn } from "../../lib/cn";

/** Square brand emblem. `size` takes a Tailwind size-* utility. */
export default function Logo({ size = "size-8", className }) {
  return (
    <img
      src={SITE.logoUrl}
      alt=""
      aria-hidden="true"
      className={cn(size, "rounded-lg object-cover", className)}
    />
  );
}
