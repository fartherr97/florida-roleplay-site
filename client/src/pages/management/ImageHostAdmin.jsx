import { useEffect, useMemo, useState } from "react";
import { ImageIcon, Search } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import { TextInput } from "../../components/ui/TextInput";
import { api } from "../../lib/api";
import { ImageCard } from "../ImageHost";

/**
 * Image Hosting Administration — every image anyone has uploaded to the host,
 * with who posted it, and the power to remove any of them. Gated by
 * `media.manage`; the server returns the full gallery only to holders.
 */
export default function ImageHostAdmin() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    api
      .listImages("all")
      .then((data) => active && setImages(data?.images ?? []))
      .catch(() => active && setImages([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const remove = async (id) => {
    const previous = images;
    setImages((prev) => prev.filter((image) => image.id !== id));
    try {
      await api.deleteImage(id);
    } catch {
      setImages(previous);
      setError("Couldn't remove that image.");
    }
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return images;
    return images.filter((image) =>
      [image.uploadedByName, image.originalName, image.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [images, query]);

  return (
    <Section>
      <PageHeader
        eyebrow="Management"
        title="Image Hosting Administration"
        subtitle="Every image uploaded to the community host, and who posted it. Remove anything that shouldn't be here."
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by uploader, filename or id"
            aria-label="Search images"
            className="pl-11"
          />
        </div>
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          {images.length} total
        </span>
      </div>

      {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <ImageIcon className="mx-auto size-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">
            {images.length === 0 ? "No images have been uploaded yet." : "No images match that search."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((image) => (
            <ImageCard key={image.id} image={image} onDelete={remove} />
          ))}
        </div>
      )}
    </Section>
  );
}
