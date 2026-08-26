import { createElement, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, Loader2, Send } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import AccessDenied from "../../components/auth/AccessDenied";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { useSupportConfig } from "../../context/useSupportConfig";
import { iconFor } from "../../lib/icons";
import { toneTile } from "../../lib/tones";
import { cn } from "../../lib/cn";
import { validateTicket } from "../../lib/support";

/**
 * Opening a ticket.
 *
 * Picking the type first is what makes the rest of the form worth filling in:
 * a ban appeal asks where and when, a bug asks what you were doing. One box
 * labelled "describe your issue" just means every reply starts by chasing the
 * details the form could have asked for.
 */
export default function SupportNew() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { types: catalogue } = useSupportConfig();

  // The categories this member may open: enabled, and either open to everyone or
  // gated on a permission they hold. The server re-checks on submit.
  const types = useMemo(
    () =>
      catalogue.filter(
        (type) => type.enabled !== false && (!type.openPermission || hasPermission(type.openPermission)),
      ),
    [catalogue, hasPermission],
  );

  const [draft, setDraft] = useState({ type: "", subject: "", body: "", details: {} });
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [sending, setSending] = useState(false);

  const set = (patch) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setErrors({});
    setFailure(null);
  };

  if (!user) return <AccessDenied reason="signed-out" />;

  async function submit(event) {
    event.preventDefault();
    const check = validateTicket(draft, catalogue);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setSending(true);
    try {
      const result = await api.openSupportTicket(draft);
      if (result?.ok) {
        navigate(`/support/${result.ticket.id}`);
        return;
      }
      setFailure(result?.message ?? "That was not submitted.");
    } catch (err) {
      if (err?.errors) setErrors(err.errors);
      else setFailure(err?.message ?? "That was not submitted.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Section className="max-w-3xl">
      <Button as={Link} to="/support" variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="size-4" />
        Your tickets
      </Button>

      <PageHeader
        eyebrow="Support"
        title="Open a ticket"
        subtitle="Pick what it is about and we will route it to whoever handles that."
      />

      <form onSubmit={submit} noValidate>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          Who is this for?<span className="ml-1 text-brand-400">*</span>
        </p>

        {/* Each category is a row that expands in place to its own ticket form —
            click a department and its form opens right there. */}
        <div className="space-y-3">
          {types.map((entry) => {
            const expanded = draft.type === entry.id;
            return (
              <div
                key={entry.id}
                className={cn(
                  "overflow-hidden rounded-2xl ring-1 ring-inset transition",
                  expanded ? "bg-white/[0.05] ring-white/20" : "bg-black/20 ring-white/[0.06]",
                )}
              >
                <button
                  type="button"
                  onClick={() => set({ type: expanded ? "" : entry.id, details: {} })}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/[0.03]"
                >
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset", toneTile(entry.tone))}>
                    {createElement(iconFor(entry.icon), { className: "size-5" })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">{entry.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">{entry.blurb}</span>
                  </span>
                  <ChevronDown
                    className={cn("size-5 shrink-0 text-slate-400 transition-transform", expanded && "rotate-180")}
                  />
                </button>

                {expanded && (
                  <div className="space-y-5 border-t border-white/[0.06] p-5 sm:p-6">
                    <Field label="Subject" required hint={errors.subject}>
                      <TextInput
                        value={draft.subject}
                        onChange={(e) => set({ subject: e.target.value })}
                        placeholder="One line — what do you need?"
                      />
                    </Field>

                    {entry.fields.map((field) => (
                      <Field
                        key={field.id}
                        label={field.label}
                        required={field.required}
                        hint={errors[`details.${field.id}`] ?? field.help}
                      >
                        {field.type === "select" ? (
                          <Select
                            value={draft.details[field.id] ?? ""}
                            options={field.options}
                            placeholder="Choose one"
                            onChange={(value) => set({ details: { ...draft.details, [field.id]: value } })}
                          />
                        ) : field.type === "paragraph" ? (
                          <TextArea
                            rows={3}
                            value={draft.details[field.id] ?? ""}
                            onChange={(e) => set({ details: { ...draft.details, [field.id]: e.target.value } })}
                          />
                        ) : (
                          <TextInput
                            type={field.type === "date" ? "date" : "text"}
                            value={draft.details[field.id] ?? ""}
                            onChange={(e) => set({ details: { ...draft.details, [field.id]: e.target.value } })}
                            className={field.type === "date" ? "[color-scheme:dark]" : undefined}
                          />
                        )}
                      </Field>
                    ))}

                    <Field label="What is going on?" required hint={errors.body}>
                      <TextArea
                        rows={6}
                        value={draft.body}
                        onChange={(e) => set({ body: e.target.value })}
                        placeholder="Everything you think we should know. More detail means fewer questions back."
                      />
                    </Field>

                    {failure && <p className="text-sm text-rose-300">{failure}</p>}

                    <div className="flex justify-end">
                      <Button type="submit" disabled={sending}>
                        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                        Open ticket
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {errors.type && <p className="mt-3 text-xs text-rose-300">{errors.type}</p>}
        {types.length === 0 && (
          <p className="rounded-2xl bg-black/20 p-6 text-center text-sm text-slate-400 ring-1 ring-inset ring-white/[0.06]">
            There are no ticket categories open to you right now.
          </p>
        )}
      </form>
    </Section>
  );
}
