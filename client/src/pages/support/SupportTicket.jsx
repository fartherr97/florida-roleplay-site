import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, GitBranch, Info, Link2, MessageSquare, UserPlus } from "lucide-react";
import Section from "../../components/layout/Section";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import NotFound from "../../components/auth/NotFound";
import AccessDenied from "../../components/auth/AccessDenied";
import TicketThread from "../../components/support/TicketThread";
import FlowRunner from "../../components/support/FlowRunner";
import ReassignDialog from "../../components/support/ReassignDialog";
import { api, ApiForbiddenError } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { cn } from "../../lib/cn";
import { formatDateTime, relativeTime } from "../../lib/format";
import {
  PRIORITIES,
  PRIORITY_MAP,
  TICKET_STATUSES,
  isTicketOpen,
  statusLabel,
  statusTone,
  ticketAge,
} from "../../lib/support";
import { useSupportConfig } from "../../context/useSupportConfig";

/**
 * One ticket, as a single focused column.
 *
 * The controls that an agent reaches for — the status, the hand-off, the flow —
 * sit in a compact toolbar directly under the subject rather than in a rail off
 * to the side, so on a phone they are the first thing under the header instead
 * of buried beneath the whole conversation. The heavier tools (priority, the
 * intake fields, the history) fold away behind Info until they are wanted.
 *
 * A member sees the same page without any of it: the status, and the thread.
 */
