import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Gavel,
  Pencil,
  Plus,
  Search,
  Send,
  Settings2,
  Trash2,
  Webhook,
  X,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import Badge from "../../components/ui/Badge";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import DeptPageHeader from "../../components/dept/DeptPageHeader";
import { useDeptConfig } from "../../context/useDeptConfig";
import { useAuth } from "../../context/useAuth";
import { cn } from "../../lib/cn";

/**
 * Administrative Log ("adminlog"). A department logs personnel actions (hires,
 * resignations, transfers, discipline), FTO sessions, interviews and booth
 * shifts across configurable LOGBOOKS, each with its own entry types and custom
 * fields, with live statistics and an optional Discord webhook.
 *
 * THE GOLDEN RULE: entries are SNAPSHOTS. At submission the entry stores the
 * logbook name, entry type, subject and every field as plain label/value
 * strings, so renaming or deleting a book, type or field later never breaks how
 * an old record renders. Statistics recompute live from the entries.
 *
 * Page config shape (stored under the page, written with savePage):
 *   books:   [{ id, name, types:[string], fields:[{id,label,type,options?}] }]
 *   entries: [{ id, bookId, bookName, type, at, date, by:{name,discordId},
 *               subject:{name,discordId}, values:[{label,type,value}],
 *               editedBy?, editedAt? }]
 *
 * The webhook lives in config.webhooks.adminlog — it is fired server-side on
 * save, so the URL is a write credential that never reaches a client. Filing a
 * disciplinary entry that names a member by Discord id also lands on that
 * member's background check, again server-side.
 *
 * Opening the page needs the `manageLog` capability (set on the page type), so
 * everyone who can see it can write; webhook setup additionally needs `manage`.
 */

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long text" },
  { value: "select", label: "Dropdown" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
];

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const SNOWFLAKE = /^\d{17,20}$/;

function defaultBooks() {
  return [
    {
      id: uid("book"),
      name: "Admin Log",
      types: ["Hired, Open Interview", "Hired, Application", "Resignation", "Transfer In", "Transfer Out"],
      fields: [{ id: uid("lf"), label: "Notes", type: "textarea" }],
    },
    {
      id: uid("book"),
      name: "FTO Logbook",
      types: ["Academy Training", "Field Training, Phase 1", "Field Training, Phase 2", "Final Evaluation"],
      fields: [{ id: uid("lf"), label: "Result / Notes", type: "textarea" }],
    },
    {
      id: uid("book"),
      name: "Interview Logbook",
      types: ["Interview Conducted", "Interview Passed", "Interview Failed"],
      fields: [{ id: uid("lf"), label: "Notes", type: "textarea" }],
    },
    {
      id: uid("book"),
      name: "Booth Log",
      types: ["Open Interview Booth"],
      fields: [
        { id: uid("lf"), label: "Duration (minutes)", type: "text" },
        { id: uid("lf"), label: "Hires from booth", type: "text" },
        { id: uid("lf"), label: "Notes", type: "textarea" },
      ],
    },
  ];
}

function formatDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  return m ? `${m[2]}/${m[3]}/${m[1]}` : value || "—";
}

// ─── Entry type colours (consistent, meaning-aware) ──────────────────────────

const TYPE_PALETTE = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#14b8a6", "#ec4899", "#f97316", "#ef4444"];

function typeColor(type = "") {
  const t = type.toLowerCase();
  if (/pass|hire|accept|approved|commend/.test(t)) return "#22c55e"; // good news, green
  if (/fail|resign|strike|terminat|remov/.test(t)) return "#ef4444"; // bad news, red
  if (/transfer in/.test(t)) return "#3b82f6";
  if (/transfer out/.test(t)) return "#f97316";
  if (/\bda\b|coach|warn|probation|suspen|demot/.test(t)) return "#f59e0b"; // discipline, amber
  if (/booth/.test(t)) return "#14b8a6";
  if (/interview/.test(t)) return "#a855f7";
  if (/academy|training|eval/.test(t)) return "#3b82f6";
  let h = 0;
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TYPE_PALETTE[h % TYPE_PALETTE.length];
}

function TypePill({ type }) {
  const color = typeColor(type);
  return (
    <span
      className="inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-[11px] font-bold"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      {type}
    </span>
  );
}

// ─── Small shared inputs the design system doesn't ship ──────────────────────

