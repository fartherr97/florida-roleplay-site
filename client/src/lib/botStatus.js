/**
 * Shared status vocabulary for the bot dashboard — kept out of the page
 * components so a file that exports one of these does not also export a
 * component.
 */

/** The badge tone for a sync issue's severity. */
export function severityTone(severity) {
  const key = String(severity ?? "").toUpperCase();
  if (key === "CRITICAL" || key === "ERROR") return "rose";
  if (key === "WARNING" || key === "WARN") return "amber";
  return "slate";
}

/**
 * The badge tone for a job's status. PAUSED is amber rather than red on
 * purpose: it is a safety guard tripping, not a failure, and colouring it like
 * one teaches people to dismiss the status that most deserves reading.
 */
export function jobTone(status) {
  if (status === "COMPLETED") return "green";
  if (status === "FAILED") return "rose";
  if (status === "PAUSED" || status === "PARTIAL") return "amber";
  if (status === "CANCELLED") return "slate";
  return "brand";
}
