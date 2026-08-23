import { useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Copy, Plus, Trash2, X } from "lucide-react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Field from "../ui/Field";
import Select from "../ui/Select";
import { TextArea, TextInput } from "../ui/TextInput";
import QuestionInput from "./QuestionInput";
import { api } from "../../lib/api";
import {
  QUESTION_TYPES,
  blankQuestion,
  typeHasOptions,
} from "../../lib/forms";
import { cn } from "../../lib/cn";

const TYPE_OPTIONS = QUESTION_TYPES.map((entry) => ({ value: entry.type, label: entry.label }));

/**
 * Authoring a form.
 *
 * The answer key lives beside each question rather than on a separate screen,
 * because the commonest authoring mistake is a question whose key was never
 * filled in — and the engine treats that as "needs a human", quietly pushing
 * work onto reviewers. Keeping the key in front of the author is what stops it.
 */
export default function FormBuilder({ form: initial, roles, onBack, onSaved }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const set = (changes) => setForm((current) => ({ ...current, ...changes }));

  const setQuestion = (id, changes) =>
    setForm((current) => ({
      ...current,
      questions: current.questions.map((q) => (q.id === id ? { ...q, ...changes } : q)),
    }));

  const moveQuestion = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= form.questions.length) return;
    const next = [...form.questions];
    [next[index], next[target]] = [next[target], next[index]];
    set({ questions: next });
  };

  const save = async () => {
    setStatus(null);
    setSaving(true);
    try {
      const result = await api.saveForm(form.id, form);
      setStatus(
        result?.message
          ? { tone: "amber", text: result.message }
          : { tone: "green", text: "Saved." },
      );
      onSaved?.(result?.form ?? form);
    } catch (err) {
      setStatus({
        tone: "error",
        text: err?.errors?.join(" ") || err?.message || "That form was rejected.",
      });
    } finally {
      setSaving(false);
    }
  };

  const points = form.questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);
  const unkeyed = form.questions.filter(
    (q) =>
      !form.feedback &&
      Number(q.points) > 0 &&
      q.type !== "paragraph" &&
      (q.correct == null || q.correct === "" || (Array.isArray(q.correct) && q.correct.length === 0)),
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
          All forms
        </Button>
        <Badge tone={form.published ? "green" : "slate"}>
          {form.published ? "Published" : "Draft"}
        </Badge>
        {!form.feedback && <Badge tone="primary">{points} points</Badge>}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => set({ published: !form.published })}>
            {form.published ? "Unpublish" : "Publish"}
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {status && (
        <p
          className={cn(
            "mb-5 rounded-xl px-4 py-3 text-sm ring-1 ring-inset",
            status.tone === "error"
              ? "bg-rose-500/10 text-rose-300 ring-rose-400/25"
              : status.tone === "amber"
                ? "bg-amber-500/10 text-amber-200 ring-amber-400/25"
                : "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25",
          )}
        >
          {status.text}
        </p>
      )}

      {unkeyed.length > 0 && (
        <p className="mb-5 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-inset ring-amber-400/25">
          {unkeyed.length} scored question{unkeyed.length === 1 ? " has" : "s have"} no answer key.
          Those get flagged for a human on every submission — set a key, or drop them to 0 points to
          make them survey fields.
        </p>
      )}

      <Card className="mb-5 space-y-4 p-6">
        <Field label="Title" htmlFor="f-title">
          <TextInput id="f-title" value={form.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Description" htmlFor="f-desc">
          <TextArea
            id="f-desc"
            rows={3}
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Audience" htmlFor="f-audience">
            <Select
              id="f-audience"
              value={form.audience}
              onChange={(value) => set({ audience: value })}
              options={[
                { value: "staff", label: "Staff Hub" },
                { value: "civilian", label: "Civilian Hub" },
                { value: "all", label: "Both hubs" },
              ]}
            />
          </Field>
          <Field label="Pass at" htmlFor="f-threshold" hint="Percent.">
            <TextInput
              id="f-threshold"
              type="number"
              min={0}
              max={100}
              disabled={form.feedback}
              value={form.passThreshold}
              onChange={(e) => set({ passThreshold: Number(e.target.value) })}
            />
          </Field>
          <Field label="Completion message" htmlFor="f-done">
            <TextInput
              id="f-done"
              value={form.completionMessage}
              onChange={(e) => set({ completionMessage: e.target.value })}
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-white/[0.06] pt-4">
          <Toggle
            label="Feedback form"
            hint="Nothing is graded — every question becomes a survey field."
            checked={form.feedback}
            onChange={(feedback) => set({ feedback })}
          />
          <Toggle
            label="Anonymous"
            hint="No name or Discord id is recorded with the response."
            checked={form.anonymous}
            onChange={(anonymous) => set({ anonymous })}
          />
        </div>

        <div className="grid gap-4 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
          <RolePicker
            label="Who may take it"
            hint="Empty means anyone who can open the hub."
            roles={roles}
            value={form.submitRoles}
            onChange={(submitRoles) => set({ submitRoles })}
          />
          <RolePicker
            label="Who may grade it"
            hint="On top of anyone holding the review permission."
            roles={roles}
            value={form.reviewRoles}
            onChange={(reviewRoles) => set({ reviewRoles })}
          />
        </div>
      </Card>

      <div className="space-y-4">
        {form.questions.map((question, index) => (
          <QuestionEditor
            key={question.id}
            question={question}
            index={index}
            feedback={form.feedback}
            isFirst={index === 0}
            isLast={index === form.questions.length - 1}
            onChange={(changes) => setQuestion(question.id, changes)}
            onMove={(delta) => moveQuestion(index, delta)}
            onDuplicate={() =>
              set({
                questions: [
                  ...form.questions.slice(0, index + 1),
                  { ...question, id: `${question.id}-copy-${Date.now().toString(36)}` },
                  ...form.questions.slice(index + 1),
                ],
              })
            }
            onRemove={() =>
              set({ questions: form.questions.filter((entry) => entry.id !== question.id) })
            }
          />
        ))}
      </div>

      <Card className="mt-4 p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          Add a question
        </p>
        <div className="flex flex-wrap gap-2">
          {QUESTION_TYPES.map((type) => (
            <button
              key={type.type}
              type="button"
              onClick={() => set({ questions: [...form.questions, blankQuestion(type.type)] })}
              className="rounded-xl bg-white/[0.02] px-3 py-2 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.06] transition hover:bg-white/[0.06] hover:text-white"
            >
              {type.label}
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex max-w-xs cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[#f2800d]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="mt-0.5 block text-xs leading-snug text-slate-500">{hint}</span>
      </span>
    </label>
  );
}

/** Discord roles as toggle chips, matching how access is granted everywhere else. */
function RolePicker({ label, hint, roles, value = [], onChange }) {
  const held = new Set(value);
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mb-2.5 text-xs text-slate-500">{hint}</p>
      <div className="flex flex-wrap gap-1.5">
        {roles.map((role) => {
          const on = held.has(role.key);
          return (
            <button
              key={role.key}
              type="button"
              onClick={() =>
                onChange(on ? value.filter((entry) => entry !== role.key) : [...value, role.key])
              }
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset transition",
                on
                  ? "bg-primary-500/15 text-primary-300 ring-primary-400/30"
                  : "bg-white/[0.02] text-slate-400 ring-white/[0.06] hover:text-slate-200",
              )}
            >
              {role.rank ?? role.key}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** One question: its prompt, its settings and its answer key. */
function QuestionEditor({
  question,
  index,
  feedback,
  isFirst,
  isLast,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}) {
  const hasOptions = typeHasOptions(question.type);

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-xs font-bold text-slate-400">
          {index + 1}
        </span>
        <Select
          value={question.type}
          onChange={(type) => onChange(blankQuestion(type))}
          options={TYPE_OPTIONS}
          className="max-w-52"
        />
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            aria-label="Move question up"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            aria-label="Move question down"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
          >
            <ChevronDown className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            aria-label="Duplicate question"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            <Copy className="size-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Delete question"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <Field label="Prompt" htmlFor={`p-${question.id}`}>
        <TextArea
          id={`p-${question.id}`}
          rows={2}
          value={question.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
        />
      </Field>

      {hasOptions && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Options
          </p>
          <div className="space-y-2">
            {(question.options ?? []).map((option, optionIndex) => (
              <div key={`${question.id}-o${optionIndex}`} className="flex items-center gap-2">
                <TextInput
                  value={option}
                  className="h-10"
                  onChange={(e) => {
                    const next = [...question.options];
                    next[optionIndex] = e.target.value;
                    onChange({ options: next });
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      options: question.options.filter((_, entry) => entry !== optionIndex),
                    })
                  }
                  aria-label="Remove option"
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() =>
              onChange({
                options: [...(question.options ?? []), `Option ${(question.options?.length ?? 0) + 1}`],
              })
            }
          >
            <Plus className="size-4" />
            Add option
          </Button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-white/[0.06] pt-4">
        <Field label="Points" htmlFor={`pts-${question.id}`} className="w-28">
          <TextInput
            id={`pts-${question.id}`}
            type="number"
            min={0}
            disabled={feedback}
            value={feedback ? 0 : question.points}
            onChange={(e) => onChange({ points: Number(e.target.value) })}
            className="h-10"
          />
        </Field>
        <label className="mb-2.5 flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={question.required}
            onChange={(e) => onChange({ required: e.target.checked })}
            className="size-4 accent-[#f2800d]"
          />
          Required
        </label>
      </div>

      {!feedback && Number(question.points) > 0 && question.type !== "paragraph" && (
        <AnswerKey question={question} onChange={onChange} />
      )}
    </Card>
  );
}

/** The correct answer, in the same control the candidate will answer with. */
function AnswerKey({ question, onChange }) {
  return (
    <div className="mt-4 rounded-2xl bg-emerald-500/[0.04] p-4 ring-1 ring-inset ring-emerald-400/20">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
        Answer key
      </p>

      {question.type === "short" ? (
        <>
          <Field
            label="Accepted answers"
            htmlFor={`key-${question.id}`}
            hint="One per line."
          >
            <TextArea
              id={`key-${question.id}`}
              rows={3}
              value={(question.correct ?? []).join("\n")}
              onChange={(e) =>
                onChange({ correct: e.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })
              }
            />
          </Field>
          <Field label="Matching" htmlFor={`mode-${question.id}`} className="mt-3 max-w-56">
            <Select
              id={`mode-${question.id}`}
              value={question.matchMode ?? "exact"}
              onChange={(matchMode) => onChange({ matchMode })}
              options={[
                { value: "exact", label: "Match one exactly" },
                { value: "keywords", label: "Contain every keyword" },
              ]}
            />
          </Field>
        </>
      ) : (
        <QuestionInput
          question={question}
          value={question.correct}
          onChange={(correct) => onChange({ correct })}
        />
      )}
    </div>
  );
}
