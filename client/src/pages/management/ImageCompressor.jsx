import { useCallback, useMemo, useRef, useState } from "react";
import { Download, Eraser, ImageDown, Minimize2, Pipette, RefreshCcw, UploadCloud } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";

/**
 * The management image compressor.
 *
 * Everything runs in the browser — the file never leaves the member's machine
 * and the server does no work — so this is a pure client page gated by the
 * media.compress permission (Directorship and up). You pick an image, optionally
 * knock out a solid background to transparency, type the file size you need, and
 * it shrinks the image to hit that size while keeping quality as high as it can.
 *
 * Background removal is colour-key, not AI: a chosen background colour (auto-
 * sampled from the corners, picked off the image, or set by hand) is matched
 * against every pixel; pixels within the tolerance become fully transparent and
 * pixels just outside it fade out over a softness band, so edges stay clean. It
 * shines on logos, badges and screenshots on a solid/near-solid background; it
 * is not meant to cut a subject out of a busy photo.
 *
 * How it hits a target size: the (optionally cut-out) image is drawn to a canvas
 * and re-encoded. Quality is the first lever — a binary search finds the highest
 * quality whose output still fits under the target. Only once quality is
 * exhausted is the canvas scaled down a step at a time. PNG is lossless, so for
 * PNG only downscaling applies.
 */

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"];
const MAX_INPUT_BYTES = 40 * 1024 * 1024; // 40 MB source cap — plenty for a photo.

const FORMATS = [
  { value: "image/webp", label: "WebP — best quality per KB, keeps transparency (recommended)" },
  { value: "image/jpeg", label: "JPEG — most compatible, no transparency" },
  { value: "image/png", label: "PNG — lossless, keeps transparency" },
];
// JPEG has no alpha channel, so it can't hold a removed background.
const ALPHA_FORMATS = FORMATS.filter((f) => f.value !== "image/jpeg");

const UNITS = [
  { value: "KB", label: "KB", factor: 1024 },
  { value: "MB", label: "MB", factor: 1024 * 1024 },
];

