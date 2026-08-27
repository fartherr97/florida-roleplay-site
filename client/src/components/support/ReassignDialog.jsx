import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Field from "../ui/Field";
import Select from "../ui/Select";
import { api } from "../../lib/api";

/**
 * Handing a ticket to another staff member.
 *
 * The target is picked from a live directory of the senior tiers — Admin up to
 * Ownership — read from the roles people actually hold, so it follows promotions
 * and demotions on its own. Each option reads in the community's format,
 * "100 | Owner | Mike", and that label is what the ticket records as the
 * assignee.
 */
export default function ReassignDialog({ open, onClose, onConfirm }) {
  const [staff, setStaff] = useState(null);
  const [choice, setChoice] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // The parent remounts this per open (via a key), so state starts fresh — the
  // effect only has to fetch the directory.
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    api
      .supportAssignable()
      .then((data) => active && setStaff(data.staff ?? []))
      .catch(() => active && setStaff([]));
    return () => {
      active = false;
    };
  }, [open]);

  const options = (staff ?? []).map((s) => ({ value: s.discordId, label: s.label }));
  const picked = (staff ?? []).find((s) => s.discordId === choice) ?? null;

  async function confirm() {
    if (!picked) return;
    setSaving(true);
    setError(null);
    // The full roster label is stored as the assignee, so the queue and thread
    // read "Assigned: 100 | Owner | Mike".
    const result = await onConfirm(picked.discordId, picked.label);
    setSaving(false);
    if (result && !result.ok) setError(result.message ?? "That did not go through.");
  }

  return (
    <Modal open={open} onClose={onClose} title="Reassign this ticket">
      <p className="text-sm leading-relaxed text-slate-300">
        It moves to their queue and the change is written into the ticket&apos;s history with your name on it.
      </p>

      {staff === null ? (
        <div className="mt-4 h-12 animate-pulse rounded-2xl bg-white/[0.04]" />
      ) : staff.length === 0 ? (
        <p className="mt-4 rounded-xl bg-black/25 p-4 text-sm text-slate-400 ring-1 ring-inset ring-white/[0.06]">
          No senior staff are available to assign. Anyone with Admin through Ownership who has signed into the portal
          will appear here.
        </p>
      ) : (
        <Field label="Assign to" className="mt-4">
          <Select
            value={choice}
            options={options}
            placeholder="Choose a staff member"
            onChange={setChoice}
          />
        </Field>
      )}

      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!picked || saving} onClick={confirm}>
          Reassign
        </Button>
      </div>
    </Modal>
  );
}
