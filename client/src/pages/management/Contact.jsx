import { useState } from "react";
import { Link } from "react-router-dom";
import { Send } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import { api } from "../../lib/api";

const TOPICS = [
  { value: "partnership", label: "Partnership or content creator enquiry" },
  { value: "escalation", label: "Escalate a staff decision" },
  { value: "media", label: "Press or media request" },
  { value: "other", label: "Something else" },
];

/**
 * Contact form for management. Public — reaching leadership should not require a
 * role, unlike the rest of the Management group.
 */
export default function Contact() {
  const [form, setForm] = useState({
    topic: "",
    discordId: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState(null);

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const onInput = (key) => (e) => set(key)(e.target.value);

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (!form.topic) found.topic = "Choose a topic.";
    if (!/^\d{17,20}$/.test(form.discordId.trim()))
      found.discordId = "Enter your 17–20 digit Discord user ID.";
    if (form.subject.trim().length < 4) found.subject = "Add a short subject line.";
    if (form.message.trim().length < 60)
      found.message = "Give us at least 60 characters of detail.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      // Management enquiries ride the report pipeline so they land in the same queue.
      const result = await api.submitReport({
        type: "other",
        discordId: form.discordId,
        involved: "Management",
        occurredAt: "",
        evidence: "",
        description: `[${form.topic}] ${form.subject}\n\n${form.message}`,
      });
      setReference(result.id);
      setForm({ topic: "", discordId: "", subject: "", message: "" });
    } catch (err) {
      setErrors({ form: (err.errors ?? [err.message]).join(" ") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Section className="max-w-3xl">
      <PageHeader
        eyebrow="Management"
        title="Contact Management"
        subtitle="For partnerships, press and escalations that the staff team cannot resolve. Everyday support belongs in a ticket."
      />

      <form onSubmit={submit} className="space-y-6">
        <Card className="space-y-6 p-6">
          <Field label="Topic" htmlFor="topic" required hint={errors.topic}>
            <Select
              id="topic"
              value={form.topic}
              onChange={set("topic")}
              options={TOPICS}
              placeholder="What is this about?"
            />
          </Field>

          <Field
            label="Your Discord user ID"
            htmlFor="contactDiscordId"
            required
            hint={errors.discordId}
          >
            <TextInput
              id="contactDiscordId"
              inputMode="numeric"
              value={form.discordId}
              onChange={onInput("discordId")}
              placeholder="198273645500000000"
            />
          </Field>

          <Field label="Subject" htmlFor="subject" required hint={errors.subject}>
            <TextInput
              id="subject"
              value={form.subject}
              onChange={onInput("subject")}
              placeholder="Content creator partnership"
            />
          </Field>

          <Field
            label="Message"
            htmlFor="message"
            required
            hint={errors.message || `${form.message.trim().length}/60 characters minimum.`}
          >
            <TextArea
              id="message"
              rows={7}
              value={form.message}
              onChange={onInput("message")}
              placeholder="Tell us what you need."
            />
          </Field>

          {errors.form && <p className="text-xs text-rose-400">{errors.form}</p>}
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            Need help with the server or your account?{" "}
            <Link to="/support" className="font-semibold text-primary-400 hover:underline">
              Open a support ticket
            </Link>
            .
          </p>
          <Button type="submit" disabled={submitting}>
            <Send className="size-4" />
            {submitting ? "Sending…" : "Send message"}
          </Button>
        </div>
      </form>

      <Modal
        open={Boolean(reference)}
        onClose={() => setReference(null)}
        title="Message sent"
        subtitle="Management replies within a few business days."
      >
        <p className="text-sm leading-relaxed text-slate-400">
          Thanks for reaching out. Keep the reference below if you need to follow
          up in Discord.
        </p>
        <div className="mt-5 rounded-2xl bg-black/30 p-4 text-center ring-1 ring-inset ring-white/10">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Reference id
          </p>
          <p className="mt-1.5 text-xl font-bold tracking-tight text-primary-400">
            {reference}
          </p>
        </div>
        <div className="mt-6 flex justify-end">
          <Button as={Link} to="/">
            Back home
          </Button>
        </div>
      </Modal>
    </Section>
  );
}
