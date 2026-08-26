import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Send } from "lucide-react";
import Section from "../components/layout/Section";
import PageHeader from "../components/layout/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Field from "../components/ui/Field";
import Select from "../components/ui/Select";
import Modal from "../components/ui/Modal";
import { TextArea, TextInput } from "../components/ui/TextInput";
import NotFound from "../components/auth/NotFound";
import { api } from "../lib/api";
import { applicationTypes } from "../data/mockData";
import { cn } from "../lib/cn";

const AGE_OPTIONS = ["16–17", "18–20", "21–24", "25–29", "30–39", "40+"];
const EXPERIENCE_OPTIONS = [
  { value: "none", label: "This would be my first server" },
  { value: "under-6m", label: "Less than 6 months" },
  { value: "6m-2y", label: "6 months – 2 years" },
  { value: "over-2y", label: "More than 2 years" },
];

const STEPS = ["About you", "Your character", "Scenario"];

/** Field-level validation. Mirrored by the server — never trusted on its own. */
function validate(form, step) {
  const errors = {};
  if (step === 0) {
    if (!/^\d{17,20}$/.test(form.discordId.trim()))
      errors.discordId = "Enter your 17–20 digit Discord user ID.";
    if (form.discordName.trim().length < 2)
      errors.discordName = "Enter your Discord username.";
    if (!form.age) errors.age = "Select your age range.";
    if (!form.experience) errors.experience = "Select your roleplay experience.";
  }
  if (step === 1) {
    if (form.characterName.trim().length < 3)
      errors.characterName = "Give your character a full name.";
    if (form.backstory.trim().length < 120)
      errors.backstory = "Write at least 120 characters of backstory.";
  }
  if (step === 2) {
    if (form.scenario.trim().length < 120)
      errors.scenario = "Write at least 120 characters.";
    if (!form.agreed) errors.agreed = "You must confirm you have read the rules.";
  }
  return errors;
}

/**
 * The application form itself — three grouped steps, client-side validation and
 * a success modal returning the reference id the applicant tracks status with.
 */
