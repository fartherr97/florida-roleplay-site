import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleAlert, ExternalLink } from "lucide-react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import QuestionInput from "./QuestionInput";
import { api } from "../../lib/api";
import { missingRequired } from "../../lib/forms";
import { isExternal, safeUrl } from "../../lib/safeUrl";
import { cn } from "../../lib/cn";

/**
 * Filling in a form.
 *
 * Two things are deliberate. Required questions are checked before submitting
 * and the first offender is scrolled to, because a form that reports "4
 * questions left blank" without saying which is worse than no check at all. And
 * the result comes from the server's response, never from grading locally — the
 * answer key is not in the client for a form the user is taking, and computing a
 * score here would be computing your own exam result.
 */
export default function FormRunner({ form, onBack }) {
  const [answers, setAnswers] = useState({});
  const [missing, setMissing] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const points = useMemo(
    () => (form.questions ?? []).reduce((sum, q) => sum + (Number(q.points) || 0), 0),
    [form.questions],
  );
  const graded = points > 0 && !form.feedback;

  const set = (questionId, value) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setMissing((current) => current.filter((id) => id !== questionId));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    const blank = missingRequired(form, answers);
    if (blank.length > 0) {
      setMissing(blank);
      document
        .getElementById(`question-${blank[0]}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.submitForm(form.id, answers);
      if (response?.ok) setResult({ ...response.result, notice: response.message });
      else setError(response?.message || "That submission was not recorded.");
    } catch (err) {
      setError(err?.errors?.join(" ") || err?.message || "That submission was rejected.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) return <Result form={form} result={result} onBack={onBack} />;

  return (
    <form onSubmit={submit}>
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="mb-5">
        <ArrowLeft className="size-4" />
        All forms
      </Button>

      <Card className="mb-5 p-6 sm:p-8">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">{form.title}</h1>
            {form.description && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                {form.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {graded ? (
              <>
                <Badge tone="primary">{points} points</Badge>
                <Badge tone="amber">Pass at {form.passThreshold}%</Badge>
              </>
            ) : (
              <Badge tone="green">Not graded</Badge>
            )}
            {form.anonymous && <Badge tone="brand">Anonymous</Badge>}
          </div>
        </div>

        {form.resourceLinks?.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.06] pt-5">
            {form.resourceLinks.map((link) => {
              // Author-supplied, so it goes through the same filter as every
              // other stored URL; an unusable one is dropped rather than
              // rendered as a link that does nothing.
              const href = safeUrl(link.url);
              if (!href) return null;
              return (
                <Button
                  key={link.url}
                  as="a"
                  href={href}
                  target={isExternal(href) ? "_blank" : undefined}
                  rel="noreferrer noopener"
                  variant="ghost"
                  size="sm"
                >
                  {link.label}
                  <ExternalLink className="size-3.5" />
                </Button>
              );
            })}
          </div>
        )}

        {form.anonymous && (
          <p className="mt-5 text-xs leading-relaxed text-slate-500">
            Nothing about this response identifies you — your name and Discord id are not recorded
            with it.
          </p>
        )}
      </Card>

      <div className="space-y-4">
        {(form.questions ?? []).map((question, index) => (
          <Card
            key={question.id}
            id={`question-${question.id}`}
            className={cn(
              "p-6",
              missing.includes(question.id) && "ring-1 ring-inset ring-rose-400/40",
            )}
          >
            <div className="mb-4 flex items-start gap-3">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-xs font-bold text-slate-400">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-relaxed text-white">
                  {question.prompt}
                  {question.required && <span className="ml-1 text-rose-400">*</span>}
                </p>
                {graded && question.points > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    {question.points} point{question.points === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            </div>

            <QuestionInput
              question={question}
              value={answers[question.id]}
              onChange={(value) => set(question.id, value)}
            />

            {missing.includes(question.id) && (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-rose-300">
                <CircleAlert className="size-3.5" />
                This one is required.
              </p>
            )}
          </Card>
        ))}
      </div>

      {error && (
        <p className="mt-5 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-400/25">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500">
          {missing.length > 0
            ? `${missing.length} required question${missing.length === 1 ? "" : "s"} still blank.`
            : "Answers cannot be edited once submitted."}
        </p>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </div>
    </form>
  );
}

/** What the person sees straight after submitting. */
function Result({ form, result, onBack }) {
  const pending = result.status === "needs-review";
  const passed = result.status === "passed";

  return (
    <Card className="mx-auto max-w-2xl p-8 text-center sm:p-10">
      <span
        className={cn(
          "mx-auto grid size-16 place-items-center rounded-2xl ring-1 ring-inset",
          pending
            ? "bg-amber-500/10 text-amber-300 ring-amber-400/25"
            : passed
              ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25"
              : result.status === "submitted"
                ? "bg-brand-500/10 text-brand-300 ring-brand-400/25"
                : "bg-rose-500/10 text-rose-300 ring-rose-400/25",
        )}
      >
        {pending ? <CircleAlert className="size-8" /> : <CheckCircle2 className="size-8" />}
      </span>

      <h2 className="mt-5 text-xl font-bold tracking-tight text-white">
        {pending
          ? "Submitted — awaiting review"
          : result.status === "submitted"
            ? "Thank you"
            : passed
              ? "Passed"
              : "Not a pass this time"}
      </h2>

      {/* A pending review reports no score on purpose: showing a partial one
          before the written answers are graded reads as a failure, and it is
          not one yet. */}
      {!pending && result.maxScore > 0 && (
        <p className="mt-3 text-3xl font-extrabold tracking-tight text-white">
          {result.percent}%
          <span className="ml-2 text-sm font-semibold text-slate-500">
            {result.score} / {result.maxScore}
          </span>
        </p>
      )}

      <p className="mt-4 text-sm leading-relaxed text-slate-400">
        {result.message ||
          (pending
            ? "A reviewer will grade the written answers and your result will follow."
            : "Your response has been recorded.")}
      </p>

      {result.notice && <p className="mt-3 text-xs text-amber-300">{result.notice}</p>}

      <Button variant="secondary" size="sm" className="mt-6" onClick={onBack}>
        <ArrowLeft className="size-4" />
        Back to {form.audience === "staff" ? "staff" : "civilian"} forms
      </Button>
    </Card>
  );
}
