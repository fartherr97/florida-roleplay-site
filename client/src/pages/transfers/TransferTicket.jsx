import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2, RotateCcw, ShieldCheck, X, XCircle } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import { TextArea } from "../../components/ui/TextInput";
import NotFound from "../../components/auth/NotFound";
import AccessDenied from "../../components/auth/AccessDenied";
import TicketChat from "../../components/transfers/TicketChat";
import {
  ApprovalPair,
  HistoryTimeline,
  PresenceBar,
  StatusBadge,
  TransferRoute,
} from "../../components/transfers/TicketBits";
import { api, ApiForbiddenError } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { formatDateTime } from "../../lib/format";
import {
  EMPLOYMENT_TYPES,
  approvalState,
  departmentAbbr,
  departmentLabel,
  isTerminal,
  ranksFor,
} from "../../lib/transferPortal";

/**
 * One ticket: the move, both signatures, the two threads, and whatever the
 * caller is allowed to do about it.
 *
 * Every action button is offered only when the server would allow it, and the
 * server re-checks anyway. The difference matters most on `signFor`: it is the
 * department the caller actually signs for, computed server-side from their
 * roles, so the Approve button says which side it signs for rather than leaving
 * a Fire Chief to guess whether they are approving as HCFR or as the department
 * on the other end.
 */
