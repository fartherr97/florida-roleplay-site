import { Star } from "lucide-react";
import Select from "../ui/Select";
import { TextArea, TextInput } from "../ui/TextInput";
import { cn } from "../../lib/cn";

/**
 * One question's input, by type. The single place that knows how each question
 * type is answered — the runner, the review view and the builder's preview all
 * render through here, so they can never disagree about what a question looks
 * like.
 *
 * `readOnly` renders the same control disabled, which is what the review view
 * uses: showing a reviewer a different layout from the one the candidate filled
 * in makes their answers harder to read against the prompt.
 */
export default function QuestionInput({ question, value, onChange, readOnly = false }) {
  const set = (next) => !readOnly && onChange(next);
  const id = `q-${question.id}`;

  switch (question.type) {
    case "paragraph":
      return (
        <TextArea
          id={id}
          rows={5}
          value={value ?? ""}
          disabled={readOnly}
          onChange={(e) => set(e.target.value)}
        />
      );

    case "short":
      return (
        <TextInput
          id={id}
          value={value ?? ""}
          disabled={readOnly}
          onChange={(e) => set(e.target.value)}
        />
      );

    case "date":
    case "time":
      return (
        <TextInput
          id={id}
          type={question.type}
          value={value ?? ""}
          disabled={readOnly}
          onChange={(e) => set(e.target.value)}
          className="max-w-56"
        />
      );

    case "dropdown":
      return (
        <Select
          id={id}
          value={value ?? ""}
          disabled={readOnly}
          onChange={set}
          options={(question.options ?? []).map((option) => ({ value: option, label: option }))}
          placeholder="Choose an answer"
          className="max-w-md"
        />
      );

    case "truefalse":
      return (
        <ChoiceList
          name={id}
          options={["True", "False"]}
          value={value}
          onChange={set}
          readOnly={readOnly}
        />
      );

    case "multiple":
      return (
        <ChoiceList
          name={id}
          options={question.options ?? []}
          value={value}
          onChange={set}
          readOnly={readOnly}
        />
      );

    case "checkboxes":
      return (
        <ChoiceList
          name={id}
          options={question.options ?? []}
          value={Array.isArray(value) ? value : []}
          onChange={set}
          readOnly={readOnly}
          multiple
        />
      );

    case "scale":
      return (
        <ScaleInput
          question={question}
          value={value}
          onChange={set}
          readOnly={readOnly}
        />
      );

    case "rating":
      return (
        <RatingInput question={question} value={value} onChange={set} readOnly={readOnly} />
      );

    default:
      return (
        <p className="text-sm text-slate-500">
          This question uses a type this build does not know how to render.
        </p>
      );
  }
}

/** Radio or checkbox rows, styled as one control so the two read alike. */
function ChoiceList({ name, options, value, onChange, readOnly, multiple = false }) {
  const selected = multiple ? new Set(value ?? []) : null;

  const toggle = (option) => {
    if (!multiple) return onChange(option);
    const next = new Set(selected);
    if (next.has(option)) next.delete(option);
    else next.add(option);
    return onChange([...next]);
  };

  return (
    <div className="space-y-2">
      {options.map((option) => {
        const on = multiple ? selected.has(option) : value === option;
        return (
          <label
            key={option}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 text-sm ring-1 ring-inset transition",
              on
                ? "bg-primary-500/10 text-white ring-primary-400/30"
                : "bg-white/[0.02] text-slate-300 ring-white/[0.06]",
              readOnly ? "cursor-default opacity-70" : "hover:bg-white/[0.05]",
            )}
          >
            <input
              type={multiple ? "checkbox" : "radio"}
              name={name}
              value={option}
              checked={on}
              disabled={readOnly}
              onChange={() => toggle(option)}
              className="size-4 shrink-0 accent-[#f2800d]"
            />
            <span className="min-w-0">{option}</span>
          </label>
        );
      })}
    </div>
  );
}

function ScaleInput({ question, value, onChange, readOnly }) {
  const min = question.scaleMin ?? 1;
  const max = question.scaleMax ?? 5;
  const steps = Array.from({ length: max - min + 1 }, (_, index) => min + index);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((step) => (
          <button
            key={step}
            type="button"
            disabled={readOnly}
            onClick={() => onChange(step)}
            className={cn(
              "size-10 rounded-xl text-sm font-bold ring-1 ring-inset transition",
              Number(value) === step
                ? "bg-primary-500 text-white ring-transparent"
                : "bg-white/[0.02] text-slate-300 ring-white/[0.06]",
              readOnly ? "cursor-default opacity-70" : "hover:bg-white/[0.06]",
            )}
          >
            {step}
          </button>
        ))}
      </div>
      {(question.minLabel || question.maxLabel) && (
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span>{question.minLabel}</span>
          <span>{question.maxLabel}</span>
        </div>
      )}
    </div>
  );
}

function RatingInput({ question, value, onChange, readOnly }) {
  const max = question.ratingMax ?? 5;
  const stars = Array.from({ length: max }, (_, index) => index + 1);

  return (
    <div className="flex gap-1.5">
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange(star)}
          aria-label={`${star} of ${max}`}
          className={cn(
            "rounded-lg p-1 transition",
            readOnly ? "cursor-default" : "hover:scale-110",
          )}
        >
          <Star
            className={cn(
              "size-7",
              Number(value) >= star ? "fill-primary-500 text-primary-500" : "text-slate-600",
            )}
          />
        </button>
      ))}
    </div>
  );
}
