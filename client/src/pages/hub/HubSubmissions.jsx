import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import StatTile from "../../components/hub/StatTile";
import ExamStatusBadge from "../../components/hub/ExamStatusBadge";
import { api, buildExamDashboard } from "../../lib/api";
import { EXAMS, attempts as seedAttempts, attemptQuestions } from "../../data/staffHubData";
import { useAuth } from "../../context/useAuth";
import { formatDate } from "../../lib/format";

const STATUS_OPTIONS = ["Pass", "Needs Review", "Fail"];

/** Attempt detail — per-question breakdown plus the manual override form. */
function AttemptModal({ attempt, onClose, onSaved }) {
  const { user } = useAuth();
  // The caller keys this component by attemptId, so every field can initialise
  // straight from props instead of being reset by an effect.
  const [fetched, setFetched] = useState(null);
  const [overrideScore, setOverrideScore] = useState(attempt?.score ?? "");
  const [overrideStatus, setOverrideStatus] = useState(attempt?.status ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const attemptId = attempt?.attemptId;

  useEffect(() => {
    if (!attemptId) return undefined;
    let active = true;
    api.hubAttempt(attemptId).then((next) => {
      if (active && next?.attemptId === attemptId) setFetched(next);
    });
    return () => {
      active = false;
    };
  }, [attemptId]);

  const detail =
    fetched?.attemptId === attemptId
      ? fetched
      : { ...attempt, questions: attemptQuestions[attemptId] ?? [] };

  const submit = async (e) => {
    e.preventDefault();
    if (reason.trim().length < 10) {
      setError("Give a reason of at least 10 characters — it goes on the audit log.");
      return;
    }
    setSaving(true);
    try {
      await api.hubSaveOverride(attempt.attemptId, {
        discordId: attempt.discordId,
        staffName: attempt.name,
        examType: attempt.examType,
        originalScore: attempt.originalScore,
        originalStatus: attempt.originalStatus,
        overrideScore,
        overrideStatus,
        reviewer: user?.displayName || user?.username || "Unknown",
        reason: reason.trim(),
      });
      onSaved({ ...attempt, score: overrideScore, status: overrideStatus });
    } catch (err) {
      setError((err.errors ?? [err.message]).join(" "));
    } finally {
      setSaving(false);
    }
  };

  if (!attempt) return null;
  const questions = detail?.questions ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      title={attempt.name}
      subtitle={`${EXAMS.find((e) => e.key === attempt.examType)?.label} · ${attempt.attemptId}`}
      className="max-w-2xl"
    >
      <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Score" value={attempt.score} />
          <StatTile label="Original" value={attempt.originalScore} tone="brand" />
          <Card className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Status
            </p>
            <div className="mt-2">
              <ExamStatusBadge status={attempt.status} />
            </div>
          </Card>
          <StatTile
            label="Submitted"
            value={formatDate(attempt.submittedAt)}
            tone="white"
          />
        </div>

        {attempt.override && (
          <Card className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Existing override
            </p>
            <p className="mt-2 text-sm text-slate-300">{attempt.override.reason}</p>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
              {attempt.override.reviewer} · {formatDate(attempt.override.timestamp)}
            </p>
          </Card>
        )}

        {questions.length > 0 && (
          <Card className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Question review
            </p>
            <ul className="mt-4 space-y-3">
              {questions.map((question) => {
                const correct = Number(question.awarded) >= Number(question.points);
                return (
                  <li
                    key={question.questionNumber}
                    className="rounded-xl bg-black/25 p-4 ring-1 ring-inset ring-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-white">
                        {question.questionNumber}. {question.questionText}
                      </p>
                      <Badge tone={correct ? "green" : "rose"}>
                        {question.awarded}/{question.points}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      <span className="text-slate-600">Answered:</span>{" "}
                      {question.answer}
                    </p>
                    {!correct && (
                      <p className="mt-1 text-sm text-slate-400">
                        <span className="text-slate-600">Expected:</span>{" "}
                        {question.correctAnswer}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <form onSubmit={submit} className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Manual override
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Override score" htmlFor="overrideScore">
              <TextInput
                id="overrideScore"
                value={overrideScore}
                onChange={(e) => setOverrideScore(e.target.value)}
              />
            </Field>
            <Field label="Override status" htmlFor="overrideStatus">
              <Select
                id="overrideStatus"
                value={overrideStatus}
                onChange={setOverrideStatus}
                options={STATUS_OPTIONS}
              />
            </Field>
          </div>
          <Field label="Reason" htmlFor="overrideReason" required hint={error}>
            <TextArea
              id="overrideReason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this result being changed? This is recorded permanently."
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={saving}>
              <Save className="size-4" />
              {saving ? "Saving…" : "Save override"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

/** Exam submissions dashboard — totals, per-exam recents, attempt drill-down. */
export default function HubSubmissions() {
  const [data, setData] = useState(() => buildExamDashboard(seedAttempts));
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let active = true;
    api.hubExamDashboard().then((next) => {
      if (active && next?.totals) setData(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const totals = data.totals ?? {};

  return (
    <>
      <HubPageHeader
        icon="Inbox"
        title="Recent Submissions"
        subtitle="Every staff exam attempt, newest first. Open one to review its answers or override the result."
        actions={<Badge tone="primary">Jr. Admin+</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Profiles" value={totals.totalProfiles} />
        <StatTile label="Attempts" value={totals.totalAttempts} />
        <StatTile label="Pass" value={totals.pass} tone="green" />
        <StatTile label="Needs review" value={totals.needsReview} tone="amber" />
        <StatTile label="Fail" value={totals.fail} tone="rose" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        {EXAMS.map((exam) => (
          <Card key={exam.key} className="overflow-hidden">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <h2 className="text-sm font-bold text-white">{exam.label}</h2>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Five most recent
              </p>
            </div>
            <ul className="divide-y divide-white/[0.06]">
              {(data.recentByExam?.[exam.key] ?? []).map((attempt) => (
                <li key={attempt.attemptId}>
                  <button
                    type="button"
                    onClick={() => setSelected(attempt)}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {attempt.name}
                      </p>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                        {formatDate(attempt.submittedAt)} · {attempt.score}
                      </p>
                    </div>
                    <ExamStatusBadge status={attempt.status} />
                  </button>
                </li>
              ))}
              {(data.recentByExam?.[exam.key] ?? []).length === 0 && (
                <li className="px-5 py-6 text-center text-sm text-slate-500">
                  No attempts yet.
                </li>
              )}
            </ul>
          </Card>
        ))}
      </div>

      <AttemptModal
        key={selected?.attemptId}
        attempt={selected}
        onClose={() => setSelected(null)}
        onSaved={(updated) => {
          setData((prev) => applyOverride(prev, updated));
          setSelected(null);
        }}
      />
    </>
  );
}

/** Reflects a saved override in the loaded dashboard without a full refetch. */
function applyOverride(dashboard, updated) {
  const patch = (list) =>
    list.map((item) => (item.attemptId === updated.attemptId ? updated : item));
  return {
    ...dashboard,
    recentSubmissions: patch(dashboard.recentSubmissions ?? []),
    recentByExam: Object.fromEntries(
      Object.entries(dashboard.recentByExam ?? {}).map(([key, list]) => [
        key,
        patch(list),
      ]),
    ),
  };
}
