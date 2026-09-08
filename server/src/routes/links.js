/**
 * The /api/links router — the community URL shortener's management API.
 *
 * Creating, editing and removing short links needs `shortener.use` (Department
 * Heads, dev leadership, Directorship and Ownership by default). Adding or
 * removing the subdomains links live on needs `shortener.admin` (Ownership).
 * The public redirect itself is not here — it is served ahead of the SPA in
 * index.js so a bare `go.flrp.us/abc` resolves without an /api hop.
 */
import { Router } from "express";
import { requirePermission } from "../middleware/requirePermission.js";
import { str } from "../validate.js";
import * as shortener from "../lib/shortener.js";

const router = Router();

/** Everything the management page needs in one read: the links and the domains. */
router.get("/", requirePermission("shortener.use"), async (_req, res) => {
  try {
    const [links, domains] = await Promise.all([shortener.listLinks(), shortener.listDomains()]);
    return res.json({ links, domains });
  } catch {
    return res.json({ links: [], domains: [], message: "The shortener store is unavailable right now." });
  }
});

router.post("/", requirePermission("shortener.use"), async (req, res) => {
  const host = shortener.normalizeHost(req.body?.host);
  const targetUrl = str(req.body?.targetUrl).trim();
  const note = str(req.body?.note).slice(0, 200);
  let slug = str(req.body?.slug).trim();

  if (!shortener.validTarget(targetUrl)) {
    return res.status(400).json({ ok: false, message: "Enter a full URL starting with http:// or https://." });
  }
  const domain = await shortener.getDomainByHost(host);
  if (!domain || !domain.active) {
    return res.status(400).json({ ok: false, message: "Pick a subdomain that's been set up." });
  }
  if (slug) {
    if (!shortener.validSlug(slug)) {
      return res.status(400).json({ ok: false, message: "A custom slug can use letters, numbers, dashes and underscores only." });
    }
  } else {
    slug = shortener.randomSlug();
  }

  try {
    const link = await shortener.createLink({
      host,
      slug,
      targetUrl,
      note,
      actorId: req.user?.id ?? null,
      actorName: req.user?.displayName ?? null,
    });
    return res.json({ ok: true, link });
  } catch (err) {
    if (String(err?.code) === "23505") {
      return res.status(409).json({ ok: false, message: "That slug is already taken on this subdomain — pick another." });
    }
    return res.status(500).json({ ok: false, message: "Couldn't create that short link." });
  }
});

router.patch("/:id", requirePermission("shortener.use"), async (req, res) => {
  const fields = {};
  if (req.body?.targetUrl !== undefined) {
    const targetUrl = str(req.body.targetUrl).trim();
    if (!shortener.validTarget(targetUrl)) {
      return res.status(400).json({ ok: false, message: "Enter a full URL starting with http:// or https://." });
    }
    fields.targetUrl = targetUrl;
  }
  if (req.body?.slug !== undefined) {
    const slug = str(req.body.slug).trim();
    if (!shortener.validSlug(slug)) {
      return res.status(400).json({ ok: false, message: "A slug can use letters, numbers, dashes and underscores only." });
    }
    fields.slug = slug;
  }
  if (req.body?.note !== undefined) fields.note = str(req.body.note).slice(0, 200);
  if (typeof req.body?.active === "boolean") fields.active = req.body.active;

  try {
    const link = await shortener.updateLink(str(req.params.id), fields);
    if (!link) return res.status(404).json({ ok: false, message: "No such short link." });
    return res.json({ ok: true, link });
  } catch (err) {
    if (String(err?.code) === "23505") {
      return res.status(409).json({ ok: false, message: "That slug is already taken on this subdomain." });
    }
    return res.status(500).json({ ok: false, message: "Couldn't update that short link." });
  }
});

router.delete("/:id", requirePermission("shortener.use"), async (req, res) => {
  try {
    await shortener.deleteLink(str(req.params.id));
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, message: "Couldn't remove that short link." });
  }
});

/* ------------------------------------------------------- domains (Ownership) */

router.post("/domains", requirePermission("shortener.admin"), async (req, res) => {
  const host = shortener.normalizeHost(req.body?.host);
  const label = str(req.body?.label).slice(0, 120);
  if (!shortener.validHost(host)) {
    return res.status(400).json({ ok: false, message: "Enter a valid subdomain, e.g. go.flrp.us." });
  }
  try {
    const domain = await shortener.addDomain({ host, label, actorId: req.user?.id ?? null });
    return res.json({ ok: true, domain });
  } catch {
    return res.status(500).json({ ok: false, message: "Couldn't add that subdomain." });
  }
});

router.delete("/domains/:id", requirePermission("shortener.admin"), async (req, res) => {
  try {
    await shortener.removeDomain(str(req.params.id));
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, message: "Couldn't remove that subdomain." });
  }
});

export default router;
