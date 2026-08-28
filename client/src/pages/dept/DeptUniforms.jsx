import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Shirt, Trash2, Upload } from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import DeptPageHeader from "../../components/dept/DeptPageHeader";
import { useDeptConfig } from "../../context/useDeptConfig";
import { api } from "../../lib/api";
import { safeUrl } from "../../lib/safeUrl";

/**
 * The clothing slots a uniform is built from, in the in-game order. A new
 * uniform starts with one row per slot; unused slots are left blank or removed.
 */
const DEFAULT_SLOTS = [
  "Masks",
  "Upperbody",
  "Lowerbody",
  "Bags & Parachutes",
  "Shoes",
  "Scarfs & Chains",
  "Shirt & Accessory",
  "Body Armor & Accessory",
  "Badges & Logos",
  "Shirt Overlay & Jackets",
  "Hats & Helmets",
];

const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

function blankUniform() {
  return {
    id: uid("uni"),
    name: "",
    subtitle: "",
    imageUrl: "",
    components: DEFAULT_SLOTS.map((slot) => ({ id: uid("row"), slot, number: "", texture: "" })),
  };
}

/**
 * A department's uniform roster: each approved uniform is a card listing every
 * clothing slot with its item number and texture, the way the reference hub
 * lays them out. Editors add uniforms, arrange the rows, and set a block of
 * department-wide uniform rules underneath.
 */
