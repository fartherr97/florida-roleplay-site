import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, UserPlus } from "lucide-react";
import Section from "../../components/layout/Section";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import { TextInput } from "../../components/ui/TextInput";
import NotFound from "../../components/auth/NotFound";
import AccessDenied from "../../components/auth/AccessDenied";
import TicketThread from "../../components/support/TicketThread";
import FlowRunner from "../../components/support/FlowRunner";
import { api, ApiForbiddenError } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { formatDateTime } from "../../lib/format";
import {
  PRIORITIES,
  PRIORITY_MAP,
  TICKET_STATUSES,
  TYPE_MAP,
  statusLabel,
  statusTone,
  typeLabel,
} from "../../lib/support";

/**
 * One ticket: the conversation on the left, the controls on the right.
 *
 * The rail is staff-only and stays put while the thread scrolls, because status
 * and assignment are what an agent changes *while* reading — putting them at the
 * bottom of a long thread would mean scrolling back every time.
 *
 * A member sees the same page without the rail: their status, and the thread.
 */
export default function SupportTicket() {
  const { id } = useParams();
  const { user } = useAuth();
  const [state, setState] = useState({ key: null, data: undefined, denied: false });
  const [messages, setMessages] = useState([]);
  const [flows, setFlows] = useState([]);
  const [draft, setDraft] = useState("");
  const [assigning, setAssigning] = useState(false);
  const composerRef = useRef(null);

  const load = useCallback(
    (signal) =>
      api
        .supportTicket(id)
        .then((data) => {
          if (!signal?.aborted) setState({ key: id, data, denied: false });
        })
        .catch((err) => {
          if (!signal?.aborted) setState({ key: id, data: null, denied: err instanceof ApiForbiddenError });
        }),
    [id],
  );

  const loadMessages = useCallback(
    (signal) =>
      api
        .supportMessages(id)
        .then((data) => {
          if (!signal?.aborted) setMessages(data.messages ?? []);
        })
        .catch(() => {}),
    [id],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    loadMessages(controller.signal);
    // Polled: a support conversation is a handful of messages over hours, so a
    // socket would be a lot of moving parts for a thread that rarely changes.
    const timer = setInterval(() => loadMessages(controller.signal), 12_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load, loadMessages]);

  const ticket = state.data?.ticket ?? null;
  const can = state.data?.can ?? { work: false, lead: false };

  useEffect(() => {
    if (!can.work) return;
    let active = true;
    api.supportFlows().then((data) => active && setFlows(data.flows ?? [])).catch(() => {});
    return () => {
      active = false;
    };
  }, [can.work]);

  const type = useMemo(() => (ticket ? TYPE_MAP[ticket.type] : null), [ticket]);

  if (state.key !== id) {
    return (
      <Section className="max-w-6xl">
        <div className="h-96 animate-pulse rounded-2xl bg-white/[0.03]" />
      </Section>
    );
  }
  if (state.denied) return <AccessDenied reason="role" />;
  if (!ticket) return <NotFound />;

  async function send(payload) {
    const result = await api.postSupportMessage(ticket.id, payload);
    if (result?.ok) {
      setMessages((prev) => [...prev, result.message]);
      load();
    }
    return result;
  }

  async function patch(body) {
    const result = await api.updateSupportTicket(ticket.id, body);
    if (result?.ok) setState((prev) => ({ ...prev, data: { ...prev.data, ticket: result.ticket } }));
    return result;
  }

  function insertReply(text) {
    setDraft((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${text}` : text));
    composerRef.current?.focus();
  }

  return (
    <Section className="max-w-6xl">
      <Button as={Link} to={can.work ? "/support/queue" : "/support"} variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="size-4" />
        {can.work ? "Back to the queue" : "My tickets"}
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <div className="mb-5">
            <p className="flex flex-wrap items-center gap-2 text-xs">
              <Badge tone={type?.tone ?? "slate"}>{typeLabel(ticket.type)}</Badge>
              <Badge tone={statusTone(ticket.status)}>{statusLabel(ticket.status)}</Badge>
              {ticket.priority !== "normal" && (
                <Badge tone={PRIORITY_MAP[ticket.priority]?.tone}>{PRIORITY_MAP[ticket.priority]?.label}</Badge>
              )}
              <code className="text-slate-600">{ticket.id}</code>
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white">{ticket.subject}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Opened by {ticket.openedByName} · {formatDateTime(ticket.createdAt)}
            </p>
          </div>

          {Object.keys(ticket.details ?? {}).length > 0 && (
            <Card className="mb-6 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">On submission</p>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                {(type?.fields ?? []).map((field) =>
                  ticket.details[field.id] ? (
                    <div key={field.id}>
                      <dt className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-500">
                        {field.label}
                      </dt>
                      <dd className="mt-0.5 break-words text-sm text-slate-200">{ticket.details[field.id]}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
            </Card>
          )}

          <Card className="p-6">
            <TicketThread
              messages={messages}
              meId={user?.id}
              canInternal={can.work}
              onSend={send}
              disabled={ticket.status === "closed" && !can.work}
              composerRef={composerRef}
              draft={draft}
              onDraftChange={setDraft}
            />
            {ticket.status === "closed" && !can.work && (
              <p className="mt-4 rounded-xl bg-black/25 p-3.5 text-sm text-slate-400 ring-1 ring-inset ring-white/[0.06]">
                This ticket is closed. Open a new one and quote{" "}
                <code className="text-slate-300">{ticket.id}</code> if you need to
                pick it back up.
              </p>
            )}
          </Card>
        </div>

        {/* The rail. */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {can.work ? (
            <>
              <Card className="space-y-4 p-5">
                <Field label="Status">
                  <Select
                    value={ticket.status}
                    options={TICKET_STATUSES.map((s) => ({ value: s.id, label: s.label }))}
                    onChange={(status) => patch({ status })}
                  />
                </Field>
                <Field label="Priority">
                  <Select
                    value={ticket.priority}
                    options={PRIORITIES.map((p) => ({ value: p.id, label: p.label }))}
                    onChange={(priority) => patch({ priority })}
                  />
                </Field>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Assigned to
                  </p>
                  {ticket.assignedToName ? (
                    <p className="text-sm text-white">{ticket.assignedToName}</p>
                  ) : (
                    <p className="text-sm text-slate-500">Nobody yet</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ticket.assignedToDiscordId !== user?.id && (
                      <Button size="sm" variant="secondary" onClick={() => patch({ assign: "me" })}>
                        Take it
                      </Button>
                    )}
                    {ticket.assignedToDiscordId && (
                      <Button size="sm" variant="ghost" onClick={() => patch({ assign: "none" })}>
                        Release
                      </Button>
                    )}
                    {can.lead && (
                      <Button size="sm" variant="ghost" onClick={() => setAssigning(true)}>
                        <UserPlus className="size-4" />
                        Hand over
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              <FlowRunner flows={flows} ticket={ticket} agent={user} onInsert={insertReply} />

              <Card className="p-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">History</p>
                <ol className="mt-3 space-y-2.5">
                  {(ticket.history ?? []).map((entry, index) => (
                    <li key={index} className="text-xs">
                      <p className="text-slate-300">
                        <span className="font-semibold capitalize text-white">{entry.action}</span>{" "}
                        {entry.details}
                      </p>
                      <p className="text-slate-600">
                        {entry.actor} · {formatDateTime(entry.at)}
                      </p>
                    </li>
                  ))}
                </ol>
              </Card>
            </>
          ) : (
            <Card className="p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Status</p>
              <p className="mt-2">
                <Badge tone={statusTone(ticket.status)}>{statusLabel(ticket.status)}</Badge>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                {TICKET_STATUSES.find((s) => s.id === ticket.status)?.detail}
              </p>
              {ticket.assignedToName && (
                <p className="mt-3 text-sm text-slate-400">
                  Being handled by{" "}
                  <span className="font-semibold text-white">{ticket.assignedToName}</span>
                </p>
              )}
            </Card>
          )}
        </aside>
      </div>

      <HandOverModal
        open={assigning}
        onClose={() => setAssigning(false)}
        onConfirm={async (discordId, name) => {
          const result = await patch({ assign: { discordId, name } });
          if (result?.ok) setAssigning(false);
          return result;
        }}
      />
    </Section>
  );
}

function HandOverModal({ open, onClose, onConfirm }) {
  const [discordId, setDiscordId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState(null);

  return (
    <Modal open={open} onClose={onClose} title="Hand this ticket over">
      <p className="text-sm leading-relaxed text-slate-300">
        It moves to their queue and the change is written into the ticket's
        history with your name on it.
      </p>
      <Field label="Their Discord ID" className="mt-4">
        <TextInput
          value={discordId}
          inputMode="numeric"
          onChange={(e) => setDiscordId(e.target.value.trim())}
          className="font-mono text-sm"
        />
      </Field>
      <Field label="Their name" className="mt-4">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          disabled={!/^\d{17,20}$/.test(discordId)}
          onClick={async () => {
            const result = await onConfirm(discordId, name);
            if (!result?.ok) setError(result?.message ?? "That did not go through.");
          }}
        >
          Hand over
        </Button>
      </div>
    </Modal>
  );
}
