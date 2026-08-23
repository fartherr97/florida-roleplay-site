import { useState } from "react";
import { CalendarClock, Check } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Field from "../ui/Field";
import Select from "../ui/Select";
import { TextArea, TextInput } from "../ui/TextInput";
import Badge from "../ui/Badge";
import { ACTIVITY_STATUSES } from "../../data/rosterData";
import { formatDate } from "../../lib/format";
import { cn } from "../../lib/cn";

/** Today in YYYY-MM-DD, for the date input's minimum. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Editor for one member's activity status. LOA asks for a return date, which is
 * what the bot's expiry sweep reads to take the Discord tag off again — so the
 * date is required and cannot be in the past.
 */
export default function StatusEditor({ member, open, onClose, onSave, canManageLoa }) {
  const [status, setStatus] = useState(member?.status ?? "Active");
  const [until, setUntil] = useState(member?.loaUntil ?? "");
  const [note, setNote] = useState(member?.loaReason ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!member) return null;

  const definition = ACTIVITY_STATUSES.find((s) => s.id === status);
  const needsDate = Boolean(definition?.requiresDate);

  const options = ACTIVITY_STATUSES.filter(
    (s) => canManageLoa || !s.requiresDate || member.status === s.id,
  ).map((s) => ({ value: s.id, label: s.label }));

  const submit = async (e) => {
    e.preventDefault();
    if (needsDate) {
      if (!until) {
        setError("A return date is required for LOA.");
        return;
      }
      if (until < today()) {
        setError("The return date cannot be in the past.");
        return;
      }
    }
    setSaving(true);
    try {
      // The member's identity has to ride along: every caller addresses the
      // write by id, and the server logs the change under their name.
      await onSave({
        id: member.id,
        discordId: member.discordId,
        characterName: member.characterName ?? member.name,
        status,
        loaUntil: needsDate ? until : null,
        loaReason: needsDate ? note.trim() : "",
      });
      onClose();
    } catch (err) {
      setError((err.errors ?? [err.message]).join(" "));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member.characterName}
      subtitle={`${member.rankFull ?? member.rank} · ${member.displayName}`}
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label="Activity status" htmlFor="activityStatus" required>
          <Select
            id="activityStatus"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setError("");
            }}
            options={options}
          />
        </Field>

        {definition && (
          <p className="rounded-xl bg-black/25 p-3.5 text-xs leading-relaxed text-slate-400 ring-1 ring-inset ring-white/[0.06]">
            {definition.detail}
          </p>
        )}

        {needsDate && (
          <>
            <Field
              label="Return date"
              htmlFor="loaUntil"
              required
              hint="The bot removes the LOA tag in Discord on this date."
            >
              <TextInput
                id="loaUntil"
                type="date"
                min={today()}
                value={until}
                onChange={(e) => {
                  setUntil(e.target.value);
                  setError("");
                }}
              />
            </Field>
            <Field label="Reason" htmlFor="loaReason" hint="Optional. Visible to staff only.">
              <TextArea
                id="loaReason"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Exams until the end of the month."
              />
            </Field>
          </>
        )}

        {member.status === "LOA" && member.loaUntil && status !== "LOA" && (
          <p className="inline-flex items-center gap-2 text-xs text-slate-400">
            <CalendarClock className="size-3.5 text-amber-400" />
            Ends an LOA due back {formatDate(member.loaUntil)}.
          </p>
        )}

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
          <Badge tone={definition?.tone ?? "slate"} dot>
            {status}
          </Badge>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              <Check className="size-4" />
              {saving ? "Saving…" : "Save status"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** Compact status pill used in the roster table, clickable when editable. */
export function StatusPill({ member, onEdit, editable }) {
  const definition = ACTIVITY_STATUSES.find((s) => s.id === member.status);
  const label =
    member.status === "LOA" && member.loaUntil
      ? `LOA · ${formatDate(member.loaUntil)}`
      : member.status;

  if (!editable) {
    return (
      <Badge tone={definition?.tone ?? "slate"} dot={member.status === "Active"}>
        {label}
      </Badge>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onEdit(member)}
      className={cn(
        "rounded-full transition hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/70",
      )}
      aria-label={`Change activity status for ${member.characterName}`}
    >
      <Badge tone={definition?.tone ?? "slate"} dot={member.status === "Active"}>
        {label}
      </Badge>
    </button>
  );
}
