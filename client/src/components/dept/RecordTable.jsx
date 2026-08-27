import { useMemo, useState } from "react";
import { Check, Copy, ImageOff, Pencil, Plus, Trash2 } from "lucide-react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import Field from "../ui/Field";
import Select from "../ui/Select";
import { TextArea, TextInput } from "../ui/TextInput";
import { useDeptConfig } from "../../context/useDeptConfig";
import { formatDate } from "../../lib/format";
import { isExternal, safeUrl } from "../../lib/safeUrl";

/**
 * The editable table behind most of a department's tracking pages — the fleet,
 * uniform kits, the calendar, the admin log, duty hours.
 *
 * Each page declares its own fields and this handles the rest: rendering, the
 * add/edit dialog, deletion, and saving through the narrow per-page write. That
 * write is the reason this is worth sharing: every one of these pages needs to
 * save exactly one page's data and nothing else, and doing it in one place means
 * no page can widen that by accident.
 */
export default function RecordTable({
  page,
  collection,
  fields,
  canEdit,
  singular = "entry",
  empty = "Nothing recorded yet.",
  sort,
  // "table" (default) is the dense editable table; "cards" is the image-forward
  // grid the reference hub uses for visual collections (uniform kits, the
  // fleet). Both share the same add/edit/delete + per-page save below.
  layout = "table",
}) {
  const { savePage } = useDeptConfig();
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [error, setError] = useState("");

  const rows = useMemo(() => {
    const list = page.config?.[collection] ?? [];
    return sort ? [...list].sort(sort) : list;
  }, [collection, page.config, sort]);

  const write = async (nextRows) => {
    setError("");
    try {
      await savePage(page.id, { ...(page.config ?? {}), [collection]: nextRows });
    } catch (err) {
      setError(err?.errors?.join(" ") || err?.message || "That change was rejected.");
    }
  };

  const submit = async (values) => {
    const list = page.config?.[collection] ?? [];
    const next = values.id
      ? list.map((row) => (row.id === values.id ? values : row))
      : [...list, { ...values, id: `${collection}-${Date.now()}` }];
    await write(next);
    setEditing(null);
  };

  const remove = async (row) => {
    await write((page.config?.[collection] ?? []).filter((item) => item.id !== row.id));
    setConfirming(null);
  };

  return (
    <>
      {canEdit && (
        <div className="mb-4 flex justify-end">
          <Button size="sm" onClick={() => setEditing(blank(fields))}>
            <Plus className="size-4" />
            Add {singular}
          </Button>
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-400/25">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-slate-400">{empty}</p>
          {canEdit && (
            <p className="mt-2 text-xs text-slate-500">
              Use “Add {singular}” above — it saves straight to this department's config.
            </p>
          )}
        </Card>
      ) : layout === "cards" ? (
        <RecordCards
          rows={rows}
          fields={fields}
          canEdit={canEdit}
          singular={singular}
          onEdit={setEditing}
          onDelete={setConfirming}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  {fields
                    .filter((field) => !field.hideInTable)
                    .map((field) => (
                      <th key={field.id} className="px-5 py-3 font-bold">
                        {field.label}
                      </th>
                    ))}
                  {canEdit && <th className="px-5 py-3 text-right font-bold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {rows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-white/[0.02]">
                    {fields
                      .filter((field) => !field.hideInTable)
                      .map((field) => (
                        <td key={field.id} className="px-5 py-3.5 align-top text-slate-300">
                          <Cell field={field} value={row[field.id]} />
                        </td>
                      ))}
                    {canEdit && (
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setEditing(row)}
                          aria-label={`Edit ${row[fields[0].id] || singular}`}
                          className="mr-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(row)}
                          aria-label={`Delete ${row[fields[0].id] || singular}`}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing && (
        <RecordForm
          key={editing.id ?? "new"}
          record={editing}
          fields={fields}
          singular={singular}
          onClose={() => setEditing(null)}
          onSubmit={submit}
        />
      )}

      {confirming && (
        <Modal open onClose={() => setConfirming(null)} title={`Delete this ${singular}?`}>
          <p className="text-sm text-slate-400">
            {confirming[fields[0].id] || `This ${singular}`} will be removed from this page. The
            previous version stays in the department's version history.
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

/** A blank record with every field present, so inputs start controlled. */
function blank(fields) {
  return Object.fromEntries(fields.map((field) => [field.id, ""]));
}

/**
 * The image-forward card grid — the reference hub's look for visual collections
 * like uniform kits and the fleet. Field roles are declared on the fields:
 * `image` marks the reference-image field, `title` the heading (defaults to the
 * first field), a toned `select` becomes the status badge, and `copyable` marks
 * a value shown with a copy button (the in-game clothing code). Everything else
 * lists underneath.
 */
function RecordCards({ rows, fields, canEdit, singular, onEdit, onDelete }) {
  const imageField =
    fields.find((f) => f.image) || fields.find((f) => f.type === "url" || f.type === "image");
  const titleField = fields.find((f) => f.title) || fields[0];
  const statusField = fields.find((f) => f.type === "select" && f.tones);
  const bodyFields = fields.filter(
    (f) => f !== imageField && f !== titleField && f !== statusField && !f.hideInCard,
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <Card key={row.id} className="hub-card-hover flex flex-col overflow-hidden p-0">
          {imageField && <CardMedia value={row[imageField.id]} />}
          <div className="flex min-w-0 flex-1 flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 truncate text-sm font-bold text-white">
                {row[titleField.id] || `Untitled ${singular}`}
              </h3>
              {statusField && row[statusField.id] && (
                <Badge tone={statusField.tones[row[statusField.id]] ?? "slate"}>
                  {row[statusField.id]}
                </Badge>
              )}
            </div>

            {bodyFields.length > 0 && (
              <dl className="mt-3 space-y-2 text-sm">
                {bodyFields.map((field) => (
                  <CardRow key={field.id} field={field} value={row[field.id]} />
                ))}
              </dl>
            )}

            {canEdit && (
              <div className="mt-4 flex justify-end gap-1 border-t border-white/[0.06] pt-3">
                <button
                  type="button"
                  onClick={() => onEdit(row)}
                  aria-label={`Edit ${row[titleField.id] || singular}`}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(row)}
                  aria-label={`Delete ${row[titleField.id] || singular}`}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

/** A card's reference image, or an accent-tinted placeholder when none is set. */
function CardMedia({ value }) {
  const src = safeUrl(value);
  if (!src) {
    return (
      <div
        className="grid aspect-[16/10] place-items-center border-b border-white/[0.06]"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--dept-accent) 20%, transparent), transparent 70%)",
        }}
      >
        <ImageOff className="size-6 text-slate-600" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="aspect-[16/10] overflow-hidden border-b border-white/[0.06] bg-black/30">
      <img src={src} alt="" loading="lazy" className="size-full object-cover" />
    </div>
  );
}

/** One labelled field inside a card. Handles the copyable code and long text. */
function CardRow({ field, value }) {
  if (!value && value !== 0) return null;

  if (field.copyable) {
    return (
      <div>
        <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
          {field.label}
        </dt>
        <dd className="mt-1">
          <CopyField value={String(value)} />
        </dd>
      </div>
    );
  }

  if (field.type === "url") {
    const href = safeUrl(value);
    if (!href) return null;
    return (
      <div className="flex items-center justify-between gap-3">
        <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
          {field.label}
        </dt>
        <dd>
          <a
            href={href}
            target={isExternal(href) ? "_blank" : undefined}
            rel="noreferrer noopener"
            className="dept-accent-text underline-offset-2 hover:underline"
          >
            Open
          </a>
        </dd>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
          {field.label}
        </dt>
        <dd className="mt-0.5 whitespace-pre-line text-slate-400">{value}</dd>
      </div>
    );
  }

  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {field.label}
      </dt>
      <dd className="min-w-0 truncate text-right text-slate-300">
        {field.type === "date" ? formatDate(value) : value}
      </dd>
    </div>
  );
}

/** A monospaced value with a click-to-copy button — the in-game clothing code. */
function CopyField({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard blocked (insecure context or denied) — leave the value shown
      // so it can still be selected and copied by hand.
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="press-sm flex w-full items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 font-mono text-xs text-slate-200 ring-1 ring-inset ring-white/[0.08] transition hover:bg-white/[0.06]"
      title="Copy to clipboard"
    >
      <span className="min-w-0 truncate">{value}</span>
      {copied ? (
        <Check className="size-3.5 shrink-0 text-emerald-400" />
      ) : (
        <Copy className="size-3.5 shrink-0 text-slate-500" />
      )}
    </button>
  );
}

function Cell({ field, value }) {
  if (!value && value !== 0) return <span className="text-slate-600">—</span>;
  if (field.type === "date") return formatDate(value);
  if (field.type === "select" && field.tones) {
    return <Badge tone={field.tones[value] ?? "slate"}>{value}</Badge>;
  }
  if (field.type === "textarea") {
    return <span className="block max-w-md whitespace-pre-line text-slate-400">{value}</span>;
  }
  if (field.type === "url") {
    const href = safeUrl(value);
    // An address that is not a usable link reads as plain text, so it is
    // obvious something needs correcting rather than looking clickable.
    if (!href) return <span className="text-slate-500">{String(value)}</span>;
    return (
      <a
        href={href}
        target={isExternal(href) ? "_blank" : undefined}
        rel="noreferrer noopener"
        className="dept-accent-text underline-offset-2 hover:underline"
      >
        Open
      </a>
    );
  }
  return value;
}

function RecordForm({ record, fields, singular, onClose, onSubmit }) {
  // Keyed by record id upstream, so this initialises from props rather than
  // needing an effect to reset when a different row is opened.
  const [values, setValues] = useState(record);
  const [saving, setSaving] = useState(false);

  const set = (id, value) => setValues((current) => ({ ...current, [id]: value }));

  const handle = async (event) => {
    event.preventDefault();
    setSaving(true);
    await onSubmit(values);
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title={record.id ? `Edit ${singular}` : `Add ${singular}`}>
      <form onSubmit={handle} className="space-y-4">
        {fields.map((field) => (
          <Field key={field.id} label={field.label} htmlFor={field.id} hint={field.hint}>
            {field.type === "textarea" ? (
              <TextArea
                id={field.id}
                rows={4}
                value={values[field.id] ?? ""}
                onChange={(e) => set(field.id, e.target.value)}
              />
            ) : field.type === "select" ? (
              <Select
                id={field.id}
                value={values[field.id] ?? ""}
                onChange={(e) => set(field.id, e.target.value)}
              >
                <option value="">Choose…</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            ) : (
              <TextInput
                id={field.id}
                type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                value={values[field.id] ?? ""}
                onChange={(e) => set(field.id, e.target.value)}
              />
            )}
          </Field>
        ))}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
