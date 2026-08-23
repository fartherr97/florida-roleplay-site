import { useMemo, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { TextInput } from "../ui/TextInput";
import QuestionInput from "./QuestionInput";
import { api } from "../../lib/api";
import { applyReview } from "../../lib/forms";
import { formatDateTime } from "../../lib/format";
import { cn } from "../../lib/cn";

const STATUS_TONES = {
  passed: "green",
  failed: "rose",
  "needs-review": "amber",
  submitted: "brand",
};

const STATUS_LABELS = {
  passed: "Passed",
  failed: "Failed",
  "needs-review": "Needs review",
  submitted: "Submitted",
};

/**
 * Grading one submission.
 *
 * Auto-graded answers show their verdict and cannot be changed here — a
 * reviewer who disagrees with the machine should be fixing the answer key,
 * which re-grades everyone rather than one person. What is editable is exactly
 * what the engine flagged: the written answers no machine can score.
 *
 * The running total updates as scores are typed, so a reviewer can see whether
 * their marking takes someone over the threshold before committing to it.
 */
export default function SubmissionReview({ form, submission, onBack, onSaved }) {
  // Only the scores the reviewer has actually set. Seeding this with a zero for
  // every flagged answer would make the header read "Failed" the moment the page
  // opened, before anyone had marked anything — the preview has to reflect the
  // reviewer's decisions, not stand in for them.
  const [points, setPoints] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const byQuestion = useMemo(
    () => Object.fromEntries((submission.graded ?? []).map((entry) => [entry.questionId, entry])),
    [submission.graded],
  );

  // A live preview of where the marking currently lands.
  const preview = useMemo(
    () => applyReview(form, submission, points),
    [form, submission, points],
  );

  const save = async () => {
    setError("");
    setSaving(true);
    // Commit every flagged answer, defaulting the untouched ones to zero — a
    // partial save would leave the submission stuck needing review.
    const payload = Object.fromEntries(
      (submission.graded ?? [])
        .filter((entry) => entry.needsReview)
        .map((entry) => [entry.questionId, points[entry.questionId] ?? 0]),
    );
    try {
      const result = await api.reviewSubmission(form.id, submission.id, payload);
      if (result?.message) setNotice(result.message);
      onSaved?.(applyReview(form, submission, payload));
    } catch (err) {
      setError(err?.errors?.join(" ") || err?.message || "That review was rejected.");
    } finally {
      setSaving(false);
    }
  };

  const pending = (submission.graded ?? []).filter((entry) => entry.needsReview);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-5">
        <ArrowLeft className="size-4" />
        Submissions
      </Button>

      <Card className="mb-5 flex flex-wrap items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-white">
            {submission.subject?.name ?? "Anonymous response"}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {form.title} · {formatDateTime(submission.at)}
            {submission.subject?.discordId && ` · ${submission.subject.discordId}`}
          </p>
        </div>
        <Badge tone={STATUS_TONES[preview.status] ?? "slate"}>
          {STATUS_LABELS[preview.status] ?? preview.status}
        </Badge>
        {/* No running total until something has been marked: a partial score
            beside "Needs review" reads as a result, and it is not one yet. */}
        {preview.maxScore > 0 && !preview.needsReview && (
          <span className="rounded-xl bg-white/[0.03] px-3 py-1.5 text-sm ring-1 ring-inset ring-white/[0.06]">
            <span className="font-bold text-white">{preview.percent}%</span>
            <span className="ml-2 text-xs text-slate-500">
              {preview.score} / {preview.maxScore}
            </span>
          </span>
        )}
      </Card>

      <div className="space-y-4">
        {(form.questions ?? []).map((question, index) => {
          const result = byQuestion[question.id];
          const editable = result?.needsReview;

          return (
            <Card key={question.id} className="p-6">
              <div className="mb-4 flex items-start gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-xs font-bold text-slate-400">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-relaxed text-white">
                    {question.prompt}
                  </p>
                  {question.points > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      Worth {question.points} point{question.points === 1 ? "" : "s"}
                    </p>
                  )}
                </div>

                {result && !editable && question.points > 0 && (
                  <Badge tone={result.correct ? "green" : "rose"}>
                    {result.correct ? (
                      <>
                        <Check className="size-3" /> {result.awarded}/{result.max}
                      </>
                    ) : (
                      <>
                        <X className="size-3" /> {result.awarded}/{result.max}
                      </>
                    )}
                  </Badge>
                )}
              </div>

              <QuestionInput
                question={question}
                value={submission.answers?.[question.id]}
                onChange={() => {}}
                readOnly
              />

              {editable && (
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-4">
                  <label
                    htmlFor={`score-${question.id}`}
                    className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400"
                  >
                    Award
                  </label>
                  <TextInput
                    id={`score-${question.id}`}
                    type="number"
                    min={0}
                    max={question.points}
                    value={points[question.id] ?? 0}
                    onChange={(e) =>
                      setPoints((current) => ({
                        ...current,
                        [question.id]: Math.max(
                          0,
                          Math.min(Number(question.points) || 0, Number(e.target.value) || 0),
                        ),
                      }))
                    }
                    className="h-10 w-24"
                  />
                  <span className="text-xs text-slate-500">of {question.points}</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {error && (
        <p className="mt-5 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-400/25">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-5 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-inset ring-amber-400/25">
          {notice}
        </p>
      )}

      {pending.length > 0 && (
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            {pending.length} written answer{pending.length === 1 ? "" : "s"} to score.
          </p>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save review"}
          </Button>
        </div>
      )}

      {submission.reviewedBy && (
        <p className={cn("mt-4 text-xs text-slate-500")}>
          Reviewed by {submission.reviewedBy} on {formatDateTime(submission.reviewedAt)}.
        </p>
      )}
    </>
  );
}
