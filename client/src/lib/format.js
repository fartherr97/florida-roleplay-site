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

/**
 * A timestamp with the time of day, for log and audit rows where "which day"
 * is not precise enough. Rendered in UTC like every other date on the site, so
 * two people comparing entries never see different times.
 */
export function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

/**
 * "1 rank" / "2 ranks". Counts sit next to nouns all over the dashboard, and
 * "1 members" reads as a bug even when the number is right.
 */
export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
