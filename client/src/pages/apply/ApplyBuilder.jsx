import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, Loader2, Plus, Trash2 } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import AccessDenied from "../../components/auth/AccessDenied";
import FieldEditor from "../../components/apply/FieldEditor";
import EmbedPreview from "../../components/apply/EmbedPreview";
import RoleIdInput from "../../components/apply/RoleIdInput";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { DEPARTMENTS } from "../../data/rosterData";
import { subdivisionsFor } from "../../data/applicationSeed";
import { BASE_ROLES } from "../../data/permissions";
import { ROLE_MAP } from "../../data/rosterData";
import {
  allFields,
  blankApplication,
  blankField,
  blankSection,
  canManageApplications,
  normalizeApplication,
  slugify,
  validateApplication,
} from "../../lib/applicationConfig";

const TABS = [
  { id: "basics", label: "Basics" },
  { id: "fields", label: "Questions" },
  { id: "discord", label: "Discord" },
  { id: "access", label: "Who can apply" },
  { id: "outcome", label: "Replies" },
];

const TONES = ["brand", "primary", "green", "amber", "rose", "slate"];

/**
 * The builder.
 *
 * Changes are held locally and saved on a button rather than as you type. That
 * is the opposite of the department Builder Portal, deliberately: this document
 * decides where real applications get routed and who can approve them, so a
 * half-finished edit reaching the live form would send somebody's application to
 * the wrong channel. Nothing here takes effect until Save.
 */
