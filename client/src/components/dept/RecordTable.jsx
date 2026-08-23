import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import Field from "../ui/Field";
import Select from "../ui/Select";
import { TextArea, TextInput } from "../ui/TextInput";
import { useDeptConfig } from "../../context/useDeptConfig";
import { formatDate } from "../../lib/format";

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
    return (
      <a
        href={String(value)}
        target="_blank"
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
