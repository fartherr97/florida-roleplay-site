import { cn } from "../../lib/cn";
import Field from "../ui/Field";
import { TextArea, TextInput } from "../ui/TextInput";
import Select from "../ui/Select";
import { FIELD_TYPE_MAP, isContentField } from "../../lib/applicationConfig";

/**
 * One field of an application, drawn from its type.
 *
 * The renderer is shared by the form the applicant fills in and the builder's
 * preview, so what a department sees while building is literally the control
 * their applicants get — not an approximation of it.
 */
export default function ApplyField({ field, value, error, onChange, disabled = false }) {
  const spec = FIELD_TYPE_MAP[field.type];
  const id = `f-${field.id}`;

  if (isContentField(field.type)) {
    return field.type === "heading" ? (
      <h3 className="pt-2 text-lg font-black tracking-tight text-white">{field.label}</h3>
    ) : (
      <p className="rounded-2xl bg-white/[0.03] p-4 text-sm leading-relaxed text-slate-300 ring-1 ring-inset ring-white/[0.06]">
        {field.label}
      </p>
    );
  }

  const invalid = Boolean(error);
  const ring = invalid ? "ring-rose-400/60 focus:ring-rose-400/70" : undefined;

  // An agreement carries its statement on the tickbox itself, so repeating it
  // as a field label above would print the same sentence twice.
  const labelled = field.type !== "agree";

  return (
    <Field
      label={labelled ? field.label : undefined}
      htmlFor={id}
      required={labelled && field.required}
      hint={error || field.help || undefined}
      className={invalid ? "[&_p]:text-rose-300" : undefined}
    >
      {renderControl()}
    </Field>
  );

  function renderControl() {
    switch (spec.input) {
      case "textarea":
        return (
          <>
            <TextArea
              id={id}
              value={value ?? ""}
              disabled={disabled}
              placeholder={field.placeholder || undefined}
              onChange={(e) => onChange(e.target.value)}
              className={ring}
              aria-invalid={invalid}
            />
            {(field.minLength || field.maxLength) && (
              <p className="text-right text-[0.7rem] tabular-nums text-slate-500">
                {String(value ?? "").length}
                {field.maxLength ? ` / ${field.maxLength}` : ""}
                {field.minLength ? ` · ${field.minLength} minimum` : ""}
              </p>
            )}
          </>
        );

      case "number":
        return (
          <TextInput
            id={id}
            type="number"
            inputMode="numeric"
            value={value ?? ""}
            disabled={disabled}
            min={field.min}
            max={field.max}
            placeholder={field.placeholder || undefined}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            className={ring}
            aria-invalid={invalid}
          />
        );

      case "date":
      case "time":
        return (
          <TextInput
            id={id}
            type={spec.input}
            value={value ?? ""}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className={cn("[color-scheme:dark]", ring)}
            aria-invalid={invalid}
          />
        );

      case "select":
        return (
          <Select
            id={id}
            value={value ?? ""}
            disabled={disabled}
            options={field.options}
            placeholder="Choose one"
            onChange={onChange}
          />
        );

      case "radio":
        return (
          <div className="space-y-2">
            {field.options.map((option) => (
              <Choice
                key={option}
                type="radio"
                name={id}
                label={option}
                checked={value === option}
                disabled={disabled}
                onChange={() => onChange(option)}
              />
            ))}
          </div>
        );

      case "checkbox": {
        const chosen = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {field.options.map((option) => (
              <Choice
                key={option}
                type="checkbox"
                label={option}
                checked={chosen.includes(option)}
                disabled={disabled}
                onChange={() =>
                  onChange(
                    chosen.includes(option)
                      ? chosen.filter((v) => v !== option)
                      : [...chosen, option],
                  )
                }
              />
            ))}
          </div>
        );
      }

      case "agree":
        return (
          <Choice
            type="checkbox"
            label={field.label}
            checked={value === true}
            disabled={disabled}
            onChange={() => onChange(value !== true)}
          />
        );

      case "scale":
        return <Scale field={field} value={value} disabled={disabled} onChange={onChange} />;

      default:
        return (
          <TextInput
            id={id}
            value={value ?? ""}
            disabled={disabled}
            placeholder={field.placeholder || undefined}
            onChange={(e) => onChange(e.target.value)}
            className={ring}
            aria-invalid={invalid}
          />
        );
    }
  }
}

/** A radio or checkbox with the whole row as its hit area. */
function Choice({ type, name, label, checked, disabled, onChange }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-sm ring-1 ring-inset transition",
        checked
          ? "bg-brand-500/10 text-white ring-brand-400/40"
          : "bg-black/20 text-slate-300 ring-white/[0.06] hover:bg-white/[0.04]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="mt-0.5 size-4 shrink-0 accent-brand-500"
      />
      <span className="leading-relaxed">{label}</span>
    </label>
  );
}

/** The linear scale, as one button per step so it works on a phone. */
function Scale({ field, value, disabled, onChange }) {
  const steps = [];
  for (let n = field.min; n <= field.max; n += 1) steps.push(n);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {steps.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className={cn(
              "size-11 rounded-xl text-sm font-bold tabular-nums ring-1 ring-inset transition",
              value === n
                ? "bg-brand-500 text-white ring-brand-400"
                : "bg-black/25 text-slate-300 ring-white/[0.08] hover:bg-white/[0.06]",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {(field.minLabel || field.maxLabel) && (
        <div className="mt-2 flex justify-between text-[0.7rem] text-slate-500">
          <span>{field.minLabel}</span>
          <span>{field.maxLabel}</span>
        </div>
      )}
    </div>
  );
}
