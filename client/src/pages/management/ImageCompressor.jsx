import { useCallback, useMemo, useRef, useState } from "react";
import { Download, ImageDown, Minimize2, RefreshCcw, UploadCloud } from "lucide-react";
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
 * media.compress permission (Directorship and up). You pick an image, type the
 * file size you need, and it shrinks the image to hit that size while keeping
 * quality as high as it can.
 *
 * How it hits a target size: the image is drawn to a canvas and re-encoded as a
 * lossy format (WebP or JPEG). Quality is the first lever — a binary search
 * finds the highest quality whose output still fits under the target. If even
 * the lowest quality is too big, the canvas is scaled down a step at a time and
 * the search repeats, so a target is reached by trading resolution only after
 * quality is exhausted. PNG stays lossless, so for PNG only downscaling applies.
 */

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"];
const MAX_INPUT_BYTES = 40 * 1024 * 1024; // 40 MB source cap — plenty for a photo.

const FORMATS = [
  { value: "image/webp", label: "WebP — best quality per KB (recommended)" },
  { value: "image/jpeg", label: "JPEG — most compatible" },
  { value: "image/png", label: "PNG — lossless, keeps transparency" },
];

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

/** Encode a canvas to a Blob at a given quality, promisified. */
function encode(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Draw a bitmap onto a fresh canvas at a scale factor. `matte` paints a white
 * background first, so a transparent PNG re-encoded as JPEG (which has no alpha)
 * doesn't turn its transparent areas black.
 */
function drawScaled(bitmap, scale, matte) {
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (matte) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  return { canvas, width: w, height: h };
}

/**
 * Compress a bitmap to under `targetBytes`. Returns the smallest-quality-loss
 * result that fits, or the best effort at the lowest settings if the target is
 * smaller than the format can reach.
 */
async function compressToTarget(bitmap, { type, targetBytes, maxDimension }) {
  const matte = type === "image/jpeg";

  // Start from the requested max dimension (if any), else full size.
  const longest = Math.max(bitmap.width, bitmap.height);
  let scale = maxDimension && longest > maxDimension ? maxDimension / longest : 1;

  // PNG is lossless — quality is ignored, so only scaling changes its size.
  if (type === "image/png") {
    let best = null;
    for (let i = 0; i < 12; i += 1) {
      const { canvas, width, height } = drawScaled(bitmap, scale, matte);
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
    const { canvas, width, height } = drawScaled(bitmap, scale, matte);
    let lo = 0.3;
    let hi = 0.95;
    let fitAtThisScale = null;
    // eslint-disable-next-line no-await-in-loop
    let floor = await encode(canvas, type, lo);
    // Track the smallest output we can make at this scale, as a fallback.
    let smallest = floor ? { blob: floor, width, height, quality: lo } : null;

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

    // Even lowest quality overshoots — remember it, then downscale and retry.
    if (smallest && (!best || smallest.blob.size < best.blob.size)) best = smallest;
    scale *= 0.82;
    if (canvas.width <= 24 || canvas.height <= 24) break;
  }
  return best;
}

export default function ImageCompressor() {
  const [source, setSource] = useState(null); // { file, url, bitmap, width, height }
  const [format, setFormat] = useState("image/webp");
  const [targetValue, setTargetValue] = useState("500");
  const [unit, setUnit] = useState("KB");
  const [maxDimension, setMaxDimension] = useState("");
  const [result, setResult] = useState(null); // { url, blob, width, height, quality }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

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
        return {
          file,
          url: URL.createObjectURL(file),
          bitmap,
          width: bitmap.width,
          height: bitmap.height,
        };
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

  const run = useCallback(async () => {
    if (!source || !targetBytes) return;
    setBusy(true);
    setError("");
    setResult((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    try {
      const max = Number(maxDimension);
      const out = await compressToTarget(source.bitmap, {
        type: format,
        targetBytes,
        maxDimension: Number.isFinite(max) && max > 0 ? Math.round(max) : null,
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
      });
    } catch {
      setError("Something went wrong while compressing. Try again.");
    } finally {
      setBusy(false);
    }
  }, [source, targetBytes, maxDimension, format]);

  const download = useCallback(() => {
    if (!result?.blob || !source) return;
    const base = source.file.name.replace(/\.[^.]+$/, "") || "image";
    const a = document.createElement("a");
    a.href = result.url;
    a.download = `${base}-compressed.${extFor(format)}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [result, source, format]);

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
        subtitle="Shrink an image to a target file size while keeping as much quality as possible. Everything runs in your browser — the image is never uploaded anywhere."
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
                <img src={source.url} alt="" className="max-h-72 w-auto rounded-lg object-contain" />
              </div>
            </Card>

            {result && (
              <Card className="p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-white">Compressed</h3>
                  <span className="text-xs text-slate-400">
                    {result.width}×{result.height} · {prettySize(result.blob.size)}
                    {result.quality ? ` · quality ${(result.quality * 100).toFixed(0)}%` : ""}
                  </span>
                </div>
                <div className="grid place-items-center overflow-hidden rounded-xl bg-black/30 p-2">
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
                <Select
                  value={unit}
                  onChange={setUnit}
                  options={UNITS.map((u) => ({ value: u.value, label: u.label }))}
                  className="w-24"
                />
              </div>
            </Field>

            <Field label="Output format" htmlFor="ic-format">
              <Select
                id="ic-format"
                value={format}
                onChange={setFormat}
                options={FORMATS}
              />
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

            <Button className="w-full" onClick={run} disabled={busy || !targetBytes}>
              <Minimize2 className="size-4" />
              {busy ? "Compressing…" : "Compress"}
            </Button>

            {error && <p className="text-sm font-semibold text-rose-300">{error}</p>}

            <p className="text-xs leading-relaxed text-slate-500">
              WebP gives the best quality at a given size and is supported by every modern browser and
              Discord. Use JPEG only if something needs it. PNG stays lossless (it keeps transparency),
              so it can only be shrunk by lowering the resolution.
            </p>
          </Card>
        </div>
      )}
    </Section>
  );
}