export default function ApplicationForm() {
  const { type } = useParams();
  const definition = useMemo(
    () => applicationTypes.find((t) => t.type === type),
    [type],
  );

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState(null);
  const [form, setForm] = useState({
    discordId: "",
    discordName: "",
    age: "",
    experience: "",
    characterName: "",
    backstory: "",
    scenario: "",
    agreed: false,
  });

  if (!definition) return <NotFound />;

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const onInput = (key) => (e) => set(key)(e.target.value);

  const next = () => {
    const found = validate(form, step);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep((s) => Math.min(s + 1, 2));
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(form, 2);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const result = await api.submitApplication({ type, ...form });
      setReference(result.id);
    } catch (err) {
      // Server-side validation is authoritative — surface whatever it rejected.
      const list = err.errors ?? [err.message];
      setErrors({ form: list.join(" ") });
    } finally {
      setSubmitting(false);
    }
  };

  const closed = definition.status !== "Open";

  return (
    <Section>
      <PageHeader
        eyebrow={definition.status === "Open" ? "Now accepting" : "Currently closed"}
        title={definition.name}
        subtitle={definition.blurb}
        backTo="/applications"
        backLabel="All applications"
        actions={
          <Badge tone={closed ? "rose" : "green"} dot>
            {definition.status}
          </Badge>
        }
      />

      {closed ? (
        <Card className="p-8 text-center">
          <h2 className="text-lg font-bold text-white">
            This application isn't open right now
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-slate-400">
            {definition.name} opens periodically. Watch the announcements channel
            in Discord, or check the events page for the next recruitment window.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button as={Link} to="/applications" variant="secondary">
              Other applications
            </Button>
            <Button as={Link} to="/events">
              See events
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Step indicator */}
          <ol className="mb-8 flex flex-wrap items-center gap-3">
            {STEPS.map((label, index) => {
              const done = index < step;
              const active = index === step;
              return (
                <li key={label} className="flex items-center gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "grid size-7 place-items-center rounded-full text-[11px] font-bold ring-1 ring-inset transition",
                        done && "bg-primary-500 text-white ring-primary-400/40",
                        active && !done && "bg-primary-500/15 text-primary-300 ring-primary-400/30",
                        !done && !active && "bg-white/[0.03] text-slate-500 ring-white/10",
                      )}
                    >
                      {done ? <Check className="size-3.5" /> : index + 1}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-bold uppercase tracking-[0.14em]",
                        active ? "text-white" : "text-slate-500",
                      )}
                    >
                      {label}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <span className="hidden h-px w-8 bg-white/10 sm:block" />
                  )}
                </li>
              );
            })}
          </ol>

          <form onSubmit={submit} className="space-y-6">
            {step === 0 && (
              <Card className="space-y-6 p-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field
                    label="Discord user ID"
                    htmlFor="discordId"
                    required
                    hint={errors.discordId || "Enable Developer Mode in Discord, then right-click your name → Copy User ID."}
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
                    label="Discord username"
                    htmlFor="discordName"
                    required
                    hint={errors.discordName}
                  >
                    <TextInput
                      id="discordName"
                      value={form.discordName}
                      onChange={onInput("discordName")}
                      placeholder="yourname"
                    />
                  </Field>
                  <Field label="Age range" htmlFor="age" required hint={errors.age}>
                    <Select
                      id="age"
                      value={form.age}
                      onChange={set("age")}
                      options={AGE_OPTIONS}
                      placeholder="Select your age range"
                    />
                  </Field>
                  <Field
                    label="Roleplay experience"
                    htmlFor="experience"
                    required
                    hint={errors.experience}
                  >
                    <Select
                      id="experience"
                      value={form.experience}
                      onChange={set("experience")}
                      options={EXPERIENCE_OPTIONS}
                      placeholder="How long have you roleplayed?"
                    />
                  </Field>
                </div>
              </Card>
            )}

            {step === 1 && (
              <Card className="space-y-6 p-6">
                <Field
                  label="Character name"
                  htmlFor="characterName"
                  required
                  hint={errors.characterName}
                >
                  <TextInput
                    id="characterName"
                    value={form.characterName}
                    onChange={onInput("characterName")}
                    placeholder="Elena Marquez"
                  />
                </Field>
                <Field
                  label="Character backstory"
                  htmlFor="backstory"
                  required
                  hint={
                    errors.backstory ||
                    `Who are they, why are they in Florida, what do they want? ${form.backstory.trim().length}/120 characters minimum.`
                  }
                >
                  <TextArea
                    id="backstory"
                    rows={8}
                    value={form.backstory}
                    onChange={onInput("backstory")}
                    placeholder="Elena moved to Miami after…"
                  />
                </Field>
              </Card>
            )}

            {step === 2 && (
              <Card className="space-y-6 p-6">
                <Field
                  label="Scenario response"
                  htmlFor="scenario"
                  required
                  hint={
                    errors.scenario ||
                    `${form.scenario.trim().length}/120 characters minimum.`
                  }
                >
                  <p className="mb-3 rounded-2xl bg-black/20 p-4 text-sm leading-relaxed text-slate-400 ring-1 ring-inset ring-white/[0.06]">
                    Your character is pulled over on the interstate. The trooper
                    finds an unregistered firearm under the seat that your
                    character did not know was there. Write how the next few
                    minutes play out, in character.
                  </p>
                  <TextArea
                    id="scenario"
                    rows={8}
                    value={form.scenario}
                    onChange={onInput("scenario")}
                    placeholder="Elena's hands stay on the wheel…"
                  />
                </Field>

                <label
                  htmlFor="agreed"
                  className="flex items-start gap-3 rounded-2xl bg-black/20 p-4 ring-1 ring-inset ring-white/[0.06]"
                >
                  <input
                    id="agreed"
                    type="checkbox"
                    checked={form.agreed}
                    onChange={(e) => set("agreed")(e.target.checked)}
                    className="mt-0.5 size-4 accent-[#f2800d]"
                  />
                  <span className="text-sm text-slate-300">
                    I have read the{" "}
                    <Link to="/rules" className="font-semibold text-primary-400 hover:underline">
                      server rules
                    </Link>{" "}
                    in full and understand they are enforced.
                  </span>
                </label>
                {errors.agreed && (
                  <p className="text-xs text-rose-400">{errors.agreed}</p>
                )}
                {errors.form && <p className="text-xs text-rose-400">{errors.form}</p>}
              </Card>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep((s) => Math.max(s - 1, 0))}
                disabled={step === 0}
              >
                Back
              </Button>
              {step < 2 ? (
                <Button type="button" onClick={next}>
                  Continue
                </Button>
              ) : (
                <Button type="submit" disabled={submitting}>
                  <Send className="size-4" />
                  {submitting ? "Submitting…" : "Submit application"}
                </Button>
              )}
            </div>
          </form>
        </>
      )}

      <Modal
        open={Boolean(reference)}
        onClose={() => setReference(null)}
        title="Application submitted"
        subtitle="Keep this reference — you'll need it to check status."
      >
        <p className="text-sm leading-relaxed text-slate-400">
          Thanks for applying to {definition.name}. Our team reviews applications
          in roughly {definition.estimate}, and the outcome arrives as a Discord
          direct message.
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
          <Button as={Link} to="/applications" variant="secondary">
            All applications
          </Button>
          <Button as={Link} to="/">
            Back home
          </Button>
        </div>
      </Modal>
    </Section>
  );
}
