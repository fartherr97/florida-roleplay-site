import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import AccessDenied from "../../components/auth/AccessDenied";
import { DeptChip } from "../../components/transfers/TicketBits";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { cn } from "../../lib/cn";
import {
  TRANSFER_DEPARTMENTS,
  isStaff,
  ranksFor,
  validateRequest,
} from "../../lib/transferPortal";

/**
 * Raising a transfer.
 *
 * Departments are picked as tiles rather than from two dropdowns: the choice is
 * between five things, and a member reads their own department faster as a
 * coloured badge than as a line in a menu. Picking the outgoing department also
 * filters the rank list to that department's ladder, so the rank field cannot
 * hold a rank that department does not have.
 */
export default function TransferNew() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();

  const staff = useMemo(
    () => isStaff({ roleKeys: user?.roles ?? [], permissions: new Set(hasPermission("transfers.manage") ? ["transfers.manage"] : []) }),
    [user, hasPermission],
  );

  const [draft, setDraft] = useState({
    memberName: user?.displayName ?? "",
    memberDiscordId: user?.id ?? "",
    currentRank: "",
    fromDept: "",
    toDept: "",
    reason: "",
    removeRoles: true,
    assignVisitorPass: true,
    assignRetired: false,
  });
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [sending, setSending] = useState(false);

  const set = (patch) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setErrors({});
    setFailure(null);
  };

  const rankOptions = useMemo(
    () => ranksFor(draft.fromDept).map((rank) => ({ value: rank.label, label: rank.label })),
    [draft.fromDept],
  );

  if (!user) return <AccessDenied reason="signed-out" />;
  if (!hasPermission("transfers.view")) return <AccessDenied reason="role" />;

  async function submit(event) {
    event.preventDefault();
    const check = validateRequest(draft);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setSending(true);
    try {
      const result = await api.raiseTransfer(draft);
      if (result?.ok) {
        navigate(`/transfers/${result.ticket.id}`);
        return;
      }
      setFailure(result?.message ?? "That was not raised.");
    } catch (err) {
      if (err?.errors) setErrors(err.errors);
      else setFailure(err?.message ?? "That was not raised.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Section className="max-w-3xl">
      <Button as={Link} to="/transfers" variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="size-4" />
        Back to the queue
      </Button>

      <PageHeader
        eyebrow="Emergency services"
        title="Raise a transfer"
        subtitle="Both departments have to sign before anybody moves. The receiving department decides the rank you start on."
      />

      <form onSubmit={submit} noValidate>
        <Card className="space-y-6 p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Member" htmlFor="memberName" required hint={errors.memberName}>
              <TextInput
                id="memberName"
                value={draft.memberName}
                readOnly={!staff}
                onChange={(e) => set({ memberName: e.target.value })}
                aria-invalid={Boolean(errors.memberName)}
              />
            </Field>
            <Field
              label="Discord ID"
              htmlFor="memberDiscordId"
              required
              hint={
                errors.memberDiscordId ??
                (staff ? "Raising this for somebody else? Put their ID here." : "Yours — this is who gets the reply.")
              }
            >
              <TextInput
                id="memberDiscordId"
                value={draft.memberDiscordId}
                readOnly={!staff}
                inputMode="numeric"
                onChange={(e) => set({ memberDiscordId: e.target.value.trim() })}
                className="font-mono text-sm"
                aria-invalid={Boolean(errors.memberDiscordId)}
              />
            </Field>
          </div>

          <DeptPicker
            label="Leaving"
            value={draft.fromDept}
            error={errors.fromDept}
            onChange={(fromDept) => set({ fromDept, currentRank: "" })}
          />

          <Field label="Current rank" required hint={errors.currentRank}>
            {draft.fromDept ? (
              <Select
                value={draft.currentRank}
                options={rankOptions}
                placeholder="Pick a rank"
                onChange={(currentRank) => set({ currentRank })}
              />
            ) : (
              <p className="rounded-2xl bg-black/20 px-4 py-3 text-sm text-slate-500 ring-1 ring-inset ring-white/[0.06]">
                Pick the department they are leaving first.
              </p>
            )}
          </Field>

          <DeptPicker
            label="Joining"
            value={draft.toDept}
            exclude={draft.fromDept}
            error={errors.toDept}
            onChange={(toDept) => set({ toDept })}
          />

          <Field label="Why the move?" required hint={errors.reason ?? "Both departments' command staff read this."}>
            <TextArea
              rows={4}
              value={draft.reason}
              onChange={(e) => set({ reason: e.target.value })}
              placeholder="What is driving the move, and anything the receiving department should know."
              aria-invalid={Boolean(errors.reason)}
            />
          </Field>

          {staff && (
            <div className="rounded-2xl bg-black/20 p-4 ring-1 ring-inset ring-white/[0.06]">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                What the outgoing department does on completion
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Recorded on the ticket for whoever processes it. This site does not
                touch anybody's Discord roles — the bot does, from the roster.
              </p>
              <div className="mt-3 space-y-2">
                <Toggle
                  label="Remove their old department roles"
                  checked={draft.removeRoles}
                  onChange={(removeRoles) => set({ removeRoles })}
                />
                <Toggle
                  label="Give them a visitor pass"
                  checked={draft.assignVisitorPass}
                  onChange={(assignVisitorPass) => set({ assignVisitorPass })}
                />
                <Toggle
                  label="Mark them retired with the outgoing department"
                  checked={draft.assignRetired}
                  onChange={(assignRetired) => set({ assignRetired })}
                />
              </div>
            </div>
          )}

          {failure && <p className="text-sm text-rose-300">{failure}</p>}

          <div className="flex justify-end">
            <Button type="submit" disabled={sending}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Raise transfer
            </Button>
          </div>
        </Card>
      </form>
    </Section>
  );
}

function DeptPicker({ label, value, exclude, error, onChange }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
        <span className="ml-1 text-brand-400">*</span>
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {TRANSFER_DEPARTMENTS.map((department) => {
          const disabled = department.id === exclude;
          const selected = value === department.id;
          return (
            <button
              key={department.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(department.id)}
              aria-pressed={selected}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl px-3 py-3 text-center ring-1 ring-inset transition",
                selected ? "bg-white/[0.08] ring-white/25" : "bg-black/20 ring-white/[0.06] hover:bg-white/[0.04]",
                disabled && "cursor-not-allowed opacity-30",
              )}
            >
              <DeptChip id={department.id} />
              <span className="text-[0.7rem] leading-tight text-slate-400">{department.label}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-brand-500"
      />
      {label}
    </label>
  );
}
