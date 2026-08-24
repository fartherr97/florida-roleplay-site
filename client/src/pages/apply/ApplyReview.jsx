import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import { TextArea } from "../../components/ui/TextInput";
import NotFound from "../../components/auth/NotFound";
import AccessDenied from "../../components/auth/AccessDenied";
import EmbedPreview from "../../components/apply/EmbedPreview";
import { api, ApiForbiddenError } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { subdivisionLabel } from "../../data/applicationSeed";
import { allFields, isContentField, submissionTone } from "../../lib/applicationConfig";

/**
 * One submission, and the decision on it.
 *
 * The questions come from the snapshot stored with the submission rather than
 * the live application, so somebody reading this in six months sees what was
 * actually asked — not what the form has since been edited into.
 *
 * Deciding here and pressing the button in Discord are the same transition on
 * the same row, so whichever happens first wins and the other is told so.
 */
export default function ApplyReview() {
  const { reference } = useParams();
  const [state, setState] = useState({ key: null, data: undefined, denied: false });
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    api
      .applicationSubmission(reference)
      .then((data) => active && setState({ key: reference, data, denied: false }))
      .catch((err) =>
        active &&
        setState({ key: reference, data: null, denied: err instanceof ApiForbiddenError }),
      );
    return () => {
      active = false;
    };
  }, [reference]);

  const loading = state.key !== reference;
  if (loading) {
    return (
      <Section className="max-w-3xl">
        <div className="h-96 animate-pulse rounded-2xl bg-white/[0.03]" />
      </Section>
    );
  }
  if (state.denied) return <AccessDenied reason="role" />;
  if (!state.data) return <NotFound />;

  const { submission, application } = state.data;
  const fields = allFields(application).filter((f) => !isContentField(f.type));
  const pending = submission.status === "pending";

  async function decide(decision) {
    setWorking(decision);
    setError(null);
    try {
      const result = await api.decideApplication(reference, decision, reason);
      if (result?.ok) {
        setState((prev) => ({ ...prev, data: { ...prev.data, submission: result.submission } }));
        setReason("");
      } else {
        setError(result?.message ?? "That decision was not recorded.");
        // Somebody decided it first — show what actually happened.
        if (result?.submission) {
          setState((prev) => ({ ...prev, data: { ...prev.data, submission: result.submission } }));
        }
      }
    } catch (err) {
      setError(err?.message ?? "That decision was not recorded.");
    } finally {
      setWorking(null);
    }
  }

  const subdivision = subdivisionLabel(application.departmentId, application.subdivisionId);

  return (
    <Section className="max-w-3xl">
      <Button as={Link} to="/apply/manage" variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="size-4" />
        Back to the queue
      </Button>

      <PageHeader
        eyebrow={subdivision ? `${application.title} · ${subdivision}` : application.title}
        title={submission.applicantName || "Unnamed applicant"}
        subtitle={`Submitted ${formatDateTime(submission.submittedAt)} · ${submission.reference}`}
        actions={<Badge tone={submissionTone(submission.status)}>{submission.status}</Badge>}
      />

      {!pending && (
        <Card className="mb-6 p-5">
          <p className="text-sm text-white">
            {submission.status === "approved" ? "Approved" : "Denied"}
            {submission.decidedByName ? ` by ${submission.decidedByName}` : ""}
            {submission.decidedVia ? ` in ${submission.decidedVia === "discord" ? "Discord" : "the site"}` : ""}
            {submission.decidedAt ? ` · ${formatDateTime(submission.decidedAt)}` : ""}
          </p>
          {submission.decisionReason && (
            <p className="mt-2 border-l-2 border-white/10 pl-3 text-sm leading-relaxed text-slate-400">
              {submission.decisionReason}
            </p>
          )}
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400">The answers</h2>
        <dl className="mt-4 space-y-5">
          {fields.map((field) => (
            <div key={field.id}>
              <dt className="text-sm font-semibold text-white">{field.label}</dt>
              <dd className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-slate-300">
                {renderAnswer(field, submission.answers?.[field.id])}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      {pending ? (
        <Card className="mt-6 p-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400">Decide</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">
            The same call the Approve and Deny buttons make in Discord. Whichever
            happens first is the one that stands.
          </p>
          <Field label="Reason" hint="Optional, but it goes into the Discord embed and the applicant sees it." className="mt-4">
            <TextArea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why, in a sentence."
            />
          </Field>
          {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => decide("approve")} disabled={Boolean(working)}>
              {working === "approve" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Approve
            </Button>
            <Button variant="danger" onClick={() => decide("deny")} disabled={Boolean(working)}>
              {working === "deny" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
              Deny
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="mt-6 p-6">
        <EmbedPreview application={application} />
      </Card>
    </Section>
  );
}

function renderAnswer(field, value) {
  if (value == null || value === "") return <span className="text-slate-600">No answer</span>;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (field.type === "scale") return `${value} out of ${field.max}`;
  return String(value);
}
