import { cn } from "../../lib/cn";

/** Hairline-bordered navy panel. `hover` adds the lift-and-glow interaction. */
export default function Card({
  as: Tag = "div",
  hover = false,
  className,
  ...props
}) {
  return (
    <Tag className={cn("card", hover && "card-hover", className)} {...props} />
  );
}
