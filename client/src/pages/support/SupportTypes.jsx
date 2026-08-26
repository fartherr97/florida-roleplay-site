import { createElement, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import AccessDenied from "../../components/auth/AccessDenied";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { useSupportConfig } from "../../context/useSupportConfig";
import { iconFor } from "../../lib/icons";
import { cn } from "../../lib/cn";
import { PERMISSION_GROUPS } from "../../data/permissions";
import {
  FIELD_TYPES,
  TICKET_ICON_CHOICES,
  TICKET_TONE_CHOICES,
  blankTicketField,
  blankTicketType,
  normalizeTicketTypes,
  validateTicketType,
} from "../../lib/support";

/** Every permission, for the "who can open this" dropdown. */
const ALL_PERMISSION_OPTIONS = [
  { value: "", label: "Anyone signed in" },
  ...PERMISSION_GROUPS.flatMap((group) =>
    group.permissions.map((p) => ({ value: p.key, label: `${p.label} — ${group.label}` })),
  ),
];

/** The permissions that make sense as "worked by": support and per-department. */
const QUEUE_PERMISSIONS = PERMISSION_GROUPS.filter(
  (group) => group.id === "support" || group.id === "department_support",
).flatMap((group) => group.permissions.map((p) => ({ key: p.key, label: p.label })));

const ICON_OPTIONS = TICKET_ICON_CHOICES.map((name) => ({ value: name, label: name }));
const TONE_OPTIONS = TICKET_TONE_CHOICES.map((tone) => ({ value: tone, label: tone }));
const FIELD_TYPE_OPTIONS = FIELD_TYPES.map((f) => ({ value: f.id, label: f.label }));

const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * The ticket-category editor.
 *
 * Categories are configuration, and this is the page that edits them: what a
 * member picks when they open a ticket, who may open each, and which team works
 * it. A master list on the left, one category's editor on the right, and one
 * Save that writes the whole ordered catalogue at once — the shape it is stored
 * in. Gated on `support.configure`, which is Directorship and Ownership.
 */
export default function SupportTypes() {
  const { hasPermission } = useAuth();
  const { types, reload } = useSupportConfig();

  const [draft, setDraft] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState([]);
  const [savedAt, setSavedAt] = useState(0);
  const [seeded, setSeeded] = useState(false);

  // Seed the working copy once the catalogue has loaded — a fresh clone so
  // editing never mutates the shared context list. Adjusting state during render
  // (guarded so it runs once) is React's escape hatch for exactly this and, unlike
  // an effect, does not paint a stale first frame.
  if (!seeded && Array.isArray(types) && types.length) {
    setDraft(clone(types));
    setSelectedId(types[0]?.id ?? null);
    setSeeded(true);
  }

  const canConfigure = hasPermission("support.configure");
  if (!canConfigure) return <AccessDenied reason="role" />;

  const list = draft ?? [];
  const selected = list.find((type) => type.id === selectedId) ?? null;

  const replace = (id, patch) =>
    setDraft((prev) => prev.map((type) => (type.id === id ? { ...type, ...patch } : type)));

  const addType = () => {
    const created = blankTicketType({ label: "New category" });
    setDraft((prev) => [...prev, created]);
    setSelectedId(created.id);
    setProblems([]);
  };

  const removeType = (id) => {
    setDraft((prev) => {
      const next = prev.filter((type) => type.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
  };

  const move = (id, direction) => {
    setDraft((prev) => {
      const index = prev.findIndex((type) => type.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async () => {
    const normalized = normalizeTicketTypes(list);
    const found = normalized.flatMap((type) =>
      type.enabled ? validateTicketType(type).map((p) => `${type.label || type.id}: ${p}`) : [],
    );
    if (normalized.length === 0) found.push("Keep at least one category.");
    setProblems(found);
    if (found.length) return;

    setSaving(true);
    try {
      const result = await api.saveSupportTypes(normalized);
      if (result?.ok) {
        setDraft(clone(result.types ?? normalized));
        setSavedAt(Date.now());
        reload();
      } else if (result?.problems) {
        setProblems(result.problems);
      } else {
        setProblems([result?.message ?? "That was not saved."]);
      }
    } catch (err) {
      setProblems(err?.problems ?? [err?.message ?? "That was not saved."]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section className="max-w-6xl">
      <Button as={Link} to="/support" variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="size-4" />
        Support
      </Button>

      <PageHeader
        eyebrow="Support · Directorship"
        title="Ticket categories"
        subtitle="What a member picks when they open a ticket — who may open each, and which team works it."
        actions={
          <div className="flex items-center gap-2">
            {savedAt > 0 && problems.length === 0 && (
              <span className="text-xs text-emerald-300">Saved</span>
            )}
            <Button size="sm" onClick={save} disabled={saving || draft === null}>
              <Save className="size-4" />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      />

      {problems.length > 0 && (
        <Card className="mb-5 border-rose-400/30 bg-rose-500/[0.06] p-4">
          <p className="text-sm font-semibold text-rose-200">Fix these before it saves:</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-rose-200/90">
            {problems.map((problem, i) => (
              <li key={i}>{problem}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          <div className="space-y-1.5">
            {list.map((type, index) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelectedId(type.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                  type.id === selectedId
                    ? "bg-brand-500/15 ring-1 ring-inset ring-brand-400/30"
                    : "hover:bg-white/[0.05]",
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-slate-300 ring-1 ring-inset ring-white/[0.06]">
                  {createElement(iconFor(type.icon), { className: "size-4" })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">
                    {type.label || "Untitled"}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {(type.workPermissions ?? []).length > 0
                      ? workedByLabel(type)
                      : type.exclusive
                        ? "Restricted"
                        : "Support team"}
                  </span>
                </span>
                {type.enabled === false && <Badge tone="slate">Off</Badge>}
                <span className="flex shrink-0 flex-col">
                  <ChevronUp
                    className={cn("size-4", index === 0 ? "text-slate-700" : "text-slate-400 hover:text-white")}
                    onClick={(e) => {
                      e.stopPropagation();
                      move(type.id, -1);
                    }}
                  />
                  <ChevronDown
                    className={cn(
                      "size-4",
                      index === list.length - 1 ? "text-slate-700" : "text-slate-400 hover:text-white",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      move(type.id, 1);
                    }}
                  />
                </span>
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" className="w-full" onClick={addType}>
            <Plus className="size-4" />
            Add category
          </Button>
        </div>

        {selected ? (
          <TypeEditor
            key={selected.id}
            type={selected}
            onChange={(patch) => replace(selected.id, patch)}
            onRemove={() => removeType(selected.id)}
          />
        ) : (
          <Card className="grid place-items-center p-10 text-sm text-slate-400">
            Add a category to get started.
          </Card>
        )}
      </div>
    </Section>
  );
}

function workedByLabel(type) {
  const names = (type.workPermissions ?? []).map(
    (key) => QUEUE_PERMISSIONS.find((p) => p.key === key)?.label ?? key,
  );
  return names.join(", ");
}

function TypeEditor({ type, onChange, onRemove }) {
  const setField = (index, patch) => {
    const fields = type.fields.map((field, i) => (i === index ? { ...field, ...patch } : field));
    onChange({ fields });
  };
  const addField = () => onChange({ fields: [...type.fields, blankTicketField()] });
  const removeField = (index) => onChange({ fields: type.fields.filter((_, i) => i !== index) });

  const toggleWork = (key) => {
    const held = type.workPermissions ?? [];
    onChange({
      workPermissions: held.includes(key) ? held.filter((k) => k !== key) : [...held, key],
    });
  };

  return (
    <Card className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-slate-200 ring-1 ring-inset ring-white/[0.06]">
            {createElement(iconFor(type.icon), { className: "size-5" })}
          </span>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={type.enabled !== false}
              onChange={(e) => onChange({ enabled: e.target.checked })}
              className="size-4 accent-brand-500"
            />
            Shown to members
          </label>
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="size-4" />
          Delete
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>
          <TextInput value={type.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="e.g. FHP — Florida Highway Patrol" />
        </Field>
        <Field label="Icon">
          <Select value={type.icon} options={ICON_OPTIONS} onChange={(value) => onChange({ icon: value })} />
        </Field>
      </div>

      <Field label="Blurb" hint="The one line shown under the category on the picker.">
        <TextArea rows={2} value={type.blurb} onChange={(e) => onChange({ blurb: e.target.value })} />
      </Field>

      <Field label="Accent colour">
        <Select value={type.tone} options={TONE_OPTIONS} onChange={(value) => onChange({ tone: value })} />
      </Field>

      {/* Access ------------------------------------------------------------ */}
      <div className="space-y-4 rounded-xl bg-black/20 p-4 ring-1 ring-inset ring-white/[0.06]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Access</p>

        <Field label="Who can open it" hint="Leave as “Anyone signed in” for a public category.">
          <Select
            value={type.openPermission ?? ""}
            options={ALL_PERMISSION_OPTIONS}
            onChange={(value) => onChange({ openPermission: value || null })}
          />
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-200">Worked by</p>
          <p className="mb-2.5 text-xs text-slate-500">
            The teams that see and work this queue. A department category routes to that
            department&apos;s command.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUEUE_PERMISSIONS.map((permission) => {
              const on = (type.workPermissions ?? []).includes(permission.key);
              return (
                <button
                  key={permission.key}
                  type="button"
                  onClick={() => toggleWork(permission.key)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition",
                    on
                      ? "bg-brand-500/15 text-white ring-brand-400/40"
                      : "bg-black/20 text-slate-400 ring-white/[0.06] hover:text-white",
                  )}
                >
                  {permission.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-start gap-2.5 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={type.exclusive === true}
            onChange={(e) => onChange({ exclusive: e.target.checked })}
            className="mt-0.5 size-4 accent-brand-500"
          />
          <span>
            Restricted — <span className="text-slate-400">only the teams above see it. Leave off and the
            central support team sees it too. Turn on for something like a report about staff.</span>
          </span>
        </label>
      </div>

      {/* Intake fields ----------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Intake fields</p>
          <Button variant="ghost" size="sm" onClick={addField}>
            <Plus className="size-4" />
            Add field
          </Button>
        </div>
        {type.fields.length === 0 ? (
          <p className="text-sm text-slate-500">No extra questions — just a subject and a description.</p>
        ) : (
          <div className="space-y-3">
            {type.fields.map((field, index) => (
              <div key={field.id ?? index} className="rounded-xl bg-black/20 p-3 ring-1 ring-inset ring-white/[0.06]">
                <div className="flex items-start gap-2">
                  <GripVertical className="mt-2.5 size-4 shrink-0 text-slate-600" />
                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <Field label="Question">
                      <TextInput value={field.label} onChange={(e) => setField(index, { label: e.target.value })} />
                    </Field>
                    <Field label="Type">
                      <Select
                        value={field.type}
                        options={FIELD_TYPE_OPTIONS}
                        onChange={(value) => setField(index, { type: value })}
                      />
                    </Field>
                    {field.type === "select" && (
                      <Field label="Options" hint="Comma-separated." className="sm:col-span-2">
                        <TextInput
                          value={(field.options ?? []).join(", ")}
                          onChange={(e) =>
                            setField(index, {
                              options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean),
                            })
                          }
                        />
                      </Field>
                    )}
                    <Field label="Help text" className="sm:col-span-2">
                      <TextInput value={field.help ?? ""} onChange={(e) => setField(index, { help: e.target.value })} />
                    </Field>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => removeField(index)}
                      aria-label="Remove field"
                      className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <Trash2 className="size-4" />
                    </button>
                    <label className="flex items-center gap-1.5 text-xs text-slate-400">
                      <input
                        type="checkbox"
                        checked={field.required === true}
                        onChange={(e) => setField(index, { required: e.target.checked })}
                        className="size-3.5 accent-brand-500"
                      />
                      Required
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
