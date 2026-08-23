/** Shared date formatting so every page renders dates identically. */
export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Splits an ISO date into the parts a date chip renders. */
export function dateParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { month: "", day: "", year: "" };
  return {
    month: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
    day: String(date.getUTCDate()).padStart(2, "0"),
    year: String(date.getUTCFullYear()),
  };
}
