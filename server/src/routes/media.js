/**
 * The community image host.
 *
 * Uploaded images live in the database, not on disk — Northflank wipes a container's
 * filesystem on every redeploy, so anything written there would vanish. Each image is keyed
 * by a random id that is also its public URL (`/images/<id>`), served straight from the row.
 *
 * Two boundaries matter here:
 *   - **Only raster images.** SVG is an image that can carry a script, and serving one from a
 *     flrp.us subdomain would run that script in our origin. The upload sniffs the bytes and
 *     accepts only PNG, JPEG, GIF and WEBP — a spoofed content-type does not get in.
 *   - **The serve route is public and the write routes are gated.** Anyone with a link can
 *     view an image (that is the point of a host); uploading or removing one needs the
 *     `media.upload` permission.
 */
import { randomBytes } from "node:crypto";
import express, { Router } from "express";
import { execute, query } from "../db.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { str } from "../validate.js";

const router = Router();

/** Accepted image types, and the extension each gets in its public id. */
const ALLOWED = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** 10 MB per image — comfortably above a screenshot, well below a problem. */
const MAX_BYTES = 10 * 1024 * 1024;

/** The public id pattern: 16 hex characters and one of the allowed extensions. */
const ID_RE = /^[a-f0-9]{16}\.(png|jpg|gif|webp)$/;

/**
 * The real content type of a buffer from its magic bytes, or null when it is not one of the
 * accepted image types. This is what makes a renamed `.png` that is really an HTML file — or
 * an SVG — fail to upload, rather than being trusted on its declared type.
 */
function sniff(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "image/gif";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * The absolute link to an image. Prefers MEDIA_PUBLIC_BASE (e.g. https://cdn.flrp.us) so the
 * host can move behind a CDN subdomain without touching the code; falls back to the origin the
 * request came in on so it works before that subdomain exists.
 */
function publicUrl(req, id) {
  const base = (process.env.MEDIA_PUBLIC_BASE || "").replace(/\/+$/, "");
  if (base) return `${base}/images/${id}`;
  return `${req.protocol}://${req.get("host")}/images/${id}`;
}

function shape(row, req) {
  return {
    id: row.id,
    url: publicUrl(req, row.id),
    size: row.size,
    contentType: row.content_type ?? row.contentType,
    originalName: row.original_name ?? row.originalName ?? null,
    uploadedByName: row.uploaded_by_name ?? row.uploadedByName ?? null,
    uploadedById: row.uploaded_by_id ?? row.uploadedById ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
  };
}

function noStore(res) {
  return res.status(503).json({
    ok: false,
    code: "MEDIA_NO_STORE",
    message: "The image host needs a database. Nothing was stored.",
  });
}

/* ------------------------------------------------------------------ *
 * Authenticated API (mounted under /api/media)
 * ------------------------------------------------------------------ */

/** The recent uploads, newest first — a shared gallery for everyone who may host. */
router.get("/", requirePermission("media.upload"), async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, content_type, size, original_name, uploaded_by_id, uploaded_by_name, created_at
         FROM media_images ORDER BY created_at DESC LIMIT 200`,
    );
    return res.json({ images: rows.map((row) => shape(row, req)) });
  } catch {
    return res.json({ images: [] });
  }
});

// Authorise before buffering: an unauthorised caller is turned away without our reading a
// 10 MB body off the wire. `express.raw` then hands the whole image to the handler as a Buffer.
router.post(
  "/",
  requirePermission("media.upload"),
  express.raw({ type: () => true, limit: MAX_BYTES }),
  async (req, res) => {
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length === 0) {
      return res.status(400).json({ ok: false, code: "MEDIA_EMPTY", message: "No image was received." });
    }

    const contentType = sniff(buf);
    if (!contentType || !ALLOWED[contentType]) {
      return res.status(415).json({
        ok: false,
        code: "MEDIA_TYPE",
        message: "Only PNG, JPEG, GIF or WEBP images can be hosted.",
      });
    }

    const id = `${randomBytes(8).toString("hex")}.${ALLOWED[contentType]}`;
    const originalName = str(req.get("x-filename") ?? "").slice(0, 200);

    try {
      await execute(
        `INSERT INTO media_images
           (id, content_type, bytes, size, original_name, uploaded_by_id, uploaded_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          contentType,
          buf,
          buf.length,
          originalName || null,
          req.user.id,
          req.user.displayName ?? req.user.username ?? null,
        ],
      );
    } catch {
      return noStore(res);
    }

    return res.status(201).json({
      ok: true,
      image: shape(
        {
          id,
          content_type: contentType,
          size: buf.length,
          original_name: originalName || null,
          uploaded_by_id: req.user.id,
          uploaded_by_name: req.user.displayName ?? req.user.username ?? null,
          created_at: new Date().toISOString(),
        },
        req,
      ),
    });
  },
);

/** Remove an image. Any holder may tidy the shared host. */
router.delete("/:id", requirePermission("media.upload"), async (req, res) => {
  const id = String(req.params.id);
  if (!ID_RE.test(id)) return res.status(400).json({ ok: false, message: "Not an image id." });
  try {
    await execute(`DELETE FROM media_images WHERE id = $1`, [id]);
  } catch {
    return noStore(res);
  }
  return res.json({ ok: true });
});

/* ------------------------------------------------------------------ *
 * Public serving (mounted at /images)
 * ------------------------------------------------------------------ */

export const serve = Router();

serve.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  if (!ID_RE.test(id)) return res.status(404).end();

  let row;
  try {
    const rows = await query(
      `SELECT content_type, bytes FROM media_images WHERE id = $1 LIMIT 1`,
      [id],
    );
    row = rows[0];
  } catch {
    return res.status(404).end();
  }
  if (!row) return res.status(404).end();

  res.setHeader("Content-Type", row.content_type);
  // Ids are unique and immutable, so a hosted image can be cached hard and forever.
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  // Never let a browser second-guess the type — this is user-supplied content.
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");
  return res.end(row.bytes);
});

export default router;
