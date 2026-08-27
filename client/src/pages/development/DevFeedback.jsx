import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import AccessDenied from "../../components/auth/AccessDenied";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { FEEDBACK_TYPES, validateFeedback } from "../../lib/devhub";

/** Suggestions and bug reports for the dev team. */
export default function DevFeedback() {
  const { user, loading } = useAuth();
  const [draft, setDraft] = useState({ type: "suggestion", title: "", body: "" });
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const set = (patch) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setErrors({});
    setFailure(null);
  };

  if (loading) return null;
  if (!user) return <AccessDenied reason="signed-out" />;

  async function submit(event) {
    event.preventDefault();
    const check = validateFeedback(draft);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setSending(true);
    const result = await api.submitDevFeedback(draft);
    setSending(false);
    if (result?.ok) setDone(true);
    else setFailure(result?.message ?? "That was not submitted.");
  }

  return (
    <Section className="max-w-2xl">
      <PageHeader
        eyebrow="Development"
        title="Suggestions & bug reports"
        subtitle="Tell the dev team what to build next, or what's broken."
      />

      {done ? (
        <Card className="p-10 text-center">
          <CheckCircle2 className="mx-auto size-8 text-emerald-400" />
          <p className="mt-3 text-base font-bold text-white">Thanks — that's been sent to the dev team.</p>
          <Button className="mt-5" variant="secondary" onClick={() => {
            setDraft({ type: "suggestion", title: "", body: "" });
            setDone(false);
          }}>
            Submit another
          </Button>
        </Card>
      ) : (
        <Card as="form" onSubmit={submit} className="space-y-5 p-6">
          <Field label="Type">
            <Select value={draft.type} options={FEEDBACK_TYPES.map((t) => ({ value: t.id, label: t.label }))} onChange={(type) => set({ type })} />
          </Field>
          <Field label="Title" required hint={errors.title}>
            <TextInput value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="One line" />
          </Field>
          <Field label="Details" required hint={errors.body}>
            <TextArea rows={6} value={draft.body} onChange={(e) => set({ body: e.target.value })} placeholder="What's the idea, or what went wrong and how to reproduce it?" />
          </Field>
          {failure && <p className="text-sm text-rose-300">{failure}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={sending}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Submit
            </Button>
          </div>
        </Card>
      )}
    </Section>
  );
}