export default function ApplyBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();

  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(null);
  const [tab, setTab] = useState("basics");
  const [expanded, setExpanded] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const ctx = useMemo(
    () => ({
      roleKeys: user?.roles ?? [],
      permissions: new Set(hasPermission("applications.manage") ? ["applications.manage"] : []),
    }),
    [user, hasPermission],
  );

  const myDepartments = useMemo(
    () => DEPARTMENTS.filter((d) => canManageApplications(d.id, ctx)),
    [ctx],
  );

  useEffect(() => {
    let active = true;
    if (id === "new") {
      const fresh = normalizeApplication(
        blankApplication({ departmentId: myDepartments[0]?.id ?? "" }),
      );
      if (active) {
        setDraft(fresh);
        setSaved(null);
      }
      return () => {
        active = false;
      };
    }
    api.manageableApplications().then((result) => {
      if (!active) return;
      const found = (result.applications ?? []).find((a) => a.id === id) ?? null;
      setDraft(found ? normalizeApplication(found) : null);
      setSaved(found ? JSON.stringify(normalizeApplication(found)) : null);
    });
    return () => {
      active = false;
    };
    // myDepartments is only read on the "new" branch, where it is stable by then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const update = useCallback((patch) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setStatus(null);
  }, []);

  const problems = useMemo(() => (draft ? validateApplication(draft) : []), [draft]);
  const blocking = problems.filter((p) => p.level === "error");
  const dirty = draft ? JSON.stringify(draft) !== saved : false;

  if (myDepartments.length === 0) return <AccessDenied reason="role" />;
  if (draft === null) {
    return (
      <Section className="max-w-5xl">
        <div className="h-96 animate-pulse rounded-2xl bg-white/[0.03]" />
      </Section>
    );
  }

  async function save(nextStatus) {
    const next = nextStatus ? { ...draft, status: nextStatus } : draft;
    setSaving(true);
    setStatus(null);
    try {
      const result = await api.saveApplication(next.id, next);
      if (result?.ok) {
        const stored = normalizeApplication(result.application ?? next);
        setDraft(stored);
        setSaved(JSON.stringify(stored));
        setStatus({ tone: "green", message: result.message ?? "Saved." });
        if (id === "new") navigate(`/apply/manage/${stored.id}`, { replace: true });
      } else {
        setStatus({ tone: "rose", message: result?.message ?? "That did not save." });
      }
    } catch (err) {
      setStatus({ tone: "rose", message: err?.message ?? "That did not save." });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setConfirmDelete(false);
    const result = await api.deleteApplication(draft.id);
    if (result?.ok) navigate("/apply/manage");
    else setStatus({ tone: "rose", message: result?.message ?? "That did not delete." });
  }

  return (
    <Section className="max-w-5xl">
      <Button as={Link} to="/apply/manage" variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="size-4" />
        All applications
      </Button>

      <PageHeader
        eyebrow="Application builder"
        title={draft.title || "New application"}
        subtitle="Everything an applicant sees, and everything Discord receives when they submit."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={draft.status === "open" ? "green" : draft.status === "closed" ? "rose" : "slate"}>
              {draft.status}
            </Badge>
            {dirty && <Badge tone="amber" dot>Unsaved</Badge>}
          </div>
        }
      />

      {status && (
        <Card className={`mb-5 p-4 ring-1 ring-inset ${status.tone === "green" ? "ring-emerald-400/30" : "ring-rose-400/30"}`}>
          <p className={`text-sm ${status.tone === "green" ? "text-emerald-200" : "text-rose-200"}`}>
            {status.message}
          </p>
        </Card>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((entry) => {
          const count = problems.filter((p) => p.tab === entry.id && p.level === "error").length;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 ring-inset transition ${
                tab === entry.id
                  ? "bg-brand-500/15 text-white ring-brand-400/40"
                  : "bg-black/20 text-slate-400 ring-white/[0.06] hover:text-white"
              }`}
            >
              {entry.label}
              {count > 0 && <span className="ml-2 text-rose-300">{count}</span>}
            </button>
          );
        })}
      </div>

      {tab === "basics" && <BasicsTab draft={draft} update={update} departments={myDepartments} />}
      {tab === "fields" && (
        <FieldsTab draft={draft} update={update} expanded={expanded} setExpanded={setExpanded} />
      )}
      {tab === "discord" && <DiscordTab draft={draft} update={update} />}
      {tab === "access" && <AccessTab draft={draft} update={update} />}
      {tab === "outcome" && <OutcomeTab draft={draft} update={update} />}

      {problems.length > 0 && (
        <Card className="mt-6 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <AlertTriangle className="size-4 text-amber-400" />
            Before this goes live
          </p>
          <ul className="mt-3 space-y-1.5">
            {problems.map((problem, index) => (
              <li key={index} className="flex gap-2 text-sm">
                <span className={problem.level === "error" ? "text-rose-400" : "text-amber-400"}>
                  {problem.level === "error" ? "✕" : "!"}
                </span>
                <span className="text-slate-300">{problem.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0a0e1a]/90 p-4 ring-1 ring-inset ring-white/[0.08] backdrop-blur-xl">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save()} disabled={saving || !dirty}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Save
          </Button>
          {draft.status !== "open" ? (
            <Button variant="secondary" onClick={() => save("open")} disabled={saving || blocking.length > 0}>
              Publish
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => save("closed")} disabled={saving}>
              Stop accepting
            </Button>
          )}
        </div>
        {id !== "new" && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" />
            Delete
          </Button>
        )}
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this application?">
        <p className="text-sm leading-relaxed text-slate-300">
          The form comes down and nobody can submit it again. Submissions already
          made are kept — each one stored its own copy of the questions, so they
          stay readable.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep it</Button>
          <Button variant="danger" onClick={remove}>Delete</Button>
        </div>
      </Modal>
    </Section>
  );
}

/* ------------------------------------------------------------------ *
 * Tabs
 * ------------------------------------------------------------------ */

function BasicsTab({ draft, update, departments }) {
  const subdivisions = subdivisionsFor(draft.departmentId);
  return (
    <Card className="space-y-5 p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Title" hint="What applicants see in the list.">
          <TextInput
            value={draft.title}
            onChange={(e) =>
              update({
                title: e.target.value,
                // The address tracks the title until it has been saved once,
                // then stops — changing it later would break every link to it.
                slug: draft.status === "draft" ? slugify(e.target.value) : draft.slug,
              })
            }
            placeholder="FHP — Trooper"
          />
        </Field>
        <Field label="Web address" hint={`floridarp.com/apply/${draft.slug || "…"}`}>
          <TextInput value={draft.slug} onChange={(e) => update({ slug: slugify(e.target.value) })} />
        </Field>
      </div>

      <Field label="Summary" hint="One or two sentences on the card.">
        <TextArea rows={3} value={draft.summary} onChange={(e) => update({ summary: e.target.value })} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Department">
          <Select
            value={draft.departmentId}
            options={departments.map((d) => ({ value: d.id, label: d.label }))}
            placeholder="Pick one"
            onChange={(departmentId) => update({ departmentId, subdivisionId: "" })}
          />
        </Field>
        <Field label="Subdivision" hint="Leave blank for the department's main application.">
          <Select
            value={draft.subdivisionId}
            options={[
              { value: "", label: "The department itself" },
              ...subdivisions.map((s) => ({ value: s.id, label: s.label })),
            ]}
            placeholder="The department itself"
            onChange={(subdivisionId) => update({ subdivisionId })}
          />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Colour</p>
        <div className="flex flex-wrap gap-2">
          {TONES.map((tone) => (
            <button
              key={tone}
              type="button"
              onClick={() => update({ tone })}
              aria-pressed={draft.tone === tone}
              className={`rounded-xl px-4 py-2 text-xs font-semibold capitalize ring-1 ring-inset transition ${
                draft.tone === tone ? "bg-white/[0.10] text-white ring-white/25" : "bg-black/20 text-slate-400 ring-white/[0.06]"
              }`}
            >
              {tone}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

function FieldsTab({ draft, update, expanded, setExpanded }) {
  const flat = allFields(draft);

  const editSection = (sectionId, patch) =>
    update({
      sections: draft.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
    });

  const editField = (sectionId, fieldId, next) =>
    editSection(sectionId, {
      fields: draft.sections
        .find((s) => s.id === sectionId)
        .fields.map((f) => (f.id === fieldId ? next : f)),
    });

  const moveField = (sectionId, index, delta) => {
    const section = draft.sections.find((s) => s.id === sectionId);
    const target = index + delta;
    if (target < 0 || target >= section.fields.length) return;
    const fields = [...section.fields];
    [fields[index], fields[target]] = [fields[target], fields[index]];
    editSection(sectionId, { fields });
  };

  return (
    <div className="space-y-6">
      {draft.sections.map((section, sectionIndex) => (
        <Card key={section.id} className="p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <TextInput
                value={section.title}
                onChange={(e) => editSection(section.id, { title: e.target.value })}
                placeholder="Section title"
                className="text-base font-bold"
              />
              <TextInput
                value={section.description}
                onChange={(e) => editSection(section.id, { description: e.target.value })}
                placeholder="What this section is for (optional)"
                className="text-sm"
              />
            </div>
            {draft.sections.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  update({ sections: draft.sections.filter((s) => s.id !== section.id) })
                }
              >
                <Trash2 className="size-4" />
                Remove section
              </Button>
            )}
          </div>

          <div className="mt-5 space-y-3">
            {section.fields.map((field, index) => (
              <FieldEditor
                key={field.id}
                field={field}
                fields={flat}
                expanded={expanded === field.id}
                onToggle={() => setExpanded(expanded === field.id ? null : field.id)}
                onChange={(next) => editField(section.id, field.id, next)}
                onRemove={() =>
                  editSection(section.id, { fields: section.fields.filter((f) => f.id !== field.id) })
                }
                onDuplicate={() => {
                  const copy = { ...blankField(field.type), ...field, id: blankField(field.type).id };
                  const fields = [...section.fields];
                  fields.splice(index + 1, 0, copy);
                  editSection(section.id, { fields });
                }}
                onMove={(delta) => moveField(section.id, index, delta)}
                first={index === 0}
                last={index === section.fields.length - 1}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const field = blankField("paragraph");
                editSection(section.id, { fields: [...section.fields, field] });
                setExpanded(field.id);
              }}
            >
              <Plus className="size-4" />
              Add a question
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const field = blankField("heading");
                editSection(section.id, { fields: [...section.fields, field] });
                setExpanded(field.id);
              }}
            >
              Add a heading
            </Button>
          </div>

          {sectionIndex === draft.sections.length - 1 && (
            <div className="mt-6 border-t border-white/[0.06] pt-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => update({ sections: [...draft.sections, blankSection()] })}
              >
                <Plus className="size-4" />
                Add a section
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function DiscordTab({ draft, update }) {
  const setDiscord = (patch) => update({ discord: { ...draft.discord, ...patch } });

  return (
    <div className="space-y-6">
      <Card className="space-y-6 p-6">
        <div>
          <h2 className="text-lg font-black tracking-tight text-white">Where it goes</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">
            Every submission is posted to this channel with the answers laid out and
            an Approve and Deny button underneath. The buttons are the bot's — a
            website cannot carry them, and cannot receive the click either.
          </p>
        </div>

        <Field label="Channel ID" hint="Right-click the channel in Discord with developer mode on, then Copy Channel ID.">
          <TextInput
            value={draft.discord.channelId}
            inputMode="numeric"
            placeholder="100000000000001001"
            onChange={(e) => setDiscord({ channelId: e.target.value.trim() })}
            className="font-mono text-sm"
          />
        </Field>

        <RoleIdInput
          label="Ping when one arrives"
          hint="Mentioned in the message above the embed. Usually the recruitment team."
          value={draft.discord.pingRoleIds}
          onChange={(pingRoleIds) => setDiscord({ pingRoleIds })}
        />

        <RoleIdInput
          label="Can approve or deny"
          hint="Only these roles may press the buttons. The bot enforces this in Discord, where these ids mean something — the site cannot, so set it correctly here."
          value={draft.discord.reviewerRoleIds}
          onChange={(reviewerRoleIds) => setDiscord({ reviewerRoleIds })}
        />

        <RoleIdInput
          label="Give on approval"
          hint="Handed to the applicant automatically when somebody approves. Leave empty to assign roles by hand."
          value={draft.discord.approvedRoleIds}
          onChange={(approvedRoleIds) => setDiscord({ approvedRoleIds })}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Embed colour" hint="Six hex digits. Blank uses the card colour.">
            <TextInput
              value={draft.discord.embedColor}
              placeholder="#3b82f6"
              onChange={(e) => setDiscord({ embedColor: e.target.value.trim() })}
              className="font-mono text-sm"
            />
          </Field>
          <Field label="Footer">
            <TextInput
              value={draft.discord.footer}
              placeholder="Florida Highway Patrol · Recruitment"
              onChange={(e) => setDiscord({ footer: e.target.value })}
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={draft.discord.mentionApplicant}
            onChange={(e) => setDiscord({ mentionApplicant: e.target.checked })}
            className="size-4 accent-brand-500"
          />
          Mention the applicant in the embed
        </label>
      </Card>

      <Card className="p-6">
        <EmbedPreview application={draft} />
      </Card>
    </div>
  );
}

/** Every role key somebody can be required to hold, for the "who may apply" list. */
const ROLE_OPTIONS = [
  ...BASE_ROLES.map((role) => ({ value: role.key, label: role.label })),
  ...ROLE_MAP.map((role) => ({ value: role.key, label: role.rankFull || role.rank })),
];

function AccessTab({ draft, update }) {
  const setReq = (patch) => update({ requirements: { ...draft.requirements, ...patch } });
  const required = draft.requirements.requireRoleKeys;

  return (
    <Card className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-black tracking-tight text-white">Who can apply</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-400">
          Checked before the form opens, so somebody who does not qualify is told
          why instead of writing an application that gets refused at the end.
        </p>
      </div>

      <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={draft.requirements.requireSignIn}
          onChange={(e) => setReq({ requireSignIn: e.target.checked })}
          className="size-4 accent-brand-500"
        />
        Must be signed in with Discord
        <span className="text-xs text-slate-500">— without it there is nobody to reply to</span>
      </label>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          Must already hold one of
        </p>
        <p className="mb-3 text-xs leading-relaxed text-slate-500">
          Leave empty to let anybody apply. Set it for a subdivision, where the
          department's own rank is the entry requirement.
        </p>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map((role) => {
            const on = required.includes(role.value);
            return (
              <button
                key={role.value}
                type="button"
                onClick={() =>
                  setReq({
                    requireRoleKeys: on
                      ? required.filter((k) => k !== role.value)
                      : [...required, role.value],
                  })
                }
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
                  on ? "bg-brand-500/15 text-white ring-brand-400/40" : "bg-black/20 text-slate-400 ring-white/[0.06] hover:text-white"
                }`}
              >
                {role.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Wait before reapplying" hint="Days after a denial. 0 lets them apply again straight away.">
          <TextInput
            type="number"
            value={draft.requirements.cooldownDays}
            onChange={(e) => setReq({ cooldownDays: Number(e.target.value) })}
          />
        </Field>
        <Field label="Applications open at once" hint="Usually 1 — it stops somebody submitting five in a row.">
          <TextInput
            type="number"
            value={draft.requirements.maxOpenSubmissions}
            onChange={(e) => setReq({ maxOpenSubmissions: Number(e.target.value) })}
          />
        </Field>
      </div>
    </Card>
  );
}

function OutcomeTab({ draft, update }) {
  const setOutcome = (patch) => update({ outcome: { ...draft.outcome, ...patch } });
  return (
    <Card className="space-y-5 p-6">
      <div>
        <h2 className="text-lg font-black tracking-tight text-white">What they are told</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-400">
          The first is shown on screen the moment they submit. The other two are
          for the bot to send when somebody decides.
        </p>
      </div>
      <Field label="After submitting">
        <TextArea rows={2} value={draft.outcome.confirmation} onChange={(e) => setOutcome({ confirmation: e.target.value })} />
      </Field>
      <Field label="When approved" hint="Optional.">
        <TextArea rows={2} value={draft.outcome.approvedMessage} onChange={(e) => setOutcome({ approvedMessage: e.target.value })} />
      </Field>
      <Field label="When denied" hint="Optional. Worth writing — a denial with a reason is the difference between somebody trying again and leaving.">
        <TextArea rows={2} value={draft.outcome.deniedMessage} onChange={(e) => setOutcome({ deniedMessage: e.target.value })} />
      </Field>
    </Card>
  );
}
