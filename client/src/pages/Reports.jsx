import { useState } from "react";
import { Link } from "react-router-dom";
import { Send } from "lucide-react";
import Section from "../components/layout/Section";
import PageHeader from "../components/layout/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Field from "../components/ui/Field";
import Select from "../components/ui/Select";
import Modal from "../components/ui/Modal";
import { TextArea, TextInput } from "../components/ui/TextInput";
import { api } from "../lib/api";
import { reportTypes } from "../data/mockData";

/** Validation mirrored by the server — the server's copy is authoritative. */
function validate(form) {
  const errors = {};
  if (!form.type) errors.type = "Choose what you are reporting.";
  if (!/^\d{17,20}$/.test(form.discordId.trim()))
    errors.discordId = "Enter your 17–20 digit Discord user ID.";
  if (form.involved.trim().length < 2)
    errors.involved = "Name at least one person involved.";
  if (form.description.trim().length < 60)
    errors.description = "Give us at least 60 characters of detail.";
  return errors;
}

/** Report and complaint submission, returning a trackable reference id. */
export default function Reports() {
  const [form, setForm] = useState({
    type: "",
    discordId: "",
    involved: "",
    occurredAt: "",
    evidence: "",
    description: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState(null);

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const onInput = (key) => (e) => set(key)(e.target.value);

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const result = await api.submitReport(form);
      setReference(result.id);
      setForm({
        type: "",
        discordId: "",
        involved: "",
        occurredAt: "",
        evidence: "",
        description: "",
      });
    } catch (err) {
      setErrors({ form: (err.errors ?? [err.message]).join(" ") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Section>
      <PageHeader
        eyebrow="Support"
        title="Reports & Complaints"
        subtitle="Rule breaks, staff complaints and ban appeals all start here. Reports filed in Discord DMs are not tracked."
      />

      <form onSubmit={submit} className="space-y-6">
        <Card className="space-y-6 p-6">
          <Field label="What are you reporting?" htmlFor="type" required hint={errors.type}>
            <Select
              id="type"
              value={form.type}
              onChange={set("type")}
              options={reportTypes}
              placeholder="Select a report type"
            />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="Your Discord user ID"
              htmlFor="discordId"
              required
              hint={errors.discordId}
            >
              <TextInput
                id="discordId"
                inputMode="numeric"
                value={form.discordId}
                onChange={onInput("discordId")}
                placeholder="198273645500000000"
              />
            </Field>
            <Field
              label="When did it happen?"
              htmlFor="occurredAt"
              hint="Approximate date and time helps us search the server logs."
            >
              <TextInput
                id="occurredAt"
                value={form.occurredAt}
                onChange={onInput("occurredAt")}
                placeholder="2026-08-22, around 9:30 PM EST"
              />
            </Field>
          </div>

          <Field
            label="Who was involved?"
            htmlFor="involved"
            required
            hint={errors.involved || "Character or Discord names, comma separated."}
          >
            <TextInput
              id="involved"
              value={form.involved}
              onChange={onInput("involved")}
              placeholder="Elena Marquez, Trooper R. Hall"
            />
          </Field>

          <Field
            label="Evidence links"
            htmlFor="evidence"
            hint="Medal, YouTube or Streamable links. 30–60 seconds around the incident is ideal."
          >
            <TextArea
              id="evidence"
              rows={3}
              value={form.evidence}
              onChange={onInput("evidence")}
              placeholder="https://medal.tv/…"
            />
          </Field>

          <Field
            label="What happened?"
            htmlFor="description"
            required
            hint={
              errors.description ||
              `${form.description.trim().length}/60 characters minimum.`
            }
          >
            <TextArea
              id="description"
              rows={7}
              value={form.description}
              onChange={onInput("description")}
              placeholder="Describe the incident in order, with as much detail as you can remember."
            />
          </Field>

          {errors.form && <p className="text-xs text-rose-400">{errors.form}</p>}
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            <Send className="size-4" />
            {submitting ? "Submitting…" : "Submit report"}
          </Button>
        </div>
      </form>

      <Modal
        open={Boolean(reference)}
        onClose={() => setReference(null)}
        title="Report submitted"
        subtitle="Our staff team reviews reports within 48 hours."
      >
        <p className="text-sm leading-relaxed text-slate-400">
          Thanks — your report is in the queue. Appeals are always handled by a
          different staff member than the one who issued the original sanction.
        </p>
        <div className="mt-5 rounded-2xl bg-black/30 p-4 text-center ring-1 ring-inset ring-white/10">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Reference id
          </p>
          <p className="mt-1.5 text-xl font-bold tracking-tight text-primary-400">
            {reference}
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button as={Link} to="/knowledge-base/reporting-a-player" variant="secondary">
            How reports work
          </Button>
          <Button as={Link} to="/">
            Back home
          </Button>
        </div>
      </Modal>
    </Section>
  );
}