export default function DeptUniforms({ page, config }) {
  const { can, savePage } = useDeptConfig();
  const canEdit = can("editStructure");
  const uniforms = Array.isArray(page.config?.uniforms) ? page.config.uniforms : [];
  const rules = page.config?.rules ?? "";

  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [error, setError] = useState("");

  const write = async (changes) => {
    setError("");
    try {
      await savePage(page.id, { ...(page.config ?? {}), uniforms, rules, ...changes });
    } catch (err) {
      setError(err?.errors?.join(" ") || err?.message || "That change was rejected.");
    }
  };

  const move = (index, delta) => {
    const next = [...uniforms];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    write({ uniforms: next });
  };

  const submit = (uniform) => {
    const exists = uniforms.some((u) => u.id === uniform.id);
    const next = exists
      ? uniforms.map((u) => (u.id === uniform.id ? uniform : u))
      : [...uniforms, uniform];
    write({ uniforms: next });
    setEditing(null);
  };

  const remove = (uniform) => {
    write({ uniforms: uniforms.filter((u) => u.id !== uniform.id) });
    setConfirming(null);
  };

  return (
    <>
      <DeptPageHeader
        icon={page.icon}
        eyebrow={config.branding.shortName}
        title={page.label}
        subtitle="Approved uniforms and their components, numbers, and textures."
        actions={
          canEdit && (
            <Button size="sm" onClick={() => setEditing(blankUniform())}>
              <Plus className="size-4" />
              Add uniform
            </Button>
          )
        }
      />

      {error && (
        <p className="mb-5 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-400/25">
          {error}
        </p>
      )}

      {uniforms.length === 0 ? (
        <Card className="p-10 text-center">
          <Shirt className="mx-auto size-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">No uniforms recorded yet.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {uniforms.map((uniform, index) => (
            <UniformCard
              key={uniform.id}
              uniform={uniform}
              canEdit={canEdit}
              first={index === 0}
              last={index === uniforms.length - 1}
              onEdit={() => setEditing(uniform)}
              onDelete={() => setConfirming(uniform)}
              onUp={() => move(index, -1)}
              onDown={() => move(index, 1)}
            />
          ))}
        </div>
      )}

      <div className="mt-8">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
          Department uniform rules
        </p>
        {canEdit ? (
          <TextArea
            rows={3}
            value={rules}
            placeholder="e.g. Hats are mandatory on duty. Glasses must be professional…"
            onChange={(e) => write({ rules: e.target.value })}
          />
        ) : rules ? (
          <Card className="whitespace-pre-line p-4 text-sm text-slate-300">{rules}</Card>
        ) : (
          <p className="text-sm text-slate-500">No uniform rules set.</p>
        )}
      </div>

      {editing && (
        <UniformEditor
          key={editing.id}
          uniform={editing}
          onClose={() => setEditing(null)}
          onSubmit={submit}
        />
      )}

      {confirming && (
        <Modal open onClose={() => setConfirming(null)} title={`Delete "${confirming.name || "uniform"}"?`}>
          <p className="text-sm text-slate-400">
            This uniform and all its components come off the roster. The version history on the Audit
            page keeps a copy.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={() => remove(confirming)}>
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** One uniform as a card: header, controls, and the component table. */
function UniformCard({ uniform, canEdit, first, last, onEdit, onDelete, onUp, onDown }) {
  const components = Array.isArray(uniform.components) ? uniform.components : [];
  const src = safeUrl(uniform.imageUrl);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-4 border-b border-white/[0.06] px-5 py-4">
        {src && (
          <img
            src={src}
            alt=""
            className="size-14 shrink-0 rounded-lg object-cover ring-1 ring-inset ring-white/10"
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-white">{uniform.name || "Untitled uniform"}</h3>
          {uniform.subtitle && (
            <p className="mt-0.5 truncate text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              {uniform.subtitle}
            </p>
          )}
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1">
            <IconBtn label="Move up" onClick={onUp} disabled={first}>
              <ChevronUp className="size-4" />
            </IconBtn>
            <IconBtn label="Move down" onClick={onDown} disabled={last}>
              <ChevronDown className="size-4" />
            </IconBtn>
            <IconBtn label="Edit" onClick={onEdit}>
              <Pencil className="size-4" />
            </IconBtn>
            <IconBtn label="Delete" onClick={onDelete} danger>
              <Trash2 className="size-4" />
            </IconBtn>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.16em] text-slate-500">
              <th className="px-5 py-2.5 font-bold">Component</th>
              <th className="px-3 py-2.5 font-bold">#</th>
              <th className="px-5 py-2.5 text-right font-bold">Texture</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {components.map((row) => (
              <tr key={row.id}>
                <td className="px-5 py-2.5 font-semibold text-slate-200">{row.slot}</td>
                <td className="px-3 py-2.5 font-mono text-slate-300">
                  {row.number || <span className="text-slate-600">—</span>}
                </td>
                <td className="px-5 py-2.5 text-right font-mono text-slate-300">
                  {row.texture || <span className="text-slate-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={
        "rounded-lg p-1.5 text-slate-400 transition disabled:opacity-30 " +
        (danger ? "hover:bg-rose-500/15 hover:text-rose-300" : "hover:bg-white/[0.06] hover:text-white")
      }
    >
      {children}
    </button>
  );
}

/** The add/edit dialog: identity, a reference photo, and the component rows. */
function UniformEditor({ uniform, onClose, onSubmit }) {
  const [draft, setDraft] = useState(uniform);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const set = (changes) => setDraft((current) => ({ ...current, ...changes }));
  const components = Array.isArray(draft.components) ? draft.components : [];
  const setComponents = (next) => set({ components: next });

  const setRow = (id, changes) =>
    setComponents(components.map((row) => (row.id === id ? { ...row, ...changes } : row)));
  const moveRow = (index, delta) => {
    const next = [...components];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setComponents(next);
  };

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const body = await api.uploadImage(file);
      const url = body?.url ?? body?.image?.url ?? body?.src ?? "";
      if (url) set({ imageUrl: url });
    } catch {
      // Leave the field as-is; the URL box still accepts a pasted link.
    }
    setUploading(false);
  };

  return (
    <Modal open onClose={onClose} title={`${uniform.name ? `Edit "${uniform.name}"` : "Add uniform"}`} className="max-w-2xl">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="u-name" hint="e.g. Class A Uniform (Male)">
            <TextInput id="u-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Subtitle" htmlFor="u-sub" hint="Optional, e.g. Formal events & ceremonies.">
            <TextInput id="u-sub" value={draft.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
          </Field>
        </div>

        <Field label="Reference photo" htmlFor="u-img" hint="A screenshot of the uniform. Paste a link or upload.">
          <div className="flex gap-2">
            <TextInput
              id="u-img"
              value={draft.imageUrl}
              placeholder="https://… or upload a file"
              onChange={(e) => set({ imageUrl: e.target.value })}
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="size-4" />
              {uploading ? "…" : "Upload"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </div>
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Components</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setComponents([...components, { id: uid("row"), slot: "", number: "", texture: "" }])}
            >
              <Plus className="size-4" />
              Add row
            </Button>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            One row per clothing slot: the category (Upperbody, Hats &amp; Helmets…), the item number,
            and its texture. Leave number blank for slots this uniform doesn't use, or delete the row.
          </p>
          <div className="space-y-1.5">
            {components.map((row, index) => (
              <div key={row.id} className="flex items-center gap-1.5">
                <TextInput
                  value={row.slot}
                  placeholder="Component"
                  onChange={(e) => setRow(row.id, { slot: e.target.value })}
                  className="flex-[2]"
                />
                <TextInput
                  value={row.number}
                  placeholder="#121, 257"
                  onChange={(e) => setRow(row.id, { number: e.target.value })}
                  className="flex-1"
                />
                <TextInput
                  value={row.texture}
                  placeholder="#1 / Rank"
                  onChange={(e) => setRow(row.id, { texture: e.target.value })}
                  className="flex-1"
                />
                <IconBtn label="Move up" onClick={() => moveRow(index, -1)} disabled={index === 0}>
                  <ChevronUp className="size-4" />
                </IconBtn>
                <IconBtn label="Move down" onClick={() => moveRow(index, 1)} disabled={index === components.length - 1}>
                  <ChevronDown className="size-4" />
                </IconBtn>
                <IconBtn label="Remove row" onClick={() => setComponents(components.filter((r) => r.id !== row.id))} danger>
                  <Trash2 className="size-4" />
                </IconBtn>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={!draft.name.trim()} onClick={() => onSubmit(draft)}>
          Save uniform
        </Button>
      </div>
    </Modal>
  );
}
