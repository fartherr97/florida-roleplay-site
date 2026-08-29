import { useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import Button from "../ui/Button";
import Field from "../ui/Field";
import Select from "../ui/Select";
import { TextArea, TextInput } from "../ui/TextInput";
import { api } from "../../lib/api";
import { ACTION_TYPES, bodyLabel, filingBodiesFor, validateAction } from "../../lib/discipline";

const BLANK = {
  type: "verbal_warning",
  bodyId: "",
  targetName: "",
  targetDiscordId: "",
  reason: "",
  expiresAt: "",
};

/**
 * The filing form, shared by the DA Hub and the DA Database.
 *
 * It lives here rather than in either page because both of them open it for the
 * same reason and it must behave identically in both: one copy that drifts is
 * how a field ends up required on one screen and optional on the other.
 *
 * `prefill` seeds the member fields — the Database passes the Discord ID
 * somebody has just looked up, so filing against the record you are reading
 * does not mean copying the ID back out of the search box.
 */
export default function DaActionForm({ ctx, prefill, onFiled, lockBodyId }) {
  // Only the bodies this person may actually file for. Offering the rest would
  // be offering a 403.
  const bodies = useMemo(() => filingBodiesFor(ctx), [ctx]);
  // Auto-picked only when there is nothing to pick between. The body is what
  // decides whether an action reads as Staff or Department in /bgcheck, so for
  // anybody who can file for several, a default that quietly sticks is worse
  // than one more click. `lockBodyId` fixes it outright — the DA page inside a
  // department hub files everything under that department.
  const blank = useMemo(
    () => ({
      ...BLANK,
      bodyId: lockBodyId ?? (bodies.length === 1 ? bodies[0].id : ""),
      ...prefill,
    }),
    [bodies, prefill, lockBodyId],
  );

  const [draft, setDraft] = useState(blank);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (patch) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setErrors({});
    setFailure(null);
  };

  // Only the ones that run out need an end date — a termination has no end.
  const needsExpiry = ["suspension", "pto_restriction"].includes(draft.type);

  async function submit(event) {
    event.preventDefault();
    const check = validateAction(draft);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setBusy(true);
    try {
      const result = await api.fileDisciplinaryAction({
        ...draft,
        expiresAt: needsExpiry && draft.expiresAt ? draft.expiresAt : null,
      });
      if (result?.ok) {
        setDraft(blank);
        onFiled?.(result.action);
      } else {
        setFailure(result?.message ?? "That was not filed.");
      }
    } catch (err) {
      if (err?.errors) setErrors(err.errors);
      else setFailure(err?.message ?? "That was not filed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Action" required error={errors.type}>
          <Select
            value={draft.type}
            options={ACTION_TYPES.map((t) => ({ value: t.id, label: t.label }))}
            onChange={(type) => set({ type })}
          />
        </Field>
        {lockBodyId ? (
          <Field label="Filed on behalf of">
            <div className="flex h-11 items-center rounded-xl bg-black/20 px-3 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.06]">
              {bodyLabel(lockBodyId)}
            </div>
          </Field>
        ) : (
          <Field label="Filed on behalf of" required error={errors.bodyId}>
            <Select
              value={draft.bodyId}
              options={bodies.map((b) => ({ value: b.id, label: b.label }))}
              placeholder="Pick a body"
              onChange={(bodyId) => set({ bodyId })}
            />
          </Field>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Member" required error={errors.targetName}>
          <TextInput
            value={draft.targetName}
            onChange={(e) => set({ targetName: e.target.value })}
            placeholder="C. Alex"
          />
        </Field>
        <Field label="Their Discord ID" required error={errors.targetDiscordId}>
          <TextInput
            value={draft.targetDiscordId}
            inputMode="numeric"
            onChange={(e) => set({ targetDiscordId: e.target.value.trim() })}
            className="font-mono text-sm"
          />
        </Field>
      </div>

      <Field
        label="Reason"
        required
        error={errors.reason}
        hint="This is the record. Write it for somebody reading it in six months."
      >
        <TextArea rows={3} value={draft.reason} onChange={(e) => set({ reason: e.target.value })} />
      </Field>

      {needsExpiry && (
        <Field label="Runs until" hint="Leave blank if it has no end date.">
          <TextInput
            type="date"
            value={draft.expiresAt}
            onChange={(e) => set({ expiresAt: e.target.value })}
            className="[color-scheme:dark]"
          />
        </Field>
      )}

      {failure && <p className="text-sm text-rose-300">{failure}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          File action
        </Button>
      </div>
    </form>
  );
}
