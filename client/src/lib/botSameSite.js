/**
 * Advisory check for the failure mode the bot API's session cookies have.
 *
 * Sessions are `SameSite=Lax`. If the API is not same-site with the page, the
 * browser silently declines to send the session cookie: every authenticated
 * call comes back 401, there is no CORS error, and the network tab shows a
 * request that looks entirely normal. It is the least diagnosable failure in
 * the whole integration, so the dashboard names it up front rather than letting
 * somebody spend an afternoon on it.
 *
 * The comparison is a heuristic, not the public suffix list: it compares the
 * last two labels of each host. That is right for `api.example.com` against
 * `example.com`, and wrong for multi-part suffixes like `example.co.uk`, where
 * it will fail to warn about two genuinely different sites. It only ever
 * produces a warning, never a block, so the cost of being wrong is a missing
 * hint rather than a broken dashboard.
 */

/** The last two labels of a hostname — "api.example.com" → "example.com". */
function registrableish(hostname) {
  const labels = String(hostname || "").toLowerCase().split(".");
  return labels.slice(-2).join(".");
}

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Returns null when things look fine, or a description of the problem.
 * `kind` is "unset" | "unparsable" | "cross-site".
 */
export function checkApiOrigin(apiUrl, pageOrigin) {
  if (!apiUrl) {
    return {
      kind: "unset",
      title: "The bot API address is not configured",
      detail:
        "VITE_API_URL is empty, so the dashboard has nothing to call. Set it in the client's environment and rebuild — see client/.env.example.",
    };
  }

  let api;
  let page;
  try {
    api = new URL(apiUrl);
    page = new URL(pageOrigin);
  } catch {
    return {
      kind: "unparsable",
      title: "The bot API address is not a valid URL",
      detail: `VITE_API_URL is set to "${apiUrl}", which is not a URL the browser can parse.`,
    };
  }

  // Everything on localhost is same-site with everything else on localhost,
  // whatever the port, so local development never trips this.
  if (LOCAL.has(api.hostname) || LOCAL.has(page.hostname)) return null;

  if (registrableish(api.hostname) === registrableish(page.hostname)) return null;

  return {
    kind: "cross-site",
    title: "The bot API is on a different site from this page",
    detail:
      `This page is on ${page.hostname} and the API is on ${api.hostname}. The API's ` +
      "session cookies are SameSite=Lax, so the browser will not send them across " +
      "those two — every signed-in request will come back 401 with nothing in the " +
      "network tab to explain it. The API needs to be a subdomain of whatever domain " +
      "serves this site.",
  };
}

/** The check for the running app. */
export function apiOriginProblem() {
  if (typeof window === "undefined") return null;
  return checkApiOrigin(import.meta.env.VITE_API_URL, window.location.origin);
}
