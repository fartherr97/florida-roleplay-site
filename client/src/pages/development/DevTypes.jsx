import { createElement, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, GripVertical, Plus, Save, Trash2, Wrench } from "lucide-react";
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
import { iconFor } from "../../lib/icons";
import { cn } from "../../lib/cn";
import { PERMISSION_GROUPS } from "../../data/permissions";
import {
  DEFAULT_REQUEST_TYPES,
  FIELD_TYPES,
  REQUEST_ICON_CHOICES,
  REQUEST_TONE_CHOICES,
  blankRequestField,
  blankRequestType,
  normalizeRequestTypes,
  validateRequestType,
} from "../../lib/devhub";

const OPEN_OPTIONS = [
  { value: "", label: "Anyone signed in" },
  ...PERMISSION_GROUPS.flatMap((group) => group.permissions.map((p) => ({ value: p.key, label: `${p.label} — ${group.label}` }))),
];
const ICON_OPTIONS = REQUEST_ICON_CHOICES.map((name) => ({ value: name, label: name }));
const TONE_OPTIONS = REQUEST_TONE_CHOICES.map((tone) => ({ value: tone, label: tone }));
const FIELD_TYPE_OPTIONS = FIELD_TYPES.map((f) => ({ value: f.id, label: f.label }));
const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * The request-category editor. Managers (development.manage) decide what members
 * pick when opening a request and the intake fields each one asks for. A master
 * list on the left, one category's editor on the right, one Save that writes the
 * whole ordered catalogue.
 */
export default function DevTypes() {
  const { user, hasPermission, loading } = useAuth();
  const [draft, setDraft] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState([]);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .devRequestTypes()
      .then((r) => {
        if (!active) return;
        const types = r?.types?.length ? r.types : DEFAULT_REQUEST_TYPES;
        setDraft(clone(types));
        setSelectedId(types[0]?.id ?? null);
      })
      .catch(() => active && setDraft(clone(DEFAULT_REQUEST_TYPES)));
    return () => {
      active = false;
    };
  }, []);

  if (loading) return null;
  if (!user) return <AccessDenied reason="signed-out" />;
  if (!hasPermission("development.manage")) return <AccessDenied reason="role" />;

  const list = draft ?? [];
  const selected = list.find((type) => type.id === selectedId) ?? null;

  const replace = (id, patch) => setDraft((prev) => prev.map((type) => (type.id === id ? { ...type, ...patch } : type)));
  const addType = () => {
    const created = blankRequestType({ label: "New category" });
    setDraft((prev) => [...prev, created]);
    setSelectedId(created.id);
    setProblems([]);
  };
  const removeType = (id) =>
    setDraft((prev) => {
      const next = prev.filter((type) => type.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
  const move = (id, direction) =>
    setDraft((prev) => {
      const index = prev.findIndex((type) => type.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const save = async () => {
    const normalized = normalizeRequestTypes(list);
    const found = normalized.flatMap((type) =>
      type.enabled ? validateRequestType(type).map((p) => `${type.label || type.id}: ${p}`) : [],
    );
    if (normalized.length === 0) found.push("Keep at least one category.");
    setProblems(found);
    if (found.length) return;

    setSaving(true);
    try {
      const result = await api.saveDevRequestTypes(normalized);
      if (result?.ok) {
        setDraft(clone(result.types ?? normalized));
        setSavedAt(Date.now());
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
      <Button as={Link} to="/development" variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="size-4" />
        Development Hub
      </Button>

      <PageHeader
        eyebrow="Development · Manage"
        title="Request categories"
        subtitle="What a member picks when opening a request, and the questions each one asks."
        actions={
          <div className="flex items-center gap-2">
            {savedAt > 0 && problems.length === 0 && <span className="text-xs text-emerald-300">Saved</span>}
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

      {draft === null ? (
        <div className="h-96 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : (
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
                    type.id === selectedId ? "bg-violet-500/15 ring-1 ring-inset ring-violet-400/30" : "hover:bg-white/[0.05]",
                  )}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-slate-300 ring-1 ring-inset ring-white/[0.06]">
                    {createElement(iconFor(type.icon, Wrench), { className: "size-4" })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{type.label || "Untitled"}</span>
                    <span className="block truncate text-xs text-slate-500">{type.fields?.length ?? 0} field{(type.fields?.length ?? 0) === 1 ? "" : "s"}</span>
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
                      className={cn("size-4", index === list.length - 1 ? "text-slate-700" : "text-slate-400 hover:text-white")}
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
            <TypeEditor key={selected.id} type={selected} onChange={(patch) => replace(selected.id, patch)} onRemove={() => removeType(selected.id)} />
          ) : (
            <Card className="grid place-items-center p-10 text-sm text-slate-400">Add a category to get started.</Card>
          )}
        </div>
      )}
    </Section>
  );
}

function TypeEditor({ type, onChange, onRemove }) {
  const setField = (index, patch) => onChange({ fields: type.fields.map((field, i) => (i === index ? { ...field, ...patch } : field)) });
  const addField = () => onChange({ fields: [...type.fields, blankRequestField()] });
  const removeField = (index) => onChange({ fields: type.fields.filter((_, i) => i !== index) });

  return (
    <Card className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-slate-200 ring-1 ring-inset ring-white/[0.06]">
            {createElement(iconFor(type.icon, Wrench), { className: "size-5" })}
          </span>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={type.enabled !== false} onChange={(e) => onChange({ enabled: e.target.checked })} className="size-4 accent-violet-500" />
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
          <TextInput value={type.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="e.g. LEO Personal Vehicle" />
        </Field>
        <Field label="Icon">
          <Select value={type.icon} options={ICON_OPTIONS} onChange={(value) => onChange({ icon: value })} />
        </Field>
      </div>

      <Field label="Blurb" hint="The one line shown under the category on the picker.">
        <TextArea rows={2} value={type.blurb} onChange={(e) => onChange({ blurb: e.target.value })} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Accent colour">
          <Select value={type.tone} options={TONE_OPTIONS} onChange={(value) => onChange({ tone: value })} />
        </Field>
        <Field label="Who can open it" hint="Leave as “Anyone signed in” for a public category.">
          <Select value={type.openPermission ?? ""} options={OPEN_OPTIONS} onChange={(value) => onChange({ openPermission: value || null })} />
        </Field>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Intake fields</p>
          <Button variant="ghost" size="sm" onClick={addField}>
            <Plus className="size-4" />
            Add field
          </Button>
        </div>
        {type.fields.length === 0 ? (
          <p className="text-sm text-slate-500">No extra questions — just a title and a description.</p>
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
                      <Select value={field.type} options={FIELD_TYPE_OPTIONS} onChange={(value) => setField(index, { type: value })} />
                    </Field>
                    {field.type === "select" && (
                      <Field label="Options" hint="Comma-separated." className="sm:col-span-2">
                        <TextInput
                          value={(field.options ?? []).join(", ")}
                          onChange={(e) => setField(index, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                        />
                      </Field>
                    )}
                    <Field label="Help text" className="sm:col-span-2">
                      <TextInput value={field.help ?? ""} onChange={(e) => setField(index, { help: e.target.value })} />
                    </Field>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <button type="button" onClick={() => removeField(index)} aria-label="Remove field" className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300">
                      <Trash2 className="size-4" />
                    </button>
                    <label className="flex items-center gap-1.5 text-xs text-slate-400">
                      <input type="checkbox" checked={field.required === true} onChange={(e) => setField(index, { required: e.target.checked })} className="size-3.5 accent-violet-500" />
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
