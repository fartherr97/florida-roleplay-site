import { useEffect, useMemo, useState } from "react";
import { Save, Search } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import { api } from "../../lib/api";
import {
  EXAMS,
  examSettings as seedSettings,
  questionCatalog as seedCatalog,
} from "../../data/staffHubData";

const EXAM_FILTER = [
  { value: "all", label: "All exams" },
  ...EXAMS.map((exam) => ({ value: exam.key, label: exam.label })),
];

/** Threshold editor for one exam. */
function ThresholdCard({ exam, values, onChange }) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-bold text-white">{exam.label}</h3>
      <p className="mt-1 text-xs text-slate-500">
        At or above the pass score is a pass; the review band is checked by hand;
        anything below it fails.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {[
          ["passScore", "Pass score"],
          ["maxScore", "Max score"],
          ["reviewMin", "Review min"],
          ["reviewMax", "Review max"],
        ].map(([key, label]) => (
          <Field key={key} label={label} htmlFor={`${exam.key}-${key}`}>
            <TextInput
              id={`${exam.key}-${key}`}
              inputMode="numeric"
              value={values?.[key] ?? ""}
              onChange={(e) => onChange(exam.key, key, e.target.value)}
            />
          </Field>
        ))}
      </div>
    </Card>
  );
}

/** Exam thresholds and the question catalog. Head Admin only. */
export default function HubManagement() {
  const [settings, setSettings] = useState(seedSettings);
  const [catalog, setCatalog] = useState(seedCatalog);
  const [examFilter, setExamFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.hubExamSettings(), api.hubQuestionCatalog()]).then(
      ([nextSettings, nextCatalog]) => {
        if (!active) return;
        if (nextSettings) setSettings(nextSettings);
        if (nextCatalog?.length) setCatalog(nextCatalog);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const updateExam = (examKey, field, value) =>
    setSettings((prev) => ({
      ...prev,
      [examKey]: { ...prev[examKey], [field]: value },
    }));

  const updateQuestion = (rowNumber, field, value) =>
    setCatalog((prev) =>
      prev.map((row) =>
        row.rowNumber === rowNumber ? { ...row, [field]: value } : row,
      ),
    );

  const saveSettings = async () => {
    const result = await api.hubSaveExamSettings(settings);
    setStatus(result?.message ?? "Exam thresholds saved.");
  };

  const saveQuestion = async (row) => {
    const result = await api.hubSaveQuestion(row.rowNumber, {
      questionText: row.questionText,
      points: row.points,
      correctAnswer: row.correctAnswer,
    });
    setStatus(result?.message ?? `Question ${row.questionNumber} saved.`);
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog.filter((row) => {
      if (examFilter !== "all" && row.examType !== examFilter) return false;
      if (!needle) return true;
      return (
        row.questionText.toLowerCase().includes(needle) ||
        row.questionId.toLowerCase().includes(needle)
      );
    });
  }, [catalog, examFilter, query]);

  return (
    <>
      <HubPageHeader
        icon="SlidersHorizontal"
        title="Management"
        subtitle="Grading thresholds and the question catalog behind the three staff exams."
        actions={<Badge tone="rose">Head Admin only</Badge>}
      />

      {status && (
        <Card className="mb-6 p-4">
          <p className="text-sm font-semibold text-emerald-300">{status}</p>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        {EXAMS.map((exam) => (
          <ThresholdCard
            key={exam.key}
            exam={exam}
            values={settings[exam.key]}
            onChange={updateExam}
          />
        ))}
      </div>

      <div className="mt-5 flex justify-end">
        <Button size="sm" onClick={saveSettings}>
          <Save className="size-4" />
          Save thresholds
        </Button>
      </div>

      <div className="mt-10">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Question catalog
        </h2>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <TextInput
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search questions"
              aria-label="Search the question catalog"
              className="pl-11"
            />
          </div>
          <Select
            value={examFilter}
            onChange={setExamFilter}
            options={EXAM_FILTER}
            className="sm:w-56"
          />
        </div>

        {filtered.length === 0 ? (
          <Card className="mt-4 p-8 text-center">
            <p className="text-sm text-slate-400">No questions match that search.</p>
          </Card>
        ) : (
          <div className="mt-4 space-y-4">
            {filtered.map((row) => (
              <Card key={row.rowNumber} className="p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <code className="rounded-lg bg-black/30 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-inset ring-white/10">
                    {row.questionId}
                  </code>
                  <Badge tone="brand">
                    {EXAMS.find((e) => e.key === row.examType)?.short ?? row.examType}
                  </Badge>
                  <Badge tone="slate">{row.questionType}</Badge>
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    Question {row.questionNumber}
                  </span>
                </div>

                <Field
                  label="Question text"
                  htmlFor={`q-text-${row.rowNumber}`}
                  className="mt-4"
                >
                  <TextArea
                    id={`q-text-${row.rowNumber}`}
                    rows={2}
                    value={row.questionText}
                    onChange={(e) =>
                      updateQuestion(row.rowNumber, "questionText", e.target.value)
                    }
                  />
                </Field>

                <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_8rem]">
                  <Field label="Correct answer" htmlFor={`q-answer-${row.rowNumber}`}>
                    <TextInput
                      id={`q-answer-${row.rowNumber}`}
                      value={row.correctAnswer}
                      onChange={(e) =>
                        updateQuestion(row.rowNumber, "correctAnswer", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Points" htmlFor={`q-points-${row.rowNumber}`}>
                    <TextInput
                      id={`q-points-${row.rowNumber}`}
                      inputMode="numeric"
                      value={row.points}
                      onChange={(e) =>
                        updateQuestion(row.rowNumber, "points", e.target.value)
                      }
                    />
                  </Field>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => saveQuestion(row)}>
                    <Save className="size-4" />
                    Save question
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
