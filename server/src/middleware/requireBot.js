/**
 * Bot authentication for the roster sync endpoints.
 *
 * The Discord bot is not a Discord user, so it does not go through requireRole.
 * It presents a shared secret instead: `Authorization: Bearer <BOT_TOKEN>`.
 *
 * If BOT_TOKEN is unset the sync endpoints are refused outright rather than
 * being left open — an unauthenticated endpoint that rewrites the roster and
 * everyone's Discord nickname is not something to leave to a default.
 */
import { timingSafeEqual } from "node:crypto";

/** Constant-time compare that tolerates differing lengths. */
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function requireBot(req, res, next) {
  const expected = process.env.BOT_TOKEN;

  if (!expected) {
    return res.status(503).json({
      ok: false,
      code: "BOT_TOKEN_UNSET",
      message:
        "Roster sync is disabled: BOT_TOKEN is not configured on the server.",
    });
  }

  const header = req.get("authorization") || "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!presented || !safeEqual(presented, expected)) {
    return res.status(401).json({
      ok: false,
      code: "BOT_UNAUTHORISED",
      message: "A valid bot token is required for roster sync.",
    });
  }

  req.isBot = true;
  return next();
}

export default requireBot;