function IconButton({ icon: Icon, label, onClick, disabled, danger, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 ring-1 ring-inset ring-white/10 transition disabled:opacity-30",
        danger ? "hover:bg-rose-500/10 hover:text-rose-300" : "hover:bg-white/[0.06] hover:text-white",
        className,
      )}
    >
      <Icon size={15} />
    </button>
  );
}

/** A comma-separated list edited as chips, so entry types / role ids stay tidy. */
function CommaListInput({ value = [], onChange, placeholder }) {
  const [text, setText] = useState("");
  const list = Array.isArray(value) ? value : [];
  const commit = () => {
    const parts = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) onChange([...list, ...parts]);
    setText("");
  };
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2">
      {list.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {list.map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-slate-200"
            >
              {item}
              <button
                type="button"
                onClick={() => onChange(list.filter((_, j) => j !== i))}
                aria-label={`Remove ${item}`}
                className="text-slate-500 hover:text-rose-300"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        className="w-full bg-transparent px-1.5 py-1 text-sm text-white outline-none placeholder:text-slate-600"
      />
    </div>
  );
}

/** A native colour well beside its hex, kept in sync. */
function ColorInput({ value = "#3b82f6", onChange }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Colour"
        className="h-11 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent"
      />
      <TextInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 font-mono"
      />
    </div>
  );
}

/** A brief self-dismissing confirmation toast. */
function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
      <div className="rounded-xl bg-[var(--color-surface-1)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-white/10">
        {message}
      </div>
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState("");
  const timer = useRef(null);
  const show = (message) => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 2600);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return { toast, show };
}

// ─── One entry as a table row ────────────────────────────────────────────────

