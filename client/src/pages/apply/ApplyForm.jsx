import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Loader2, Send } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import NotFound from "../../components/auth/NotFound";
import ApplyField from "../../components/apply/ApplyField";
import { api } from "../../lib/api";
import { subdivisionLabel } from "../../data/applicationSeed";
import { formatDate } from "../../lib/format";
import {
  fieldVisible,
  isContentField,
  submissionTone,
  validateAnswers,
} from "../../lib/applicationConfig";

/**
 * Filling one in.
 *
 * Conditional fields are evaluated live, so a branch appears the moment its
 * trigger is answered. Validation runs on submit rather than on every keystroke
 * — an application is long, and a form that turns red while you are still
 * typing the first sentence of a paragraph answer is a form people abandon.
 *
 * The client validating at all is a courtesy: the server checks the same rules
 * against the stored document, and its answer is the one that counts.
 */
export default function ApplyForm() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ key: null, data: undefined });
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState(null);
  const topRef = useRef(null);

  useEffect(() => {
    let active = true;
    api
      .applyForm(slug)
      .then((data) => active && setState({ key: slug, data }))
      .catch(() => active && setState({ key: slug, data: null }));
    return () => {
      active = false;
    };
  }, [slug]);

  const loading = state.key !== slug;
  const payload = loading ? undefined : state.data;
  const app = payload?.application ?? null;

  const setAnswer = useCallback((fieldId, value) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => {
      if (!prev[fieldId]) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  // Recomputed from the answers each render, so a branch opens as soon as its
  // trigger is answered rather than on the next interaction.
  const sections = useMemo(() => {
    if (!app) return [];
    return app.sections
      .map((section) => ({
        ...section,
        fields: section.fields.filter((field) => fieldVisible(field, answers)),
      }))
      .filter((section) => section.fields.length > 0);
  }, [app, answers]);

  const answered = useMemo(() => {
    const asked = sections.flatMap((s) => s.fields).filter((f) => !isContentField(f.type));
    const done = asked.filter((f) => {
      const value = answers[f.id];
      return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== "" && value !== false;
    });
    return { done: done.length, total: asked.length };
  }, [sections, answers]);

  if (loading) {
    return (
      <Section className="max-w-3xl">
        <div className="space-y-4">
          <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="h-72 animate-pulse rounded-2xl bg-white/[0.03]" />
        </div>
      </Section>
    );
  }

  if (!payload || !app) return <NotFound />;

  const eligibility = payload.eligibility ?? { ok: false, reason: "This application is not open." };
  const history = payload.history ?? [];

  async function submit(event) {
    event.preventDefault();
    setFailure(null);

    const check = validateAnswers(app, answers);
    if (!check.ok) {
      setErrors(check.errors);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setSending(true);
    try {
      const result = await api.submitApply(app.slug, check.answers);
      if (result?.ok) {
        navigate(`/apply/${app.slug}/submitted`, {
          state: { reference: result.reference, message: result.message, title: app.title },
        });
        return;
      }
      setFailure(result?.message ?? "That did not go through. Nothing was submitted.");
    } catch (err) {
      // A 400 carries per-field errors; anything else is a message.
      if (err?.errors) {
        setErrors(err.errors);
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        setFailure(err?.message ?? "That did not go through. Nothing was submitted.");
      }
    } finally {
      setSending(false);
    }
  }

  const errorCount = Object.keys(errors).length;
  const subdivision = subdivisionLabel(app.departmentId, app.subdivisionId);

  return (
    <Section className="max-w-3xl">
      <div ref={topRef} />
      <Button as={Link} to="/apply" variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="size-4" />
        All applications
      </Button>

      <PageHeader
        eyebrow={subdivision ? `Subdivision · ${subdivision}` : "Application"}
        title={app.title}
        subtitle={app.summary}
      />

      {history.length > 0 && (
        <Card className="mb-6 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            You have applied before
          </p>
          <ul className="mt-3 space-y-2">
            {history.map((entry) => (
              <li key={entry.reference} className="flex flex-wrap items-center gap-3 text-sm">
                <Badge tone={submissionTone(entry.status)}>{entry.status}</Badge>
                <code className="text-xs text-slate-400">{entry.reference}</code>
                <span className="text-xs text-slate-500">
                  {formatDate(entry.decidedAt ?? entry.submittedAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!eligibility.ok ? (
        <Card className="p-8 text-center ring-1 ring-inset ring-amber-400/25">
          <AlertTriangle className="mx-auto size-7 text-amber-400" />
          <p className="mt-3 text-sm font-semibold text-white">You cannot submit this one yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-400">
            {eligibility.reason}
          </p>
        </Card>
      ) : (
        <form onSubmit={submit} noValidate>
          {(errorCount > 0 || failure) && (
            <Card className="mb-6 p-5 ring-1 ring-inset ring-rose-400/30">
              <p className="flex items-center gap-2 text-sm font-semibold text-rose-200">
                <AlertTriangle className="size-4" />
                {failure
                  ? "That did not go through"
                  : `${errorCount} answer${errorCount === 1 ? "" : "s"} need${errorCount === 1 ? "s" : ""} attention`}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {failure ?? "Nothing was submitted. The fields below are marked."}
              </p>
            </Card>
          )}

          <div className="space-y-6">
            {sections.map((section) => (
              <Card key={section.id} className="p-6">
                <h2 className="text-lg font-black tracking-tight text-white">{section.title}</h2>
                {section.description && (
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{section.description}</p>
                )}
                <div className="mt-5 space-y-5">
                  {section.fields.map((field) => (
                    <ApplyField
                      key={field.id}
                      field={field}
                      value={answers[field.id]}
                      error={errors[field.id]}
                      disabled={sending}
                      onChange={(value) => setAnswer(field.id, value)}
                    />
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#0a0e1a]/90 p-4 ring-1 ring-inset ring-white/[0.08] backdrop-blur-xl">
            <p className="text-xs text-slate-400">
              <span className="font-bold tabular-nums text-white">
                {answered.done}/{answered.total}
              </span>{" "}
              answered · you get a decision in Discord
            </p>
            <Button type="submit" disabled={sending}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {sending ? "Sending" : "Submit application"}
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}