export default function SupportTicket() {
  const { id } = useParams();
  const { user } = useAuth();
  const [state, setState] = useState({ key: null, data: undefined, denied: false });
  const [messages, setMessages] = useState([]);
  const [flows, setFlows] = useState([]);
  const [draft, setDraft] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [panel, setPanel] = useState(null); // "info" | "flow" | null
  const [copied, setCopied] = useState(false);
  const [viewers, setViewers] = useState([]);
  const composerRef = useRef(null);
  const typingUntilRef = useRef(0);
  const beatRef = useRef(null);

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

  // Live presence: beat a heartbeat while the ticket is open, carrying the
  // typing state, and take the returned roster as who is here now. Polled — no
  // socket — so a closed tab ages out in half a minute rather than lingering.
  const canPresence = state.key === id && !state.denied && Boolean(ticket);
  useEffect(() => {
    if (!canPresence) return undefined;
    let active = true;
    const beat = async () => {
      const typing = Date.now() < typingUntilRef.current;
      try {
        const res = await api.supportPresence(id, { typing });
        if (active && res?.viewers) setViewers(res.viewers);
      } catch {
        /* best-effort */
      }
    };
    beatRef.current = beat;
    beat();
    const timer = setInterval(beat, 5_000);
    return () => {
      active = false;
      clearInterval(timer);
      beatRef.current = null;
      api.supportPresence(id, { leaving: true }).catch(() => {});
    };
  }, [id, canPresence]);

  // Announce typing right away the first time, then let the heartbeat carry it;
  // the flag decays on its own after a few quiet seconds.
  const markTyping = useCallback(() => {
    const wasTyping = Date.now() < typingUntilRef.current;
    typingUntilRef.current = Date.now() + 4_000;
    if (!wasTyping) beatRef.current?.();
  }, []);

  const { typeMap } = useSupportConfig();
  const type = useMemo(() => (ticket ? typeMap[ticket.type] : null), [ticket, typeMap]);

  if (state.key !== id) {
    return (
      <Section className="max-w-4xl">
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

  function copyLink() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    navigator?.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {},
    );
  }

  const togglePanel = (name) => setPanel((prev) => (prev === name ? null : name));
  const age = ticketAge(ticket);
  const mine = ticket.assignedToDiscordId === user?.id;
  const hasDetails = Object.keys(ticket.details ?? {}).length > 0;

  return (
    <Section className="max-w-4xl">
      <Button as={Link} to={can.work ? "/support/queue" : "/support"} variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="size-4" />
        {can.work ? "Back to the queue" : "My tickets"}
      </Button>

      {/* Header: the reference, the state, and what it is about. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-300 ring-1 ring-inset ring-white/[0.06]">
          <MessageSquare className="size-3" />
          Ticket #{ticket.id}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(ticket.status)} dot>
            {statusLabel(ticket.status)}
          </Badge>
          {isTicketOpen(ticket.status) && <Badge tone={age.tone}>{age.label}</Badge>}
          {ticket.priority !== "normal" && (
            <Badge tone={PRIORITY_MAP[ticket.priority]?.tone}>{PRIORITY_MAP[ticket.priority]?.label}</Badge>
          )}
        </div>
      </div>

      <h1 className="text-2xl font-black tracking-tight text-white">{ticket.subject}</h1>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
        <Badge tone={type?.tone ?? "slate"}>{type?.label ?? ticket.type}</Badge>
        <span>Opened by {ticket.openedByName}</span>
        <span>·</span>
        <span>{formatDateTime(ticket.createdAt)}</span>
        {ticket.lastMessageAt && ticket.lastMessageAt !== ticket.createdAt && (
          <>
            <span>·</span>
            <span>Updated {relativeTime(ticket.lastMessageAt)}</span>
          </>
        )}
      </p>

      {/* The staff toolbar — the controls, on top, where a phone can reach them. */}
      {can.work ? (
        <Card className="mt-5 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[12rem] flex-1">
              <Select
                value={ticket.status}
                options={TICKET_STATUSES.map((s) => ({ value: s.id, label: s.label }))}
                onChange={(status) => patch({ status })}
              />
            </div>
            {can.lead ? (
              <Button variant="secondary" size="sm" onClick={() => setAssigning(true)}>
                <UserPlus className="size-4" />
                Reassign
              </Button>
            ) : mine ? (
              <Button variant="ghost" size="sm" onClick={() => patch({ assign: "none" })}>
                Release
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => patch({ assign: "me" })}>
                <UserPlus className="size-4" />
                Take it
              </Button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-white/[0.06] pt-3">
            <ToolButton icon={copied ? Check : Link2} label={copied ? "Copied" : "Link"} onClick={copyLink} active={copied} />
            <ToolButton icon={Info} label="Info" onClick={() => togglePanel("info")} active={panel === "info"} />
            <ToolButton icon={GitBranch} label="Response flowchart" onClick={() => togglePanel("flow")} active={panel === "flow"} />
          </div>

          {panel === "info" && (
            <div className="mt-3 space-y-5 border-t border-white/[0.06] pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Priority">
                  <Select
                    value={ticket.priority}
                    options={PRIORITIES.map((p) => ({ value: p.id, label: p.label }))}
                    onChange={(priority) => patch({ priority })}
                  />
                </Field>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Assigned to</p>
                  <p className={cn("text-sm", ticket.assignedToName ? "text-white" : "text-slate-500")}>
                    {ticket.assignedToName ?? "Nobody yet"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!mine && (
                      <Button size="sm" variant="ghost" onClick={() => patch({ assign: "me" })}>
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
                        Reassign
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {hasDetails && (
                <div>
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
                </div>
              )}

              {(ticket.history ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">History</p>
                  <ol className="mt-3 space-y-2.5">
                    {ticket.history.map((entry, index) => (
                      <li key={index} className="text-xs">
                        <p className="text-slate-300">
                          <span className="font-semibold capitalize text-white">{entry.action}</span> {entry.details}
                        </p>
                        <p className="text-slate-600">
                          {entry.actor} · {formatDateTime(entry.at)}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}

          {panel === "flow" && (
            <div className="mt-3 border-t border-white/[0.06] pt-4">
              <FlowRunner flows={flows} ticket={ticket} agent={user} onInsert={insertReply} />
            </div>
          )}
        </Card>
      ) : (
        <Card className="mt-5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm leading-relaxed text-slate-400">
                {TICKET_STATUSES.find((s) => s.id === ticket.status)?.detail}
              </p>
              {ticket.assignedToName && (
                <p className="mt-1 text-sm text-slate-400">
                  Being handled by <span className="font-semibold text-white">{ticket.assignedToName}</span>
                </p>
              )}
            </div>
            {hasDetails && <ToolButton icon={Info} label="Details" onClick={() => togglePanel("info")} active={panel === "info"} />}
          </div>
          {panel === "info" && hasDetails && (
            <dl className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
              {(type?.fields ?? []).map((field) =>
                ticket.details[field.id] ? (
                  <div key={field.id}>
                    <dt className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-500">{field.label}</dt>
                    <dd className="mt-0.5 break-words text-sm text-slate-200">{ticket.details[field.id]}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          )}
        </Card>
      )}

      {/* The conversation. */}
      <Card className="mt-5 p-5 sm:p-6">
        <TicketThread
          messages={messages}
          meId={user?.id}
          canInternal={can.work}
          greetingName={ticket.openedByName}
          viewers={viewers}
          onTyping={markTyping}
          onSend={send}
          disabled={ticket.status === "closed" && !can.work}
          composerRef={composerRef}
          draft={draft}
          onDraftChange={setDraft}
        />
        {ticket.status === "closed" && !can.work && (
          <p className="mt-4 rounded-xl bg-black/25 p-3.5 text-sm text-slate-400 ring-1 ring-inset ring-white/[0.06]">
            This ticket is closed. Open a new one and quote <code className="text-slate-300">{ticket.id}</code> if you
            need to pick it back up.
          </p>
        )}
      </Card>

      <ReassignDialog
        key={assigning ? "open" : "closed"}
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

function ToolButton({ icon: Icon, label, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
        active ? "bg-white/[0.06] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-white",
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