function prettySize(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function extFor(type) {
  return type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg";
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex).trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [255, 255, 255];
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/** Encode a canvas to a Blob at a given quality, promisified. */
function encode(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Knock a solid background colour out to transparency. Returns a full-resolution
 * canvas: pixels within `tolerance` of the key colour go fully transparent, and
 * pixels within a further `softness` band fade out, so the cutout keeps a clean
 * anti-aliased edge instead of a hard jagged one.
 */
function removeBackground(source, keyColor, tolerance, softness) {
  const w = source.width;
  const h = source.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const [kr, kg, kb] = keyColor;
  const inner = (tolerance / 100) * 300; // fully-transparent threshold
  const band = Math.max(1, (softness / 100) * 140); // feather width beyond it
  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - kr;
    const dg = d[i + 1] - kg;
    const db = d[i + 2] - kb;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist <= inner) {
      d[i + 3] = 0;
    } else if (dist <= inner + band) {
      d[i + 3] = Math.round(d[i + 3] * ((dist - inner) / band));
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** Average the four corner pixels — the usual "what's the background" guess. */
function autoKeyColor(source) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);
  const pts = [
    [0, 0],
    [source.width - 1, 0],
    [0, source.height - 1],
    [source.width - 1, source.height - 1],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [x, y] of pts) {
    const p = ctx.getImageData(x, y, 1, 1).data;
    r += p[0];
    g += p[1];
    b += p[2];
  }
  return [Math.round(r / 4), Math.round(g / 4), Math.round(b / 4)];
}

/** Draw a drawable (bitmap or canvas) onto a fresh canvas at a scale factor. */
function drawScaled(source, scale, matte) {
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  // A white matte behind a JPEG (which has no alpha) keeps transparent areas
  // from turning black. Skipped when we want to keep transparency.
  if (matte) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(source, 0, 0, w, h);
  return { canvas, width: w, height: h };
}

/**
 * Compress a drawable to under `targetBytes`. Returns the smallest-quality-loss
 * result that fits, or the best effort at the lowest settings if the target is
 * smaller than the format can reach. `transparent` keeps the alpha channel.
 */
async function compressToTarget(source, { type, targetBytes, maxDimension, transparent }) {
  const matte = type === "image/jpeg" && !transparent;

  const longest = Math.max(source.width, source.height);
  let scale = maxDimension && longest > maxDimension ? maxDimension / longest : 1;

  // PNG is lossless — quality is ignored, so only scaling changes its size.
  if (type === "image/png") {
    let best = null;
    for (let i = 0; i < 12; i += 1) {
      const { canvas, width, height } = drawScaled(source, scale, matte);
      // eslint-disable-next-line no-await-in-loop
      const blob = await encode(canvas, type, 1);
      if (blob) best = { blob, width, height, quality: null };
      if (blob && blob.size <= targetBytes) return best;
      scale *= 0.85;
      if (canvas.width <= 16 || canvas.height <= 16) break;
    }
    return best;
  }

  // Lossy: for each scale, binary-search quality for the biggest that fits.
  let best = null;
  for (let step = 0; step < 8; step += 1) {
    const { canvas, width, height } = drawScaled(source, scale, matte);
    let lo = 0.3;
    let hi = 0.95;
    let fitAtThisScale = null;
    // eslint-disable-next-line no-await-in-loop
    const floor = await encode(canvas, type, lo);
    const smallest = floor ? { blob: floor, width, height, quality: lo } : null;

    if (floor && floor.size <= targetBytes) {
      for (let i = 0; i < 7; i += 1) {
        const mid = (lo + hi) / 2;
        // eslint-disable-next-line no-await-in-loop
        const blob = await encode(canvas, type, mid);
        if (!blob) break;
        if (blob.size <= targetBytes) {
          fitAtThisScale = { blob, width, height, quality: mid };
          lo = mid; // try for higher quality
        } else {
          hi = mid;
        }
      }
      if (fitAtThisScale) return fitAtThisScale;
      if (smallest) return smallest;
    }

    if (smallest && (!best || smallest.blob.size < best.blob.size)) best = smallest;
    scale *= 0.82;
    if (canvas.width <= 24 || canvas.height <= 24) break;
  }
  return best;
}

/** A checkerboard so transparency is visible behind a preview. */
const CHECKER =
  "repeating-conic-gradient(#334155 0% 25%, #1e293b 0% 50%) 50% / 20px 20px";

export default function ImageCompressor() {
  const [source, setSource] = useState(null); // { file, url, bitmap, width, height }
  const [format, setFormat] = useState("image/webp");
  const [targetValue, setTargetValue] = useState("500");
  const [unit, setUnit] = useState("KB");
  const [maxDimension, setMaxDimension] = useState("");
  const [removeBg, setRemoveBg] = useState(false);
  const [keyHex, setKeyHex] = useState("#ffffff");
  const [tolerance, setTolerance] = useState(12);
  const [softness, setSoftness] = useState(10);
  const [picking, setPicking] = useState(false);
  const [result, setResult] = useState(null); // { url, blob, width, height, quality, transparent }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const imgRef = useRef(null);

  // JPEG can't hold transparency, so once removal is on the format list drops it.
  const formatOptions = removeBg ? ALPHA_FORMATS : FORMATS;
  const effectiveFormat = removeBg && format === "image/jpeg" ? "image/webp" : format;

  const targetBytes = useMemo(() => {
    const n = Number(targetValue);
    const factor = UNITS.find((u) => u.value === unit)?.factor ?? 1024;
    return Number.isFinite(n) && n > 0 ? Math.round(n * factor) : null;
  }, [targetValue, unit]);

  const loadFile = useCallback(async (file) => {
    setError("");
    setResult((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("That file type isn't supported. Use PNG, JPEG, WebP, GIF or AVIF.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("That image is over 40 MB — too large to process in the browser.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      setSource((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return { file, url: URL.createObjectURL(file), bitmap, width: bitmap.width, height: bitmap.height };
      });
    } catch {
      setError("Couldn't read that image. It may be corrupt or an unsupported format.");
    }
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) loadFile(file);
    },
    [loadFile],
  );

  // Auto-sample the background colour from the corners when removal is switched on.
  const toggleRemoveBg = useCallback(
    (on) => {
      setRemoveBg(on);
      if (on && source) setKeyHex(rgbToHex(autoKeyColor(source.bitmap)));
    },
    [source],
  );

  // Click the original preview to sample that pixel as the background colour.
  const pickFromImage = useCallback(
    (event) => {
      if (!picking || !source || !imgRef.current) return;
      const rect = imgRef.current.getBoundingClientRect();
      const x = Math.round(((event.clientX - rect.left) / rect.width) * source.width);
      const y = Math.round(((event.clientY - rect.top) / rect.height) * source.height);
      const canvas = document.createElement("canvas");
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(source.bitmap, 0, 0);
      const p = ctx.getImageData(Math.max(0, Math.min(source.width - 1, x)), Math.max(0, Math.min(source.height - 1, y)), 1, 1).data;
      setKeyHex(rgbToHex([p[0], p[1], p[2]]));
      setPicking(false);
    },
    [picking, source],
  );

  const run = useCallback(async () => {
    if (!source || !targetBytes) return;
    setBusy(true);
    setError("");
    setResult((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    try {
      const drawable = removeBg
        ? removeBackground(source.bitmap, hexToRgb(keyHex), Number(tolerance), Number(softness))
        : source.bitmap;
      const max = Number(maxDimension);
      const out = await compressToTarget(drawable, {
        type: effectiveFormat,
        targetBytes,
        maxDimension: Number.isFinite(max) && max > 0 ? Math.round(max) : null,
        transparent: removeBg,
      });
      if (!out?.blob) {
        setError("Couldn't compress that image. Try a different format or a larger target.");
        return;
      }
      setResult({
        url: URL.createObjectURL(out.blob),
        blob: out.blob,
        width: out.width,
        height: out.height,
        quality: out.quality,
        transparent: removeBg,
      });
    } catch {
      setError("Something went wrong while processing. Try again.");
    } finally {
      setBusy(false);
    }
  }, [source, targetBytes, maxDimension, effectiveFormat, removeBg, keyHex, tolerance, softness]);

  const download = useCallback(() => {
    if (!result?.blob || !source) return;
    const base = source.file.name.replace(/\.[^.]+$/, "") || "image";
    const a = document.createElement("a");
    a.href = result.url;
    a.download = `${base}-compressed.${extFor(effectiveFormat)}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [result, source, effectiveFormat]);

  const reset = useCallback(() => {
    setSource((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    setResult((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    setError("");
    setRemoveBg(false);
    setPicking(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const hitTarget = result && targetBytes != null && result.blob.size <= targetBytes;
  const reduction =
    result && source ? Math.max(0, Math.round((1 - result.blob.size / source.file.size) * 100)) : 0;

  return (
    <Section innerClassName="max-w-5xl">
      <PageHeader
        eyebrow="Management"
        title="Image Compressor"
        subtitle="Shrink an image to a target file size, and optionally knock out a solid background to transparency. Everything runs in your browser — the image is never uploaded anywhere."
        backTo="/"
        backLabel="Home"
        actions={
          source && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RefreshCcw className="size-4" />
              Start over
            </Button>
          )
        }
      />

      {!source ? (
        <Card
          className={`flex flex-col items-center justify-center gap-4 border-2 border-dashed p-14 text-center transition ${
            dragging ? "border-primary-400 bg-primary-500/5" : "border-white/10"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div className="grid size-14 place-items-center rounded-2xl bg-primary-500/10 text-primary-300">
            <UploadCloud className="size-7" />
          </div>
          <div>
            <p className="text-lg font-semibold text-white">Drop an image here</p>
            <p className="mt-1 text-sm text-slate-400">or choose a file — PNG, JPEG, WebP, GIF or AVIF, up to 40 MB.</p>
          </div>
          <Button onClick={() => inputRef.current?.click()}>
            <ImageDown className="size-4" />
            Choose image
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => loadFile(e.target.files?.[0])}
          />
          {error && <p className="text-sm font-semibold text-rose-300">{error}</p>}
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Previews */}
          <div className="space-y-6">
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-white">Original</h3>
                <span className="text-xs text-slate-400">
                  {source.width}×{source.height} · {prettySize(source.file.size)}
                </span>
              </div>
              <div className="grid place-items-center overflow-hidden rounded-xl bg-black/30 p-2">
                {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
                <img
                  ref={imgRef}
                  src={source.url}
                  alt=""
                  onClick={pickFromImage}
                  className={`max-h-72 w-auto rounded-lg object-contain ${picking ? "cursor-crosshair ring-2 ring-primary-400" : ""}`}
                />
              </div>
              {picking && (
                <p className="mt-2 text-center text-xs text-primary-300">Click the background in the image to sample its colour.</p>
              )}
            </Card>

            {result && (
              <Card className="p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-white">Result</h3>
                  <span className="text-xs text-slate-400">
                    {result.width}×{result.height} · {prettySize(result.blob.size)}
                    {result.quality ? ` · quality ${(result.quality * 100).toFixed(0)}%` : ""}
                    {result.transparent ? " · transparent" : ""}
                  </span>
                </div>
                <div
                  className="grid place-items-center overflow-hidden rounded-xl p-2"
                  style={{ background: result.transparent ? CHECKER : "rgba(0,0,0,.3)" }}
                >
                  <img src={result.url} alt="" className="max-h-72 w-auto rounded-lg object-contain" />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    {reduction > 0 ? (
                      <span className="font-semibold text-emerald-300">{reduction}% smaller</span>
                    ) : (
                      <span className="font-semibold text-amber-300">No size saved — try a lower target</span>
                    )}
                    {!hitTarget && (
                      <span className="ml-2 text-amber-300">
                        (couldn't reach the target even at lowest settings — this is the smallest it goes)
                      </span>
                    )}
                  </p>
                  <Button onClick={download}>
                    <Download className="size-4" />
                    Download
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* Controls */}
          <Card className="h-fit space-y-5 p-5">
            <Field label="Target file size" htmlFor="ic-size" hint="The compressor gets as close to this as it can without going over.">
              <div className="flex gap-2">
                <TextInput
                  id="ic-size"
                  type="number"
                  min="1"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  className="flex-1"
                />
                <Select value={unit} onChange={setUnit} options={UNITS.map((u) => ({ value: u.value, label: u.label }))} className="w-24" />
              </div>
            </Field>

            <Field label="Output format" htmlFor="ic-format">
              <Select id="ic-format" value={effectiveFormat} onChange={setFormat} options={formatOptions} />
            </Field>

            <Field
              label="Max width/height (optional)"
              htmlFor="ic-dim"
              hint="Cap the longest side in pixels. Leave blank to keep full resolution and only trade quality."
            >
              <TextInput
                id="ic-dim"
                type="number"
                min="16"
                placeholder="e.g. 1920"
                value={maxDimension}
                onChange={(e) => setMaxDimension(e.target.value)}
              />
            </Field>

            {/* Background removal */}
            <div className="rounded-xl bg-white/[0.02] p-4 ring-1 ring-inset ring-white/[0.06]">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={removeBg}
                  onChange={(e) => toggleRemoveBg(e.target.checked)}
                  className="mt-0.5 size-4 accent-primary-500"
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                    <Eraser className="size-4 text-primary-300" />
                    Remove background
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    Makes a solid background transparent. Best for logos, badges and screenshots.
                  </span>
                </span>
              </label>

              {removeBg && (
                <div className="mt-4 space-y-4">
                  <Field label="Background colour" htmlFor="ic-key" hint="Auto-sampled from the corners. Adjust it, or pick it off the image.">
                    <div className="flex items-center gap-2">
                      <input
                        id="ic-key"
                        type="color"
                        value={keyHex}
                        onChange={(e) => setKeyHex(e.target.value)}
                        className="size-10 shrink-0 cursor-pointer rounded-lg bg-transparent"
                        aria-label="Background colour"
                      />
                      <TextInput value={keyHex} onChange={(e) => setKeyHex(e.target.value)} className="flex-1" />
                      <Button
                        type="button"
                        variant={picking ? "primary" : "ghost"}
                        size="sm"
                        onClick={() => setPicking((v) => !v)}
                        title="Pick the colour off the image"
                      >
                        <Pipette className="size-4" />
                      </Button>
                    </div>
                  </Field>

                  <Field label={`Tolerance — ${tolerance}%`} htmlFor="ic-tol" hint="How close a pixel must be to the colour to be removed. Raise it if bits of background remain.">
                    <input
                      id="ic-tol"
                      type="range"
                      min="0"
                      max="60"
                      value={tolerance}
                      onChange={(e) => setTolerance(Number(e.target.value))}
                      className="w-full accent-primary-500"
                    />
                  </Field>

                  <Field label={`Edge softness — ${softness}%`} htmlFor="ic-soft" hint="Feathers the cut edge so it isn't jagged. Lower it if edges look hazy.">
                    <input
                      id="ic-soft"
                      type="range"
                      min="0"
                      max="40"
                      value={softness}
                      onChange={(e) => setSoftness(Number(e.target.value))}
                      className="w-full accent-primary-500"
                    />
                  </Field>
                </div>
              )}
            </div>

            <Button className="w-full" onClick={run} disabled={busy || !targetBytes}>
              <Minimize2 className="size-4" />
              {busy ? "Processing…" : removeBg ? "Remove background & compress" : "Compress"}
            </Button>

            {error && <p className="text-sm font-semibold text-rose-300">{error}</p>}

            <p className="text-xs leading-relaxed text-slate-500">
              WebP gives the best quality at a given size, keeps transparency, and works everywhere
              including Discord. PNG also keeps transparency but is larger. JPEG is smallest for photos
              but can't hold a removed background, so it's hidden while removal is on.
            </p>
          </Card>
        </div>
      )}
    </Section>
  );
}
