import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Trash2, UploadCloud } from "lucide-react";
import Section from "../components/layout/Section";
import PageHeader from "../components/layout/PageHeader";
import Card from "../components/ui/Card";
import CopyField from "../components/ui/CopyField";
import { api } from "../lib/api";

/** The ways somebody pastes a hosted image elsewhere. */
const EMBED_FORMATS = [
  { id: "link", label: "Link", build: (url) => url },
  { id: "md", label: "Markdown", build: (url, alt) => `![${alt}](${url})` },
  { id: "bb", label: "BBCode", build: (url) => `[img]${url}[/img]` },
  { id: "html", label: "HTML", build: (url, alt) => `<img src="${url}" alt="${alt}">` },
];

/**
 * The community image host. Authorized members (media.upload) drop an image and get a
 * shareable link back; the file is stored by the server and served from a clean URL. The
 * page is gated by PublicLayout, and every write is re-checked by the server.
 */

const ACCEPTED = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

function prettySize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImageHost() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    let active = true;
    api
      .listImages()
      .then((data) => active && setImages(data?.images ?? []))
      .catch(() => active && setImages([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    setError(null);

    for (const file of files) {
      if (!ACCEPTED.includes(file.type)) {
        setError(`${file.name}: only PNG, JPEG, GIF or WEBP images can be hosted.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name}: images must be 10 MB or smaller.`);
        continue;
      }
      setUploading(true);
      try {
        const result = await api.uploadImage(file);
        if (result?.image) setImages((prev) => [result.image, ...prev]);
      } catch (err) {
        setError(err?.message ?? "Upload failed.");
      } finally {
        setUploading(false);
      }
    }
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer?.files);
  };

  const remove = async (id) => {
    const previous = images;
    setImages((prev) => prev.filter((image) => image.id !== id));
    try {
      await api.deleteImage(id);
    } catch {
      setImages(previous); // put it back if the delete did not take
      setError("Couldn't remove that image.");
    }
  };

  return (
    <Section>
      <PageHeader
        eyebrow="Emergency Services"
        title="Image Hosting"
        subtitle="Upload an image and get a shareable link. Anyone with the link can view it. This page shows your own uploads."
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-14 text-center transition ${
          dragging
            ? "border-brand-400 bg-brand-500/10"
            : "border-white/15 bg-black/20 hover:border-white/25 hover:bg-black/30"
        }`}
      >
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-500/15 text-brand-300 ring-1 ring-inset ring-brand-400/25">
          <UploadCloud className="size-7" />
        </span>
        <span className="text-sm font-semibold text-white">
          {uploading ? "Uploading…" : "Drop an image here, or click to choose"}
        </span>
        <span className="text-xs text-slate-500">PNG, JPEG, GIF or WEBP · up to 10 MB</span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </button>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

      <div className="mt-10">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-400">
          <ImagePlus className="size-4" />
          Your uploads
        </h2>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : images.length === 0 ? (
          <Card className="p-8 text-center text-sm text-slate-500">
            You haven't uploaded any images yet. Drop one above to get a link.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => (
              <ImageCard key={image.id} image={image} onDelete={remove} />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

/** One hosted image: a thumbnail, a format switch, and a copyable embed snippet. */
export function ImageCard({ image, onDelete }) {
  const [format, setFormat] = useState("link");
  const alt = image.originalName || "image";
  const snippet = useMemo(() => {
    const chosen = EMBED_FORMATS.find((f) => f.id === format) ?? EMBED_FORMATS[0];
    return chosen.build(image.url, alt);
  }, [format, image.url, alt]);

  return (
    <Card className="flex flex-col overflow-hidden">
      <a
        href={image.url}
        target="_blank"
        rel="noreferrer noopener"
        className="group relative block aspect-video overflow-hidden bg-black/40"
      >
        <img
          src={image.url}
          alt={alt}
          loading="lazy"
          className="size-full object-contain transition group-hover:scale-[1.02]"
        />
      </a>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex flex-wrap gap-1">
          {EMBED_FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                format === f.id
                  ? "bg-brand-500/20 text-brand-200 ring-1 ring-inset ring-brand-400/30"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <CopyField value={snippet} />
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="truncate">
            {prettySize(image.size)}
            {image.uploadedByName ? ` · ${image.uploadedByName}` : ""}
          </span>
          <button
            type="button"
            onClick={() => onDelete(image.id)}
            aria-label="Delete image"
            className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </Card>
  );
}
