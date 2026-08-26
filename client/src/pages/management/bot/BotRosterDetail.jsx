import { useState } from "react";
import { useParams } from "react-router-dom";
import { Info, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import Field from "../../../components/ui/Field";
import { TextArea, TextInput } from "../../../components/ui/TextInput";
import PageHeader from "../../../components/layout/PageHeader";
import BotError from "../../../components/bot/BotError";
import Loading from "../../../components/bot/Loading";
import JobProgress from "../../../components/bot/JobProgress";
import { useBotResource } from "../../../lib/useBotResource";
import { api } from "../../../lib/botApi";
import { formatDate, plural } from "../../../lib/format";

/**
 * One roster: its settings, its rank bindings, and its members.
 *
 * The membership list is deliberately read-only. Rosters are computed from
 * Discord roles, so there is no endpoint to add somebody and no UI here that
 * implies one — the editable parts of a member are their callsign and the name
 * shown for them. Anything that looks like "add member" would be a promise the
 * bot cannot keep.
 */
export default function BotRosterDetail() {
  const { slug } = useParams();
  const roster = useBotResource(`/rosters/manage/${encodeURIComponent(slug)}`);
  const [jobId, setJobId] = useState(null);
  const [dryRun, setDryRun] = useState(null);
  const [editing, setEditing] = useState(false);
  const [addingRank, setAddingRank] = useState(false);
  const [editingRank, setEditingRank] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [actionError, setActionError] = useState(null);

  const data = roster.data;

  const sync = async (isDryRun) => {
    setActionError(null);
    setDryRun(isDryRun);
    try {
      const result = await api(`/rosters/manage/${encodeURIComponent(slug)}/sync`, {
        method: "POST",
        body: { dryRun: isDryRun },
      });
      setJobId(result?.jobId ?? result?.id ?? null);
    } catch (err) {
      setActionError(err);
    }
  };

  if (roster.error) {
    return (
      <>
        <PageHeader eyebrow="Roster" title={slug} backTo="/management/bot/rosters" backLabel="All rosters" />
        <BotError error={roster.error} onRetry={roster.reload} />
      </>
    );
  }

  if (roster.loading || !data) {
    return (
      <>
        <PageHeader eyebrow="Roster" title={slug} backTo="/management/bot/rosters" backLabel="All rosters" />
        <Loading rows={4} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Roster"
        title={data.name ?? slug}
        subtitle={data.description ?? undefined}
        backTo="/management/bot/rosters"
        backLabel="All rosters"
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => sync(true)} disabled={Boolean(jobId)}>
              Preview sync
            </Button>
            <Button size="sm" onClick={() => sync(false)} disabled={Boolean(jobId)}>
              <RefreshCw className="size-4" />
              Sync now
            </Button>
          </>
        }
      />

      {actionError && <BotError error={actionError} className="mb-5" />}

      {jobId && (
        <div className="mb-5">
          <JobProgress
            jobId={jobId}
            title={dryRun ? "Sync preview — nothing will be applied" : "Roster sync"}
            onDone={() => !dryRun && roster.reload()}
            onClose={() => setJobId(null)}
          />
        </div>
      )}

      <Card className="mb-6 flex items-start gap-3 p-5">
        <Info className="mt-0.5 size-5 shrink-0 text-slate-500" />
        <div className="text-sm leading-relaxed text-slate-400">
          <p className="font-semibold text-slate-300">How this roster fills itself</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-400">
            <li>
              <span className="text-slate-300">Bind a rank</span> to each Discord role that
              should appear here — a rank’s holders show up automatically.
            </li>
            <li>
              Give a rank a <span className="text-slate-300">callsign block</span> (e.g.
              120–129) and the bot hands out the next free number as people join it.
            </li>
            <li>
              <span className="text-slate-300">Sync</span> to apply it — members are added,
              renamed to <code className="text-xs">callsign | rank | name</code>, and removed
              when they lose the role. Nobody is added by hand.
            </li>
          </ol>
        </div>
      </Card>

      <section className="mb-8">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
            Settings
          </h2>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            Edit
          </Button>
        </div>
        <Card className="grid gap-4 p-5 sm:grid-cols-3">
          <Detail label="Slug" value={data.slug} mono />
          <Detail label="Discord server" value={data.discordGuildId} mono />
          <Detail label="Position" value={String(data.position ?? 0)} />
          <Detail
            label="Updated"
            value={data.updatedAt ? formatDate(data.updatedAt) : "—"}
          />
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
            Ranks and members
          </h2>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setAddingRank(true)}>
            <Plus className="size-4" />
            Bind a rank
          </Button>
        </div>

        {(data.ranks ?? []).length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-slate-400">
              No ranks bound yet. Bind a Discord role to a rank and its holders appear
              here after the next sync.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Rendered in the order the API returned — ranks come back
                highest-seniority first and members sorted by callsign, so
                re-sorting here would fight the server's ordering. */}
            {data.ranks.map((rank) => (
              <Card key={rank.discordRoleId} className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-5 py-3">
                  <h3 className="text-sm font-bold text-white">{rank.name}</h3>
                  {rank.shortName && <Badge tone="slate">{rank.shortName}</Badge>}
                  {rank.callsignRangeStart != null && rank.callsignRangeEnd != null && (
                    <Badge tone="primary">
                      Callsigns {rank.callsignRangeStart}–{rank.callsignRangeEnd}
                    </Badge>
                  )}
                  <code className="text-xs text-slate-600">{rank.discordRoleId}</code>
                  <span className="ml-auto text-xs text-slate-500">
                    {plural(rank.members?.length ?? 0, "member")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingRank(rank)}
                    aria-label={`Edit ${rank.name}`}
                    className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setActionError(null);
                      try {
                        await api(
                          `/rosters/manage/${encodeURIComponent(slug)}/ranks/${encodeURIComponent(rank.discordRoleId)}`,
                          { method: "DELETE" },
                        );
                        roster.reload();
                      } catch (err) {
                        setActionError(err);
                      }
                    }}
                    aria-label={`Unbind ${rank.name}`}
                    className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                {(rank.members ?? []).length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-500">
                    Nobody holds this role.
                  </p>
                ) : (
                  <ul className="divide-y divide-white/[0.06]">
                    {rank.members.map((member) => (
                      <li
                        key={member.discordUserId}
                        className="flex flex-wrap items-center gap-3 px-5 py-3"
                      >
                        {member.callsign && (
                          <span className="w-16 shrink-0 font-bold text-primary-400">
                            {member.callsign}
                          </span>
                        )}
                        <span className="min-w-0 flex-1 text-sm text-white">
                          {member.preferredName ?? member.name}
                        </span>
                        <code className="hidden text-xs text-slate-600 lg:block">
                          {member.discordUserId}
                        </code>
                        {member.since && (
                          <span className="text-xs text-slate-500">
                            since {formatDate(member.since)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingMember(member)}
                          aria-label={`Edit ${member.name}`}
                          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
                        >
                          <Pencil className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {editing && (
        <EditRoster
          roster={data}
          slug={slug}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            roster.reload();
          }}
        />
      )}

      {addingRank && (
        <RankModal
          slug={slug}
          onClose={() => setAddingRank(false)}
          onSaved={() => {
            setAddingRank(false);
            roster.reload();
          }}
        />
      )}

      {editingRank && (
        <RankModal
          key={editingRank.discordRoleId}
          slug={slug}
          rank={editingRank}
          onClose={() => setEditingRank(null)}
          onSaved={() => {
            setEditingRank(null);
            roster.reload();
          }}
        />
      )}

      {editingMember && (
        <EditMember
          key={editingMember.discordUserId}
          slug={slug}
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSaved={() => {
            setEditingMember(null);
            roster.reload();
          }}
        />
      )}
    </>
  );
}

function Detail({ label, value, mono = false }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className={`mt-1 text-sm text-slate-300 ${mono ? "font-mono text-xs" : ""}`}>
        {value || "—"}
      </dd>
    </div>
  );
}

function EditRoster({ roster, slug, onClose, onSaved }) {
  const [values, setValues] = useState({
    name: roster.name ?? "",
    description: roster.description ?? "",
    position: roster.position ?? 0,
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api(`/rosters/manage/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        body: {
          name: values.name.trim(),
          // null clears the field; an empty string would set it to one.
          description: values.description.trim() || null,
          position: Number(values.position) || 0,
        },
      });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Roster settings">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" htmlFor="e-name">
          <TextInput
            id="e-name"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          />
        </Field>
        <Field label="Description" htmlFor="e-desc" hint="Leave empty to clear it.">
          <TextArea
            id="e-desc"
            rows={2}
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          />
        </Field>
        <Field label="Position" htmlFor="e-pos">
          <TextInput
            id="e-pos"
            type="number"
            value={values.position}
            onChange={(e) => setValues((v) => ({ ...v, position: e.target.value }))}
            className="max-w-28"
          />
        </Field>
        {error && <BotError error={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Bind a new rank, or edit an existing one. A rank is keyed by its Discord role,
 * so editing keeps that role fixed and re-binds it in place — which is why the
 * role ID is locked once a rank exists.
 */
function RankModal({ slug, rank = null, onClose, onSaved }) {
  const isEdit = Boolean(rank);
  const [values, setValues] = useState({
    discordRoleId: rank?.discordRoleId ?? "",
    name: rank?.name ?? "",
    shortName: rank?.shortName ?? "",
    position: rank?.position ?? 0,
    callsignStart: rank?.callsignRangeStart ?? "",
    callsignEnd: rank?.callsignRangeEnd ?? "",
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    // Both ends of the callsign range, or neither — a half-set range is a mistake
    // the server would reject anyway, so it is friendlier to catch it here.
    const start = values.callsignStart === "" ? null : Number(values.callsignStart);
    const end = values.callsignEnd === "" ? null : Number(values.callsignEnd);
    if ((start === null) !== (end === null)) {
      setError(new Error("Set both the start and end of the callsign range, or leave both empty."));
      setSaving(false);
      return;
    }
    if (start !== null && end !== null && start > end) {
      setError(new Error("The callsign range start must be at or below the end."));
      setSaving(false);
      return;
    }

    try {
      await api(`/rosters/manage/${encodeURIComponent(slug)}/ranks`, {
        method: "POST",
        body: {
          discordRoleId: values.discordRoleId.trim(),
          name: values.name.trim(),
          shortName: values.shortName.trim() || undefined,
          position: Number(values.position) || 0,
          // Always send both, so clearing the fields clears the range on the server.
          callsignRangeStart: start,
          callsignRangeEnd: end,
        },
      });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit ${rank.name}` : "Bind a Discord role to a rank"}>
      <form onSubmit={submit} className="space-y-4">
        <Field
          label="Discord role ID"
          htmlFor="b-role"
          required={!isEdit}
          hint={isEdit ? "A rank is tied to its Discord role and cannot be moved to another." : undefined}
        >
          <TextInput
            id="b-role"
            value={values.discordRoleId}
            disabled={isEdit}
            onChange={(e) => setValues((v) => ({ ...v, discordRoleId: e.target.value }))}
          />
        </Field>
        <Field label="Rank name" htmlFor="b-name" required>
          <TextInput
            id="b-name"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          />
        </Field>
        <Field label="Short name" htmlFor="b-short" hint="Shown in nicknames where space is tight, e.g. “Sr. Mod”.">
          <TextInput
            id="b-short"
            value={values.shortName}
            onChange={(e) => setValues((v) => ({ ...v, shortName: e.target.value }))}
          />
        </Field>
        <Field label="Position" htmlFor="b-pos" hint="Higher is more senior. Decides who wins when someone holds two ranks.">
          <TextInput
            id="b-pos"
            type="number"
            value={values.position}
            onChange={(e) => setValues((v) => ({ ...v, position: e.target.value }))}
            className="max-w-28"
          />
        </Field>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            Callsign block <span className="font-medium normal-case tracking-normal text-slate-500">— optional</span>
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Give this rank a range and the bot issues the next free number in it whenever
            someone joins the rank — no need to hand out callsigns yourself. Leave both
            empty to keep assigning them by hand.
          </p>
          <div className="mt-3 flex items-end gap-3">
            <Field label="From" htmlFor="b-cs-start">
              <TextInput
                id="b-cs-start"
                type="number"
                placeholder="120"
                value={values.callsignStart}
                onChange={(e) => setValues((v) => ({ ...v, callsignStart: e.target.value }))}
                className="max-w-28"
              />
            </Field>
            <span className="pb-2.5 text-slate-500">–</span>
            <Field label="To" htmlFor="b-cs-end">
              <TextInput
                id="b-cs-end"
                type="number"
                placeholder="129"
                value={values.callsignEnd}
                onChange={(e) => setValues((v) => ({ ...v, callsignEnd: e.target.value }))}
                className="max-w-28"
              />
            </Field>
          </div>
        </div>

        {error && <BotError error={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save" : "Bind"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditMember({ slug, member, onClose, onSaved }) {
  const [callsign, setCallsign] = useState(member.callsign ?? "");
  const [preferredName, setPreferredName] = useState(member.preferredName ?? "");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api(
        `/rosters/manage/${encodeURIComponent(slug)}/members/${encodeURIComponent(member.discordUserId)}`,
        {
          method: "PATCH",
          // Empty means "clear this", which the API expresses as null rather
          // than an empty string.
          body: {
            callsign: callsign.trim() || null,
            preferredName: preferredName.trim() || null,
          },
        },
      );
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={member.name}>
      <form onSubmit={submit} className="space-y-4">
        <Field
          label="Callsign"
          htmlFor="m-callsign"
          hint="Set one by hand, or leave it empty — if the rank has a callsign block, the next sync fills it in."
        >
          <TextInput
            id="m-callsign"
            value={callsign}
            onChange={(e) => setCallsign(e.target.value)}
          />
        </Field>
        <Field
          label="Displayed name"
          htmlFor="m-name"
          hint={`Overrides "${member.name}" on the roster. Leave empty to use it.`}
        >
          <TextInput
            id="m-name"
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
          />
        </Field>
        {error && <BotError error={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
