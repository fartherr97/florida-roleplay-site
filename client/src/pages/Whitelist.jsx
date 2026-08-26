import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import Section from "../components/layout/Section";
import PageHeader from "../components/layout/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Field from "../components/ui/Field";
import Select from "../components/ui/Select";
import { TextArea, TextInput } from "../components/ui/TextInput";
import AccessDenied from "../components/auth/AccessDenied";
import { api } from "../lib/api";
import { useAuth } from "../context/useAuth";

/**
 * The soft whitelist. A prospective player answers a few quick questions; the
 * submission is posted to a staff Discord channel with Approve / Deny buttons,
 * and approval assigns the whitelist role so they can join the game server.
 *
 * The questions are fixed here — a short, low-friction gate. To change them,
 * edit QUESTIONS; the answers are sent as question/answer pairs, so nothing else
 * needs to change.
 */
const QUESTIONS = [
  { id: "age", label: "How old are you?", type: "select", options: ["13+", "16+", "18+"], required: true },
  { id: "found", label: "How did you find us?", type: "short", required: true, placeholder: "A Discord listing, a friend, TikTok…" },
  { id: "experience", label: "Do you have roleplay experience? Tell us briefly.", type: "paragraph", required: true },
  { id: "failrp", label: "In your own words, what is Fail RP (Fail Roleplay)?", type: "paragraph", required: true },
  { id: "rdmvdm", label: "What are RDM and VDM?", type: "paragraph", required: true },
  {
    id: "rules",
    label: "Have you read and agree to the server rules?",
    type: "select",
    options: ["Yes, I have read and agree"],
    required: true,
  },
];

export default function Whitelist() {
  const { user } = useAuth();
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  if (!user) return <AccessDenied reason="signed-out" />;

  const set = (id, value) => {
    setValues((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => ({ ...prev, [id]: undefined }));
    setFailure(null);
  };

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    for (const q of QUESTIONS) {
      if (q.required && !String(values[q.id] ?? "").trim()) nextErrors[q.id] = "This one is required.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const answers = QUESTIONS.map((q) => ({ question: q.label, answer: String(values[q.id] ?? "").trim() })).filter(
      (a) => a.answer,
    );

    setSending(true);
    setFailure(null);
    try {
      const result = await api.submitWhitelist(answers);
      if (result?.ok) {
        setDone(true);
        return;
      }
      setFailure(result?.message ?? "That was not submitted. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <Section className="max-w-2xl">
        <Card className="p-10 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-400" />
          <h1 className="mt-4 text-xl font-bold text-white">Application submitted</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
            Our staff team will review it shortly. When you are approved you will get the
            Whitelisted role in Discord and can join the server. Keep an eye on your DMs.
          </p>
          <Button as="a" href="/" variant="secondary" size="sm" className="mt-6">
            Back to home
          </Button>
        </Card>
      </Section>
    );
  }

  return (
    <Section className="max-w-2xl">
      <PageHeader
        eyebrow="Join the server"
        title="Whitelist application"
        subtitle="A few quick questions. Answer honestly — staff review every one, and approval gets you onto the server."
      />

      <form onSubmit={submit} noValidate>
        <Card className="space-y-5 p-6">
          {QUESTIONS.map((q) => (
            <Field key={q.id} label={q.label} required={q.required} hint={errors[q.id]}>
              {q.type === "select" ? (
                <Select
                  value={values[q.id] ?? ""}
                  options={q.options}
                  placeholder="Choose one"
                  onChange={(value) => set(q.id, value)}
                />
              ) : q.type === "paragraph" ? (
                <TextArea
                  rows={3}
                  value={values[q.id] ?? ""}
                  onChange={(e) => set(q.id, e.target.value)}
                />
              ) : (
                <TextInput
                  value={values[q.id] ?? ""}
                  placeholder={q.placeholder}
                  onChange={(e) => set(q.id, e.target.value)}
                />
              )}
            </Field>
          ))}

          {failure && <p className="text-sm text-rose-300">{failure}</p>}

          <div className="flex justify-end">
            <Button type="submit" disabled={sending}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Submit application
            </Button>
          </div>
        </Card>
      </form>
    </Section>
  );
}