export default function TransferTicket() {
  const { id } = useParams();
  const { user } = useAuth();
  const [state, setState] = useState({ key: null, data: undefined, denied: false });
  const [viewers, setViewers] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);

  const load = useCallback(
    (signal) =>
      api
        .transfer(id)
        .then((data) => {
          if (!signal?.aborted) setState({ key: id, data, denied: false });
        })
        .catch((err) => {
          if (!signal?.aborted) {
            setState({ key: id, data: null, denied: err instanceof ApiForbiddenError });
          }
        }),
    [id],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // The heartbeat is also the read: one call says "I am here" and answers with
  // everybody else who is.
  useEffect(() => {
    let active = true;
    const beat = () =>
      api
        .transferPresence(id)
        .then((data) => active && setViewers(data.viewers ?? []))
        .catch(() => {});
    beat();
    const timer = setInterval(beat, 12_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id]);

  const loading = state.key !== id;
  const ticket = state.data?.ticket ?? null;
  const can = state.data?.can ?? { manage: false, internal: false, close: false, signFor: null };
  const state_ = useMemo(() => (ticket ? approvalState(ticket) : null), [ticket]);

  if (loading) {
    return (
      <Section className="max-w-4xl">
        <div className="h-96 animate-pulse rounded-2xl bg-white/[0.03]" />
      </Section>
    );
  }
  if (state.denied) return <AccessDenied reason="role" />;
  if (!ticket) return <NotFound />;

  async function act(action, payload) {
    setBusy(action);
    setError(null);
    try {
      const result =
        action === "close" || action === "reopen"
          ? await api.transferState(ticket.id, action)
          : await api.transferAction(ticket.id, action, payload);
      if (result?.ok) {
        setState((prev) => ({ ...prev, data: { ...prev.data, ticket: result.ticket } }));
        setModal(null);
        // The caller's own permissions on the ticket can change with its state,
        // so take the server's word for them again rather than assuming.
        load();
      } else {
        setError(result?.message ?? "That was not recorded.");
      }
    } catch (err) {
      setError(err?.message ?? "That was not recorded.");
    } finally {
      setBusy(null);
    }
  }

  const mySignature = (ticket.approvals ?? []).find((a) => a.dept === can.signFor);
  const terminal = isTerminal(ticket.status);

  return (
    <Section className="max-w-4xl">
      <Button as={Link} to="/transfers" variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="size-4" />
        Back to the queue
      </Button>

      <PageHeader
        eyebrow={<TransferRoute from={ticket.fromDept} to={ticket.toDept} full />}
        title={ticket.memberName}
        subtitle={`${ticket.currentRank} · raised ${formatDateTime(ticket.createdAt)} · ${ticket.id}`}
        actions={<StatusBadge status={ticket.status} />}
      />

      <div className="mb-4">
        <PresenceBar viewers={viewers} meId={user?.id} />
      </div>

      {ticket.status === "rejected" && ticket.rejectionReason && (
        <Card className="mb-6 p-5 ring-1 ring-inset ring-rose-400/25">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-200">
            <XCircle className="size-4" />
            Rejected
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{ticket.rejectionReason}</p>
        </Card>
      )}

      {ticket.status === "completed" && (
        <Card className="mb-6 p-5 ring-1 ring-inset ring-emerald-400/25">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
            <ShieldCheck className="size-4" />
            Completed
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Started with {departmentLabel(ticket.toDept)} as{" "}
            <span className="font-semibold text-white">{ticket.assignedRank}</span>
            {ticket.employmentType
              ? `, ${EMPLOYMENT_TYPES.find((t) => t.id === ticket.employmentType)?.label.toLowerCase()}`
              : ""}
            {ticket.retiredMember ? `, retired with ${departmentAbbr(ticket.fromDept)}` : ""}.
          </p>
        </Card>
      )}

      <Card className="mb-6 p-6">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400">Approvals</h2>
        <ApprovalPair ticket={ticket} className="mt-4" />

        {can.manage && !terminal && (
          <div className="mt-5 flex flex-wrap gap-3 border-t border-white/[0.06] pt-5">
            {can.signFor && !mySignature && (
              <Button onClick={() => act("approve")} disabled={Boolean(busy)}>
                {busy === "approve" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Approve for {departmentAbbr(can.signFor)}
              </Button>
            )}
            {mySignature && (
              <Button variant="secondary" onClick={() => act("revoke")} disabled={Boolean(busy)}>
                {busy === "revoke" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                Withdraw {departmentAbbr(can.signFor)} approval
              </Button>
            )}
            {state_?.both && (
              <Button variant="secondary" onClick={() => setModal("process")} disabled={Boolean(busy)}>
                <ShieldCheck className="size-4" />
                Process transfer
              </Button>
            )}
            <Button variant="danger" onClick={() => setModal("reject")} disabled={Boolean(busy)}>
              <X className="size-4" />
              Reject
            </Button>
          </div>
        )}

        {can.close && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.06] pt-5">
            <p className="mr-auto self-center text-xs text-slate-500">Management</p>
            {ticket.status !== "closed" ? (
              <Button variant="ghost" size="sm" onClick={() => act("close")} disabled={Boolean(busy)}>
                Close ticket
              </Button>
            ) : null}
            {terminal ? (
              <Button variant="ghost" size="sm" onClick={() => act("reopen")} disabled={Boolean(busy)}>
                <RotateCcw className="size-4" />
                Reopen
              </Button>
            ) : null}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      </Card>

      <Card className="mb-6 p-6">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400">Why</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">{ticket.reason}</p>

        {can.manage && (
          <dl className="mt-5 grid gap-3 border-t border-white/[0.06] pt-5 text-sm sm:grid-cols-3">
            <Detail label="Old roles" value={ticket.removeRoles ? "Remove" : "Leave in place"} />
            <Detail label="Visitor pass" value={ticket.assignVisitorPass ? "Give" : "No"} />
            <Detail label="Mark retired" value={ticket.assignRetired ? "Yes" : "No"} />
          </dl>
        )}
      </Card>

      <Card className="mb-6 p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">Conversation</h2>
        <TicketChat ticketId={ticket.id} canInternal={can.internal} meId={user?.id} />
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">History</h2>
        <HistoryTimeline history={ticket.history} />
      </Card>

      <RejectModal
        open={modal === "reject"}
        busy={busy === "reject"}
        onClose={() => setModal(null)}
        onConfirm={(reason) => act("reject", { reason })}
      />
      <ProcessModal
        open={modal === "process"}
        busy={busy === "process"}
        ticket={ticket}
        onClose={() => setModal(null)}
        onConfirm={(payload) => act("process", payload)}
      />
    </Section>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-200">{value}</dd>
    </div>
  );
}

function RejectModal({ open, busy, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Reject this transfer?">
      <p className="text-sm leading-relaxed text-slate-300">
        The member reads this. A rejection with a reason is the difference between
        somebody trying again later and somebody leaving.
      </p>
      <Field label="Reason" className="mt-4">
        <TextArea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why this one is not going ahead."
        />
      </Field>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={() => onConfirm(reason)} disabled={busy || reason.trim().length < 10}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Reject
        </Button>
      </div>
    </Modal>
  );
}

function ProcessModal({ open, busy, ticket, onClose, onConfirm }) {
  const [assignedRank, setAssignedRank] = useState("");
  const [employmentType, setEmploymentType] = useState("fulltime");
  const [retiredMember, setRetiredMember] = useState(false);

  // The rank they can start on is the receiving department's ladder, not a flat
  // list of every rank in the community — the original offered all of them,
  // which let you post a Fire Chief into the Highway Patrol.
  const options = useMemo(
    () => ranksFor(ticket?.toDept).map((rank) => ({ value: rank.label, label: rank.label })),
    [ticket?.toDept],
  );

  return (
    <Modal open={open} onClose={onClose} title="Process this transfer">
      <p className="text-sm leading-relaxed text-slate-300">
        Both departments have signed. This completes the move and records what{" "}
        {ticket?.memberName} starts on with {departmentLabel(ticket?.toDept)}.
      </p>

      <Field label="Starting rank" required className="mt-4">
        <Select
          value={assignedRank}
          options={options}
          placeholder="Pick a rank"
          onChange={setAssignedRank}
        />
      </Field>

      <Field label="Employment" className="mt-4">
        <Select value={employmentType} options={EMPLOYMENT_TYPES.map((t) => ({ value: t.id, label: t.label }))} onChange={setEmploymentType} />
      </Field>

      <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={retiredMember}
          onChange={(e) => setRetiredMember(e.target.checked)}
          className="size-4 accent-brand-500"
        />
        Mark them retired with {departmentAbbr(ticket?.fromDept)}
      </label>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => onConfirm({ assignedRank, employmentType, retiredMember })}
          disabled={busy || !assignedRank}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Complete transfer
        </Button>
      </div>
    </Modal>
  );
}
