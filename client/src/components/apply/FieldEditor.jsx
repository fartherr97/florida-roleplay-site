import { ChevronDown, ChevronUp, Copy, GripVertical, Trash2, X } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Field from "../ui/Field";
import Select from "../ui/Select";
import { TextInput } from "../ui/TextInput";
import ApplyField from "./ApplyField";
import {
  FIELD_TYPES,
  FIELD_TYPE_MAP,
  fieldHasOptions,
  isContentField,
} from "../../lib/applicationConfig";

const TYPE_OPTIONS = FIELD_TYPES.map((t) => ({ value: t.type, label: t.label }));

/**
 * One field, opened up for editing.
 *
 * Collapsed it is a row you can reorder; expanded it is every setting that type
 * carries and nothing that it does not — a paragraph gets a length range, a
 * scale gets its bounds and end labels, a dropdown gets its choices. Showing all
 * of them on every field is how a builder becomes unreadable.
 */
export default function FieldEditor({
  field,
  fields,
  expanded,
  onToggle,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
  first,
  last,
}) {
  const spec = FIELD_TYPE_MAP[field.type];
  const set = (patch) => onChange({ ...field, ...patch });

  // A field can only depend on one that comes before it, and only on one with a
  // fixed set of answers — a condition on free text is a condition nobody can
  // satisfy reliably.
  const triggers = fields
    .slice(0, fields.findIndex((f) => f.id === field.id))
    .filter((f) => fieldHasOptions(f.type) || f.type === "agree");

  const trigger = triggers.find((f) => f.id === field.showIf?.fieldId);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <GripVertical className="size-4 shrink-0 text-slate-600" aria-hidden />
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 text-left"
          aria-expanded={expanded}
        >
          <p className="truncate text-sm font-semibold text-white">
            {field.label || <span className="text-slate-500">Untitled {spec.label.toLowerCase()}</span>}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.7rem] text-slate-500">
            <span>{spec.label}</span>
            {field.required && !isContentField(field.type) && <span className="text-brand-400">· required</span>}
            {field.showIf && <span className="text-amber-400">· conditional</span>}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton label="Move up" onClick={() => onMove(-1)} disabled={first}>
            <ChevronUp className="size-4" />
          </IconButton>
          <IconButton label="Move down" onClick={() => onMove(1)} disabled={last}>
            <ChevronDown className="size-4" />
          </IconButton>
          <IconButton label="Duplicate" onClick={onDuplicate}>
            <Copy className="size-4" />
          </IconButton>
          <IconButton label="Delete" onClick={onRemove} danger>
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      {expanded && (
        <div className="space-y-5 border-t border-white/[0.06] px-4 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" htmlFor={`type-${field.id}`}>
              <Select
                id={`type-${field.id}`}
                value={field.type}
                options={TYPE_OPTIONS}
                onChange={(type) => set(retypeField(field, type))}
              />
            </Field>
            <Field label={isContentField(field.type) ? "Text" : "Question"} htmlFor={`label-${field.id}`}>
              <TextInput
                id={`label-${field.id}`}
                value={field.label}
                onChange={(e) => set({ label: e.target.value })}
                placeholder={isContentField(field.type) ? "What they read" : "What you are asking"}
              />
            </Field>
          </div>

          {!isContentField(field.type) && (
            <>
              <Field label="Help text" hint="Shown under the question. Optional.">
                <TextInput
                  value={field.help}
                  onChange={(e) => set({ help: e.target.value })}
                  placeholder="Anything that stops a wrong answer before it happens"
                />
              </Field>

              <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => set({ required: e.target.checked })}
                  className="size-4 accent-brand-500"
                />
                Required
              </label>
            </>
          )}

          {fieldHasOptions(field.type) && (
            <OptionList options={field.options ?? []} onChange={(options) => set({ options })} />
          )}

          {field.type === "scale" && (
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="From">
                <TextInput type="number" value={field.min} onChange={(e) => set({ min: Number(e.target.value) })} />
              </Field>
              <Field label="To">
                <TextInput type="number" value={field.max} onChange={(e) => set({ max: Number(e.target.value) })} />
              </Field>
              <Field label="Low label">
                <TextInput value={field.minLabel ?? ""} onChange={(e) => set({ minLabel: e.target.value })} />
              </Field>
              <Field label="High label">
                <TextInput value={field.maxLabel ?? ""} onChange={(e) => set({ maxLabel: e.target.value })} />
              </Field>
            </div>
          )}

          {(field.type === "number" || field.type === "age") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Minimum" hint={field.type === "age" ? "Anyone younger is refused." : undefined}>
                <TextInput
                  type="number"
                  value={field.min ?? ""}
                  onChange={(e) => set({ min: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
              </Field>
              <Field label="Maximum">
                <TextInput
                  type="number"
                  value={field.max ?? ""}
                  onChange={(e) => set({ max: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
              </Field>
            </div>
          )}

          {(field.type === "short" || field.type === "paragraph") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Shortest answer" hint="Characters. A blunt way to refuse one-word answers.">
                <TextInput
                  type="number"
                  value={field.minLength ?? ""}
                  onChange={(e) => set({ minLength: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
              </Field>
              <Field label="Longest answer">
                <TextInput
                  type="number"
                  value={field.maxLength ?? ""}
                  onChange={(e) => set({ maxLength: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
              </Field>
            </div>
          )}

          {/* Conditional visibility. */}
          <div className="rounded-2xl bg-black/20 p-4 ring-1 ring-inset ring-white/[0.06]">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Only ask this when…</p>
            {triggers.length === 0 ? (
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Nothing above this field has a fixed set of answers to depend on. Add a
                multiple choice, dropdown, checkbox or agreement field first.
              </p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Select
                  value={field.showIf?.fieldId ?? ""}
                  placeholder="Always ask it"
                  options={[
                    { value: "", label: "Always ask it" },
                    ...triggers.map((f) => ({ value: f.id, label: f.label || "Untitled" })),
                  ]}
                  onChange={(fieldId) =>
                    set({ showIf: fieldId ? { fieldId, equals: "" } : undefined })
                  }
                />
                {field.showIf?.fieldId && (
                  <Select
                    value={field.showIf.equals}
                    placeholder="…answers"
                    options={
                      trigger?.type === "agree"
                        ? [{ value: "true", label: "…is ticked" }]
                        : (trigger?.options ?? []).map((o) => ({ value: o, label: `…is "${o}"` }))
                    }
                    onChange={(equals) => set({ showIf: { ...field.showIf, equals } })}
                  />
                )}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              How it looks
            </p>
            <div className="rounded-2xl bg-black/20 p-4 ring-1 ring-inset ring-white/[0.06]">
              <ApplyField field={field} value={undefined} onChange={() => {}} />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Changing a type keeps what still applies and drops what does not. */
function retypeField(field, type) {
  const next = { ...field, type };
  if (fieldHasOptions(type) && !next.options?.length) next.options = ["Option 1", "Option 2"];
  if (!fieldHasOptions(type)) delete next.options;
  if (type !== "scale") {
    delete next.minLabel;
    delete next.maxLabel;
  } else {
    next.min = next.min ?? 1;
    next.max = next.max ?? 5;
  }
  if (type !== "short" && type !== "paragraph") {
    delete next.minLength;
    delete next.maxLength;
  }
  if (isContentField(type)) next.required = false;
  return next;
}

function OptionList({ options, onChange }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Choices</p>
      {options.map((option, index) => (
        <div key={index} className="flex gap-2">
          <TextInput
            value={option}
            onChange={(e) => onChange(options.map((o, i) => (i === index ? e.target.value : o)))}
            placeholder={`Choice ${index + 1}`}
          />
          <button
            type="button"
            onClick={() => onChange(options.filter((_, i) => i !== index))}
            aria-label={`Remove choice ${index + 1}`}
            className="grid size-12 shrink-0 place-items-center rounded-2xl text-slate-500 ring-1 ring-inset ring-white/[0.08] transition hover:text-rose-300"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...options, ""])}>
        Add a choice
      </Button>
    </div>
  );
}

function IconButton({ label, onClick, disabled = false, danger = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] disabled:pointer-events-none disabled:opacity-30 ${
        danger ? "hover:text-rose-300" : "hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
