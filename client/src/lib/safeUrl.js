/**
 * Filters a URL that came out of stored content before it reaches an href.
 *
 * Department configs, form resource links and the staff portal's link lists are
 * all editable, so their URLs are whatever an author typed. React already
 * refuses to navigate a `javascript:` href, so this is not what stands between
 * the site and script execution — what it prevents is a link that looks live,
 * does nothing when clicked, and logs a React security error instead of saying
 * the address is unusable.
 *
 * http(s) and site-relative paths only. Anything else returns "" so the caller
 * can render the label without a link rather than an href that misleads.
 */
export function safeUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  // Site-relative, but not protocol-relative (//evil.example is not local).
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

/** True when a URL points off-site, so the caller knows to open a new tab. */
export function isExternal(url) {
  return /^https?:\/\//i.test(url);
}

export default safeUrl;
