/** Joins truthy class name parts into a single className string. */
export function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}