function EntryRow({ entry: e, canEdit, onEdit, onDelete }) {
  const vals = (e.values || []).filter((v) => v.value);
  const fmtVal = (v) =>
    v.type === "checkbox" ? "Yes" : v.type === "date" ? formatDate(v.value) : String(v.value);
  return (
    <tr
      onClick={(ev) => {
        if (canEdit && !ev.target.closest("button, a")) onEdit();
      }}
      className={cn(
        "border-t border-white/5 align-top transition hover:bg-white/[0.03]",
        canEdit && "cursor-pointer",
      )}
    >
      <td className="px-4 py-3">
        <TypePill type={e.type} />
      </td>
      <td className="px-4 py-3">
        <div className="font-semibold leading-tight text-white">{e.subject?.name || "—"}</div>
        {e.subject?.discordId && (
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">{e.subject.discordId}</div>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-300">
        {e.by?.name || "Unknown"}
        {e.editedAt && (
          <span className="text-slate-500" title={`Edited by ${e.editedBy}`}>
            {" "}
            · edited
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-200">
        {vals.length ? (
          <div className="grid max-w-xl gap-0.5">
            {vals.map((v, i) => {
              const hideLabel = /note/i.test(v.label);
              return (
                <div key={i} className="min-w-0 leading-snug">
                  {!hideLabel && <span className="font-semibold text-slate-400">{v.label}: </span>}
                  <span className="whitespace-pre-line">{fmtVal(v)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-400">
        {formatDate(e.date || (e.at || "").slice(0, 10))}
      </td>
      {canEdit && (
        <td className="px-2 py-3 text-right">
          <span className="flex items-center justify-end gap-1">
            <IconButton icon={Pencil} label="Edit entry" onClick={onEdit} className="size-7" />
            <IconButton icon={Trash2} label="Delete entry" onClick={onDelete} danger className="size-7" />
          </span>
        </td>
      )}
    </tr>
  );
}

// ─── Entry modal ─────────────────────────────────────────────────────────────

function EntryModal({ books, entry, directory, onClose, onSave }) {
  const isNew = Boolean(entry.isNew);
  const [draft, setDraft] = useState(entry);
  const book = books.find((b) => b.id === draft.bookId) || books[0];

  // Auto-fill the subject name from a pasted Discord id, using the local
  // directory (roster + everyone already logged). Never clobbers a name the
  // user typed by hand — only one we auto-filled ourselves.
  const autoNameRef = useRef("");
  const did = (draft.subject?.discordId || "").trim();
  useEffect(() => {
    if (!SNOWFLAKE.test(did)) return;
    const name = directory?.get(did);
    if (!name) return;
    setDraft((d) => {
      const cur = (d.subject?.name || "").trim();
      if (cur && cur !== autoNameRef.current) return d;
      autoNameRef.current = name;
      return { ...d, subject: { ...(d.subject || {}), name } };
    });
  }, [did, directory]);

  const syncBook = (bookId) => {
    const b = books.find((x) => x.id === bookId) || books[0];
    setDraft((d) => ({
      ...d,
      bookId: b.id,
      type: (b.types || [])[0] || "",
      values: (b.fields || []).map((f) => ({
        label: f.label,
        type: f.type,
        ...(f.type === "select" ? { options: f.options || [] } : {}),
        value: f.type === "checkbox" ? false : "",
      })),
    }));
  };

  const setValue = (i, value) =>
    setDraft((d) => ({ ...d, values: d.values.map((v, j) => (j === i ? { ...v, value } : v)) }));

  const typeOptions = isNew
    ? book?.types || []
    : [...new Set([draft.type, ...(books.find((b) => b.id === draft.bookId)?.types || [])])].filter(Boolean);

  const valid =
    draft.type && draft.subject?.name?.trim() && SNOWFLAKE.test((draft.subject?.discordId || "").trim());

  return (
    <Modal open onClose={onClose} title={isNew ? "Log entry" : "Edit entry"} className="max-w-2xl">
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {isNew && (
            <Field label="Logbook">
              <Select
                value={draft.bookId || ""}
                onChange={(v) => syncBook(v)}
                options={books.map((b) => ({ value: b.id, label: b.name }))}
              />
            </Field>
          )}
          <Field label="Entry type">
            <Select
              value={draft.type || ""}
              onChange={(v) => setDraft({ ...draft, type: v })}
              placeholder="Choose type…"
              options={typeOptions.map((t) => ({ value: t, label: t }))}
            />
          </Field>
          <Field label="Date">
            <TextInput
              type="date"
              value={draft.date || ""}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subject, name" hint="Who this entry is about.">
            <TextInput
              value={draft.subject?.name || ""}
              placeholder="J. Doe"
              onChange={(e) =>
                setDraft({ ...draft, subject: { ...(draft.subject || {}), name: e.target.value } })
              }
            />
          </Field>
          <Field
            label="Subject, Discord ID"
            required
            hint="Paste an ID to auto-fill the name; required so the entry ties to the right person."
          >
            <TextInput
              value={draft.subject?.discordId || ""}
              placeholder="000000000000000000"
              className="font-mono"
              onChange={(e) =>
                setDraft({
                  ...draft,
                  subject: { ...(draft.subject || {}), discordId: e.target.value.trim() },
                })
              }
            />
          </Field>
        </div>

        {(draft.values || []).map((v, i) => (
          <Field key={i} label={v.label}>
            {v.type === "textarea" ? (
              <TextArea rows={3} value={v.value || ""} onChange={(e) => setValue(i, e.target.value)} />
            ) : v.type === "select" ? (
              <Select
                value={v.value || ""}
                onChange={(val) => setValue(i, val)}
                placeholder="—"
                options={[...new Set([...(v.options || []), ...(v.value ? [v.value] : [])])].map((o) => ({
                  value: o,
                  label: o,
                }))}
              />
            ) : v.type === "checkbox" ? (
              <label className="flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={!!v.value}
                  onChange={(e) => setValue(i, e.target.checked)}
                  className="size-4 accent-[var(--color-primary)]"
                />
                Yes
              </label>
            ) : (
              <TextInput
                type={v.type === "date" ? "date" : "text"}
                value={v.value || ""}
                onChange={(e) => setValue(i, e.target.value)}
              />
            )}
          </Field>
        ))}

        {!isNew && (
          <p className="text-xs text-slate-500">
            This entry is a snapshot from {formatDate((entry.at || "").slice(0, 10))} — its fields stay
            exactly as they were logged, even if the logbook's setup changes later.
          </p>
        )}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={!valid} onClick={() => onSave(draft)}>
          {isNew ? "Submit entry" : "Save changes"}
        </Button>
      </div>
    </Modal>
  );
}

// ─── Logbook manager ─────────────────────────────────────────────────────────

function BooksModal({ books: initial, onClose, onDone }) {
  // Edits stay local so typing a book or field name never fires a save per
  // keystroke; the whole set is persisted once on Done.
  const [books, setBooks] = useState(initial);
  const update = (id, patch) => setBooks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const move = (id, dir) =>
    setBooks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= bs.length) return bs;
      const next = [...bs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const [confirmDel, setConfirmDel] = useState(null);

  return (
    <Modal
      open
      onClose={() => {
        onDone(books);
        onClose();
      }}
      title="Manage logbooks"
      className="max-w-3xl"
    >
      <p className="mb-4 text-sm text-slate-400">
        Each logbook has its own entry types and custom fields. Changing them only affects NEW
        entries — everything already logged keeps its snapshot and statistics.
      </p>
      <div className="grid gap-3">
        {books.map((b, idx) => (
          <div key={b.id} className="grid gap-3 rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3">
            <div className="flex items-center gap-2">
              <TextInput
                value={b.name}
                onChange={(e) => update(b.id, { name: e.target.value })}
                className="h-10 flex-1 font-semibold"
              />
              <IconButton icon={ChevronUp} label="Move up" disabled={idx === 0} onClick={() => move(b.id, -1)} />
              <IconButton icon={ChevronDown} label="Move down" disabled={idx === books.length - 1} onClick={() => move(b.id, 1)} />
              <IconButton icon={Trash2} label="Delete logbook" danger onClick={() => setConfirmDel(b)} />
            </div>
            <Field label="Entry types" hint="These are the choices when logging.">
              <CommaListInput
                value={b.types || []}
                placeholder="Type a value, Enter to add…"
                onChange={(types) => update(b.id, { types })}
              />
            </Field>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Custom fields
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    update(b.id, {
                      fields: [...(b.fields || []), { id: uid("lf"), label: "New field", type: "text" }],
                    })
                  }
                >
                  <Plus className="size-4" />
                  Add field
                </Button>
              </div>
              <div className="grid gap-1.5">
                {(b.fields || []).map((f) => (
                  <div key={f.id} className="grid grid-cols-[1fr_150px_auto] items-center gap-1.5">
                    <TextInput
                      value={f.label}
                      className="h-10"
                      onChange={(e) =>
                        update(b.id, {
                          fields: b.fields.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)),
                        })
                      }
                    />
                    <Select
                      value={f.type}
                      onChange={(val) =>
                        update(b.id, {
                          fields: b.fields.map((x) => (x.id === f.id ? { ...x, type: val } : x)),
                        })
                      }
                      options={FIELD_TYPES}
                    />
                    <IconButton
                      icon={Trash2}
                      label="Remove field"
                      danger
                      onClick={() => update(b.id, { fields: b.fields.filter((x) => x.id !== f.id) })}
                    />
                    {f.type === "select" && (
                      <div className="col-span-3">
                        <CommaListInput
                          value={f.options || []}
                          placeholder="Option A, Option B…"
                          onChange={(options) =>
                            update(b.id, {
                              fields: b.fields.map((x) => (x.id === f.id ? { ...x, options } : x)),
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="justify-self-start"
          onClick={() => setBooks((bs) => [...bs, { id: uid("book"), name: "New Logbook", types: ["Entry"], fields: [] }])}
        >
          <Plus className="size-4" />
          Add logbook
        </Button>
      </div>
      <div className="mt-5 flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            onDone(books);
            onClose();
          }}
        >
          Done
        </Button>
      </div>

      {confirmDel && (
        <Modal open onClose={() => setConfirmDel(null)} title="Delete logbook?" className="max-w-md">
          <p className="text-sm text-slate-300">
            Delete “{confirmDel.name}”? Entries already logged are snapshots and stay in the
            statistics, but no new entries can be logged to it.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmDel(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setBooks((bs) => bs.filter((b) => b.id !== confirmDel.id));
                setConfirmDel(null);
              }}
            >
              Delete logbook
            </Button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

// ─── Statistics (computed live from the entries) ─────────────────────────────

function countBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const k = keyFn(item);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return [...map.entries()];
}

function StatBox({ label, value, color }) {
  return (
    <Card className="p-4" style={{ borderLeft: `3px solid ${color || "var(--color-primary)"}` }}>
      <div className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 text-3xl font-black tabular-nums" style={{ color: color || "var(--color-primary)" }}>
        {value}
      </div>
    </Card>
  );
}

function TypeBars({ list }) {
  const counts = countBy(list, (e) => e.type);
  const max = counts[0]?.[1] || 1;
  return (
    <div className="grid gap-2.5">
      {counts.map(([type, n]) => {
        const color = typeColor(type);
        return (
          <div key={type}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-slate-200">{type}</span>
              <span className="shrink-0 font-bold tabular-nums" style={{ color }}>
                {n}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(6, (n / max) * 100)}%`,
                  background: `linear-gradient(90deg, color-mix(in srgb, ${color} 70%, transparent), ${color})`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BookBreakdown({ entries }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {groupBy(entries, (e) => e.bookName).map(([book, list]) => (
        <Card key={book} className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-white">{book}</span>
            <Badge>{list.length}</Badge>
          </div>
          <TypeBars list={list} />
        </Card>
      ))}
    </div>
  );
}

const personKey = (p) => p?.discordId || (p?.name || "").toLowerCase();
function leaderboard(entries, pick) {
  const map = new Map();
  for (const e of entries) {
    const p = pick(e);
    if (!p || !p.name) continue;
    const key = personKey(p);
    if (!map.has(key)) map.set(key, { key, name: p.name, discordId: p.discordId || "", count: 0, types: new Map() });
    const r = map.get(key);
    r.count += 1;
    r.types.set(e.type, (r.types.get(e.type) || 0) + 1);
  }
  return [...map.values()]
    .map((r) => ({ ...r, topType: [...r.types.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "" }))
    .sort((a, b) => b.count - a.count);
}
const initialsOf = (name) =>
  (name || "?")
    .split(/\s+/)
    .map((w) => w[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

function Leaderboard({ title, subtitle, rows, onPick, accent = "var(--color-primary)" }) {
  const max = rows[0]?.count || 1;
  return (
    <Card className="p-4">
      <div className="mb-3">
        <div className="text-sm font-bold text-white">{title}</div>
        {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No entries yet.</p>
      ) : (
        <div className="grid gap-1.5">
          {rows.slice(0, 8).map((r, i) => (
            <button
              key={r.key}
              onClick={() => onPick(r.discordId || r.name)}
              title="Show this member's activity"
              className="group flex items-center gap-3 rounded-lg px-1.5 py-1 text-left transition hover:bg-white/[0.04]"
            >
              <span className="w-4 shrink-0 text-center text-xs font-bold text-slate-500">{i + 1}</span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-[11px] font-bold text-slate-300">
                {initialsOf(r.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{r.name}</span>
                {r.topType && <span className="block truncate text-[11px] text-slate-500">mostly {r.topType}</span>}
              </span>
              <span className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-white/[0.06] sm:block">
                <span className="block h-full rounded-full" style={{ width: `${Math.max(8, (r.count / max) * 100)}%`, background: accent }} />
              </span>
              <span className="w-7 shrink-0 text-right text-sm font-bold tabular-nums text-white">{r.count}</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function StatsView({ entries }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const matches = (p) =>
    Boolean(p) && ((p.name || "").toLowerCase().includes(q) || (p.discordId || "").includes(query.trim()));

  const { asSubject, asLogger } = useMemo(() => {
    if (!q) return { asSubject: [], asLogger: [] };
    return {
      asSubject: entries.filter((e) => matches(e.subject)),
      asLogger: entries.filter((e) => matches(e.by)),
    };
  }, [entries, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const within = (days) => {
    const cutoff = Date.now() - days * 86400000;
    return entries.filter((e) => new Date(e.at || e.date).getTime() >= cutoff).length;
  };
  const last7 = useMemo(() => within(7), [entries]); // eslint-disable-line react-hooks/exhaustive-deps
  const last30 = useMemo(() => within(30), [entries]); // eslint-disable-line react-hooks/exhaustive-deps
  const topLoggers = useMemo(() => leaderboard(entries, (e) => e.by), [entries]);
  const topSubjects = useMemo(() => leaderboard(entries, (e) => e.subject), [entries]);

  return (
    <div className="grid gap-4">
      <div className="relative max-w-md">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <TextInput
          value={query}
          placeholder="Search a member by name or Discord ID…"
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {q ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Entries about them" value={asSubject.length} color="#3b82f6" />
            <StatBox label="Logged by them" value={asLogger.length} color="#22c55e" />
          </div>
          <div>
            <div className="mb-2 text-sm font-bold text-white">
              About them <span className="font-normal text-slate-500">· as the subject</span>
            </div>
            {asSubject.length ? (
              <BookBreakdown entries={asSubject} />
            ) : (
              <p className="text-sm text-slate-500">Nothing logged about a matching member.</p>
            )}
          </div>
          <div>
            <div className="mb-2 text-sm font-bold text-white">
              Their activity <span className="font-normal text-slate-500">· entries they logged</span>
            </div>
            {asLogger.length ? (
              <BookBreakdown entries={asLogger} />
            ) : (
              <p className="text-sm text-slate-500">No entries logged by a matching member.</p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatBox label="All entries" value={entries.length} />
            <StatBox label="Last 7 days" value={last7} color="#22c55e" />
            <StatBox label="Last 30 days" value={last30} color="#3b82f6" />
            <StatBox label="Staff logging" value={topLoggers.length} color="#a855f7" />
            <StatBox label="Members logged" value={topSubjects.length} color="#f59e0b" />
          </div>
          {entries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
              Statistics appear here as entries are logged.
            </p>
          ) : (
            <>
              <div>
                <div className="mb-2 text-sm font-bold text-white">Top members</div>
                <div className="grid items-start gap-4 lg:grid-cols-2">
                  <Leaderboard title="Top staff activity" subtitle="Who's logging the most entries" rows={topLoggers} onPick={setQuery} accent="#22c55e" />
                  <Leaderboard title="Most logged about" subtitle="Members with the most entries about them" rows={topSubjects} onPick={setQuery} accent="#f59e0b" />
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-bold text-white">By logbook &amp; type</div>
                <BookBreakdown entries={entries} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Webhook settings (management only) ──────────────────────────────────────

function WebhookModal({ webhook, onClose, onSave, onToast }) {
  const [draft, setDraft] = useState(webhook || {});
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const [testing, setTesting] = useState(false);

  async function sendTest() {
    if (!draft.url) return;
    setTesting(true);
    try {
      const res = await fetch(draft.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(draft.botName ? { username: String(draft.botName).slice(0, 80) } : {}),
          embeds: [
            {
              title: "Admin log webhook test",
              description: "This is a test from the department hub.",
              color: parseInt(String(draft.color || "#3b82f6").replace("#", ""), 16) || 0x3b82f6,
            },
          ],
          allowed_mentions: { parse: [] },
        }),
      });
      onToast?.(res.ok ? "Test sent to Discord" : `Discord rejected it (${res.status})`);
    } catch {
      onToast?.("Couldn't reach the webhook (check the URL)");
    }
    setTesting(false);
  }

  return (
    <Modal open onClose={onClose} title="Admin log webhook" className="max-w-2xl">
      <div className="grid gap-4">
        <p className="text-sm text-slate-400">
          Post each new log to a Discord channel as an embed, with optional role pings above it. The
          URL is stored server-side and never shown to non-managers — it fires from the server when
          an entry is saved.
        </p>

        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={!!draft.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
            className="size-4 accent-[var(--color-primary)]"
          />
          Enabled — post new entries to Discord
        </label>

        <Field label="Webhook URL" hint="Discord → Channel → Integrations → Webhooks → Copy URL.">
          <TextInput
            value={draft.url || ""}
            onChange={(e) => set({ url: e.target.value.trim() })}
            placeholder="https://discord.com/api/webhooks/…"
          />
        </Field>

        <Field label="Ping role IDs" hint="Optional. Pinged above the embed.">
          <CommaListInput
            value={draft.roleIds || []}
            onChange={(roleIds) => set({ roleIds })}
            placeholder="123456789012345678…"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bot name" hint="Optional override.">
            <TextInput value={draft.botName || ""} onChange={(e) => set({ botName: e.target.value })} placeholder="FHP Records" />
          </Field>
          <Field label="Bot avatar URL" hint="Optional override.">
            <TextInput value={draft.avatarUrl || ""} onChange={(e) => set({ avatarUrl: e.target.value.trim() })} placeholder="https://…" />
          </Field>
          <Field label="Embed colour" hint="Optional. Defaults to the log type's colour.">
            <ColorInput value={draft.color || "#3b82f6"} onChange={(color) => set({ color })} />
          </Field>
          <Field label="Footer note" hint="Optional. Appended after the department name.">
            <TextInput value={draft.footer || ""} onChange={(e) => set({ footer: e.target.value })} placeholder="Florida Highway Patrol" />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" disabled={!draft.url || testing} onClick={sendTest}>
            <Send className="size-4" />
            {testing ? "Sending…" : "Send test"}
          </Button>
        </div>

        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
          The webhook URL is a write credential for your Discord channel. It's stored in the site
          config and hidden from non-manager reads — only site managers can view or change it.
        </p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => {
            onSave(draft);
            onClose();
          }}
        >
          Save
        </Button>
      </div>
    </Modal>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function DeptAdminLog({ page, config }) {
  const { can, mutate, savePage } = useDeptConfig();
  const { user } = useAuth();
  const { toast, show } = useToast();

  const cfg = page.config || {};
  const books = Array.isArray(cfg.books) ? cfg.books : [];
  const entries = Array.isArray(cfg.entries) ? cfg.entries : [];

  // Discord id → display name, from everyone already logged, so pasting a known
  // id auto-fills the subject name without a network call.
  const directory = useMemo(() => {
    const m = new Map();
    const add = (id, name) => {
      if (id && name && !m.has(String(id))) m.set(String(id), name);
    };
    for (const e of entries) {
      add(e.subject?.discordId, e.subject?.name);
      add(e.by?.discordId, e.by?.name);
    }
    return m;
  }, [entries]);

  const canWrite = can("manageLog");
  const canModerate = can("manageLog");
  const canWebhook = can("manage");
  const canEditEntry = (e) => canModerate || (canWrite && e.by?.discordId && e.by.discordId === user?.id);
  const userName = user?.displayName || user?.username || "Unknown";

  const [tab, setTab] = useState(books[0]?.id || "stats");
  const [entryModal, setEntryModal] = useState(null);
  const [booksOpen, setBooksOpen] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Persist one patch to this page's own config.
  const writeCfg = (patch) => savePage(page.id, { ...cfg, ...patch }).catch(() => {});
  const setEntries = (next) => writeCfg({ entries: next });

  const activeBook = books.find((b) => b.id === tab);

  function openNewEntry() {
    const b = activeBook || books[0];
    if (!b) return;
    setEntryModal({
      id: uid("entry"),
      isNew: true,
      bookId: b.id,
      type: (b.types || [])[0] || "",
      date: todayISO(),
      subject: { name: "", discordId: "" },
      values: (b.fields || []).map((f) => ({
        label: f.label,
        type: f.type,
        ...(f.type === "select" ? { options: f.options || [] } : {}),
        value: f.type === "checkbox" ? false : "",
      })),
    });
  }

  function saveEntry(draft) {
    const { isNew, ...clean } = draft;
    if (isNew) {
      const book = books.find((b) => b.id === clean.bookId);
      const entry = {
        ...clean,
        bookName: book?.name || "Log",
        at: new Date().toISOString(),
        by: { name: userName, discordId: user?.id || "" },
      };
      writeCfg({ entries: [entry, ...entries] });
      show("Entry logged");
    } else {
      setEntries(
        entries.map((e) =>
          e.id === clean.id
            ? { ...e, ...clean, editedBy: userName, editedAt: new Date().toISOString() }
            : e,
        ),
      );
      show("Entry updated");
    }
    setEntryModal(null);
  }

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    let list = entries.filter((e) => e.bookId === tab);
    if (q) {
      list = list.filter(
        (e) =>
          (e.subject?.name || "").toLowerCase().includes(q) ||
          (e.subject?.discordId || "").includes(query.trim()) ||
          (e.by?.name || "").toLowerCase().includes(q) ||
          (e.type || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [entries, tab, q, query]);

  return (
    <div>
      <Toast message={toast} />
      <DeptPageHeader
        icon={page.icon || "Gavel"}
        eyebrow={config.branding.shortName}
        title={page.label}
        subtitle="Hires, discipline, trainings, interviews and booths — every entry snapshotted at submission."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canModerate && books.length === 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  writeCfg({ books: defaultBooks() });
                  show("Default logbooks created");
                }}
              >
                Create default logbooks
              </Button>
            )}
            {canModerate && (
              <Button variant="ghost" size="sm" onClick={() => setBooksOpen(true)}>
                <Settings2 className="size-4" />
                Manage logbooks
              </Button>
            )}
            {canWebhook && (
              <Button variant="ghost" size="sm" onClick={() => setWebhookOpen(true)}>
                <Webhook className="size-4" />
                Webhook
              </Button>
            )}
            {canWrite && books.length > 0 && (
              <Button size="sm" onClick={openNewEntry}>
                <Plus className="size-4" />
                Log entry
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs: each logbook + statistics */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02] p-1">
        {books.map((b) => (
          <button
            key={b.id}
            onClick={() => {
              setTab(b.id);
              setLimit(PAGE_SIZE);
            }}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              tab === b.id ? "bg-primary-500/20 text-white" : "text-slate-400 hover:text-white",
            )}
          >
            <ClipboardList size={13} className={tab === b.id ? "text-primary-400" : ""} />
            {b.name}
            <span className="rounded-full bg-white/10 px-1.5 text-[10px]">
              {entries.filter((e) => e.bookId === b.id).length}
            </span>
          </button>
        ))}
        <div className="mx-1 my-0.5 ml-auto w-px shrink-0 self-stretch bg-white/10" />
        <button
          onClick={() => setTab("stats")}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-bold transition",
            tab === "stats"
              ? "border-primary-400 bg-primary-500/20 text-white"
              : "border-primary-400/45 text-primary-300 hover:bg-primary-500/10",
          )}
        >
          <BarChart3 size={14} />
          Statistics
        </button>
      </div>

      {tab === "stats" ? (
        <StatsView entries={entries} />
      ) : !activeBook ? (
        <Card className="p-10 text-center">
          <Gavel className="mx-auto mb-3 size-8 text-slate-500" />
          <div className="text-base font-semibold text-slate-200">No logbooks yet</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            {canModerate
              ? "Create the standard set (Admin Log, FTO, Interview, Booth) or build your own with Manage logbooks."
              : "A manager hasn't set up any logbooks for this department yet."}
          </p>
          {canModerate && (
            <Button
              className="mt-4"
              size="sm"
              onClick={() => {
                writeCfg({ books: defaultBooks() });
                show("Default logbooks created");
              }}
            >
              <Plus className="size-4" />
              Create default logbooks
            </Button>
          )}
        </Card>
      ) : (
        <>
          <div className="relative mb-3 max-w-md">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <TextInput
              value={query}
              placeholder="Search subject, logger, or type…"
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {visible.length === 0 ? (
            <Card className="p-10 text-center text-sm text-slate-500">
              {q ? "Nothing matches the search." : "Nothing logged here yet."}
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-2.5 font-semibold">Type</th>
                        <th className="px-4 py-2.5 font-semibold">Subject</th>
                        <th className="px-4 py-2.5 font-semibold">Logged by</th>
                        <th className="px-4 py-2.5 font-semibold">Details</th>
                        <th className="px-4 py-2.5 font-semibold">Date</th>
                        {canWrite && <th className="px-2 py-2.5" />}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.slice(0, limit).map((e) => (
                        <EntryRow
                          key={e.id}
                          entry={e}
                          canEdit={canEditEntry(e)}
                          onEdit={() => setEntryModal(e)}
                          onDelete={() => setConfirmDel(e)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              {visible.length > limit && (
                <div className="mt-3 flex justify-center">
                  <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                    Show {Math.min(PAGE_SIZE, visible.length - limit)} more
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {entryModal && (
        <EntryModal
          key={entryModal.id}
          books={books}
          entry={entryModal}
          directory={directory}
          onClose={() => setEntryModal(null)}
          onSave={saveEntry}
        />
      )}
      {booksOpen && (
        <BooksModal
          books={books}
          onClose={() => setBooksOpen(false)}
          onDone={(next) => writeCfg({ books: next })}
        />
      )}
      {webhookOpen && (
        <WebhookModal
          webhook={config.webhooks?.adminlog || {}}
          onClose={() => setWebhookOpen(false)}
          onSave={(next) =>
            mutate((c) => ({ ...c, webhooks: { ...(c.webhooks || {}), adminlog: next } }))
          }
          onToast={show}
        />
      )}
      {confirmDel && (
        <Modal open onClose={() => setConfirmDel(null)} title="Delete log entry?" className="max-w-md">
          <p className="text-sm text-slate-300">
            Delete the “{confirmDel.type}” entry about {confirmDel.subject?.name || "this member"}?
            Statistics update immediately, and this can't be undone from here.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmDel(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setEntries(entries.filter((e) => e.id !== confirmDel.id));
                setConfirmDel(null);
                show("Entry deleted");
              }}
            >
              Delete entry
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
