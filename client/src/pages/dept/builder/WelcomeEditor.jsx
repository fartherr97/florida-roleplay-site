import { useState } from "react";
import { Plus, X } from "lucide-react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import Field from "../../../components/ui/Field";
import { TextArea, TextInput } from "../../../components/ui/TextInput";
import { useDeptConfig } from "../../../context/useDeptConfig";

/**
 * Edits a Welcome page's hero, its scrolling announcements and its rotating
 * photo gallery. Content blocks below the hero are edited with the same block
 * editor as every other page, from the "Content" button.
 */
export default function WelcomeEditor({ page, onClose }) {
  // The whole-config path (like the block editor) rather than the per-page one,
  // so it saves under the same "manage" capability the Builder already requires.
  const { mutate } = useDeptConfig();
  const [draft, setDraft] = useState(() => ({
    heroKicker: "",
    heroTitle: "",
    heroSubtitle: "",
    announcements: [],
    gallery: [],
    ...(page.config ?? {}),
  }));

  const set = (changes) => setDraft((current) => ({ ...current, ...changes }));
  const announcements = Array.isArray(draft.announcements) ? draft.announcements : [];
  const gallery = Array.isArray(draft.gallery) ? draft.gallery : [];

  const save = () => {
    const nextConfig = {
      ...(page.config ?? {}),
      heroKicker: draft.heroKicker,
      heroTitle: draft.heroTitle,
      heroSubtitle: draft.heroSubtitle,
      announcements: announcements.filter((a) => a.trim()),
      gallery: gallery.filter((g) => g.url?.trim()),
    };
    mutate((current) => ({
      ...current,
      pages: current.pages.map((p) => (p.id === page.id ? { ...p, config: nextConfig } : p)),
    }));
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Welcome page" className="max-w-2xl">
      <div className="space-y-4">
        <Field label="Kicker" htmlFor="w-kicker" hint="The small line above the title.">
          <TextInput id="w-kicker" value={draft.heroKicker} onChange={(e) => set({ heroKicker: e.target.value })} />
        </Field>
        <Field label="Title" htmlFor="w-title">
          <TextInput id="w-title" value={draft.heroTitle} onChange={(e) => set({ heroTitle: e.target.value })} />
        </Field>
        <Field label="Subtitle" htmlFor="w-sub">
          <TextArea id="w-sub" rows={2} value={draft.heroSubtitle} onChange={(e) => set({ heroSubtitle: e.target.value })} />
        </Field>

        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Announcements ticker
            </span>
            <Button variant="ghost" size="sm" onClick={() => set({ announcements: [...announcements, ""] })}>
              <Plus className="size-4" />
              Add
            </Button>
          </div>
          <div className="space-y-1.5">
            {announcements.map((text, index) => (
              <div key={index} className="flex items-center gap-2">
                <TextInput
                  value={text}
                  onChange={(e) =>
                    set({ announcements: announcements.map((a, i) => (i === index ? e.target.value : a)) })
                  }
                  placeholder="A short announcement…"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => set({ announcements: announcements.filter((_, i) => i !== index) })}
                  aria-label="Remove announcement"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            {announcements.length === 0 && (
              <p className="text-xs text-slate-500">No announcements — the ticker is hidden.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Photo gallery
            </span>
            <Button variant="ghost" size="sm" onClick={() => set({ gallery: [...gallery, { url: "", caption: "" }] })}>
              <Plus className="size-4" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {gallery.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <TextInput
                  value={item.url ?? ""}
                  onChange={(e) =>
                    set({ gallery: gallery.map((g, i) => (i === index ? { ...g, url: e.target.value } : g)) })
                  }
                  placeholder="Image URL"
                  className="flex-1"
                />
                <TextInput
                  value={item.caption ?? ""}
                  onChange={(e) =>
                    set({ gallery: gallery.map((g, i) => (i === index ? { ...g, caption: e.target.value } : g)) })
                  }
                  placeholder="Caption (optional)"
                  className="w-40"
                />
                <button
                  type="button"
                  onClick={() => set({ gallery: gallery.filter((_, i) => i !== index) })}
                  aria-label="Remove photo"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            {gallery.length === 0 && (
              <p className="text-xs text-slate-500">No photos — the hero uses the accent gradient.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={save}>
          Save
        </Button>
      </div>
    </Modal>
  );
}
