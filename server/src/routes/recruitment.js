/**
 * The /api/recruitment router — the public Applications page's API.
 *
 * The GET is public: anyone can see which departments are open and where the
 * Apply Now button goes. Setting a department's recruitment status (Open,
 * Closed, Open Interviews with an until-date) needs `applications.manage`
 * (Department Heads, Directorship and Ownership). Adding or removing the
 * departments themselves and editing the Apply Now URLs needs
 * `applications.admin` (Ownership).
 *
 * This is deliberately separate from the on-site application-form engine at
 * /api/applications — that engine builds and receives forms; this is the public
 * directory of where each department's recruitment currently stands.
 */
import { Router } from "express";
import { requirePermission } from "../middleware/requirePermission.js";
import { str } from "../validate.js";
import * as recruitment from "../lib/recruitment.js";

const router = Router();

/** Public: the departments and the recruitment statuses they can be in. */
router.get("/", async (_req, res) => {
  try {
    const departments = await recruitment.listDepartments();
    return res.json({ departments, statuses: recruitment.APPLICATION_STATUSES });
  } catch {
    return res.json({
      departments: [],
      statuses: recruitment.APPLICATION_STATUSES,
      message: "The applications directory is unavailable right now.",
    });
  }
});

/* --------------------------------------------- status (applications.manage) */

router.patch("/:id/status", requirePermission("applications.manage"), async (req, res) => {
  const status = str(req.body?.status).trim();
  if (!recruitment.validStatus(status)) {
    return res.status(400).json({ ok: false, message: "Pick a valid status." });
  }

  // Only Open Interviews carries an until-date; any other status clears it.
  let interviewsUntil = null;
  if (status === "interviews" && req.body?.interviewsUntil) {
    const norm = recruitment.normalizeUntil(req.body.interviewsUntil);
    if (norm === undefined) {
      return res.status(400).json({ ok: false, message: "Enter the interview close date as YYYY-MM-DD." });
    }
    interviewsUntil = norm;
  }

  try {
    const department = await recruitment.setStatus(str(req.params.id), {
      status,
      interviewsUntil,
      actorId: req.user?.id ?? null,
      actorName: req.user?.displayName ?? null,
    });
    if (!department) return res.status(404).json({ ok: false, message: "No such department." });
    return res.json({ ok: true, department });
  } catch {
    return res.status(500).json({ ok: false, message: "Couldn't update that department." });
  }
});

/* ------------------------------------ departments & apply URLs (Ownership) */

router.post("/", requirePermission("applications.admin"), async (req, res) => {
  const name = str(req.body?.name).trim().slice(0, 160);
  const shortName = str(req.body?.shortName).trim().slice(0, 40);
  const accent = str(req.body?.accent).trim().slice(0, 40);
  const blurb = str(req.body?.blurb).trim().slice(0, 400);
  const logoUrl = str(req.body?.logoUrl).trim();
  const applyUrl = str(req.body?.applyUrl).trim();

  if (!name) {
    return res.status(400).json({ ok: false, message: "Give the department a name." });
  }
  if (!recruitment.validApplyUrl(applyUrl)) {
    return res.status(400).json({ ok: false, message: "The Apply Now link must be a full http:// or https:// URL." });
  }
  if (!recruitment.validApplyUrl(logoUrl)) {
    return res.status(400).json({ ok: false, message: "The logo must be a full http:// or https:// image URL." });
  }

  try {
    const department = await recruitment.createDepartment({
      name,
      shortName,
      accent,
      blurb,
      logoUrl,
      applyUrl,
      actorId: req.user?.id ?? null,
      actorName: req.user?.displayName ?? null,
    });
    return res.json({ ok: true, department });
  } catch {
    return res.status(500).json({ ok: false, message: "Couldn't add that department." });
  }
});

router.put("/:id", requirePermission("applications.admin"), async (req, res) => {
  const fields = {};
  if (req.body?.name !== undefined) {
    const name = str(req.body.name).trim().slice(0, 160);
    if (!name) return res.status(400).json({ ok: false, message: "Give the department a name." });
    fields.name = name;
  }
  if (req.body?.shortName !== undefined) fields.shortName = str(req.body.shortName).trim().slice(0, 40);
  if (req.body?.accent !== undefined) fields.accent = str(req.body.accent).trim().slice(0, 40);
  if (req.body?.blurb !== undefined) fields.blurb = str(req.body.blurb).trim().slice(0, 400);
  if (req.body?.logoUrl !== undefined) {
    const logoUrl = str(req.body.logoUrl).trim();
    if (!recruitment.validApplyUrl(logoUrl)) {
      return res.status(400).json({ ok: false, message: "The logo must be a full http:// or https:// image URL." });
    }
    fields.logoUrl = logoUrl;
  }
  if (req.body?.applyUrl !== undefined) {
    const applyUrl = str(req.body.applyUrl).trim();
    if (!recruitment.validApplyUrl(applyUrl)) {
      return res.status(400).json({ ok: false, message: "The Apply Now link must be a full http:// or https:// URL." });
    }
    fields.applyUrl = applyUrl;
  }

  try {
    const department = await recruitment.updateDepartment(str(req.params.id), fields);
    if (!department) return res.status(404).json({ ok: false, message: "No such department." });
    return res.json({ ok: true, department });
  } catch {
    return res.status(500).json({ ok: false, message: "Couldn't update that department." });
  }
});

router.delete("/:id", requirePermission("applications.admin"), async (req, res) => {
  try {
    await recruitment.deleteDepartment(str(req.params.id));
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, message: "Couldn't remove that department." });
  }
});

export default router;
