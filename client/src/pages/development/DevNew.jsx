import { createElement, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, Loader2, Send, Wrench } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import AccessDenied from "../../components/auth/AccessDenied";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { iconFor } from "../../lib/icons";
import { toneTile } from "../../lib/tones";
import { cn } from "../../lib/cn";
import { DEFAULT_REQUEST_TYPES, validateRequest } from "../../lib/devhub";

/**
 * Opening a development request.
 *
 * Pick the category first — a LEO personal vehicle asks for the department and
 * liveries, a dev request asks for a scope — then fill in the form that expands
 * in place. Deep-linked from the landing with ?type=<id>.
 */
export default function DevNew() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, hasPermission, loading } = useAuth();
  const [catalogue, setCatalogue] = useState(DEFAULT_REQUEST_TYPES);

  useEffect(() => {
    let active = true;
    api.devRequestTypes().then((r) => active && r?.types?.length && setCatalogue(r.types)).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const types = useMemo(
    () => catalogue.filter((t) => t.enabled !== false && (!t.openPermission || hasPermission(t.openPermission))),
    [catalogue, hasPermission],
  );

  // Deep-linked from the landing with ?type=<id>; if it names a category the
  // member cannot open, no row expands and they simply pick another.
  const [draft, setDraft] = useState(() => ({ type: params.get("type") ?? "", subject: "", body: "", details: {} }));
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [sending, setSending] = useState(false);

  const set = (patch) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setErrors({});
    setFailure(null);
  };

  if (loading) return null;
  if (!user) return <AccessDenied reason="signed-out" />;

  async function submit(event) {
    event.preventDefault();
    const check = validateRequest(draft, catalogue);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setSending(true);
    try {
      const result = await api.openDevRequest(draft);
      if (result?.ok) {
        navigate(`/development/requests/${result.request.id}`);
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
      <Button as={Link} to="/development" variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="size-4" />
        Development Hub
      </Button>

      <PageHeader
        eyebrow="Development"
        title="Create a request"
        subtitle="Pick what it is for and we'll route it to the dev team. Don't buy anything until we approve it."
      />

      <form onSubmit={submit} noValidate>
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
                    {createElement(iconFor(entry.icon, Wrench), { className: "size-5" })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">{entry.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">{entry.blurb}</span>
                  </span>
                  <ChevronDown className={cn("size-5 shrink-0 text-slate-400 transition-transform", expanded && "rotate-180")} />
                </button>

                {expanded && (
                  <div className="space-y-5 border-t border-white/[0.06] p-5 sm:p-6">
                    <Field label="Title" required hint={errors.subject}>
                      <TextInput
                        value={draft.subject}
                        onChange={(e) => set({ subject: e.target.value })}
                        placeholder="One line — what is this request?"
                      />
                    </Field>

                    {entry.fields.map((field) => (
                      <Field key={field.id} label={field.label} required={field.required} hint={errors[`details.${field.id}`] ?? field.help}>
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
                            value={draft.details[field.id] ?? ""}
                            onChange={(e) => set({ details: { ...draft.details, [field.id]: e.target.value } })}
                          />
                        )}
                      </Field>
                    ))}

                    <Field label="Anything else?" required hint={errors.body}>
                      <TextArea
                        rows={5}
                        value={draft.body}
                        onChange={(e) => set({ body: e.target.value })}
                        placeholder="Everything the dev team should know. More detail means fewer questions back."
                      />
                    </Field>

                    {failure && <p className="text-sm text-rose-300">{failure}</p>}

                    <div className="flex justify-end">
                      <Button type="submit" disabled={sending}>
                        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                        Submit request
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
            There are no request categories open to you right now.
          </p>
        )}
      </form>
    </Section>
  );
}
