import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, MessageSquare, UserPlus } from "lucide-react";
import Section from "../../components/layout/Section";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import NotFound from "../../components/auth/NotFound";
import AccessDenied from "../../components/auth/AccessDenied";
import TicketThread from "../../components/support/TicketThread";
import { api, ApiForbiddenError } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { cn } from "../../lib/cn";
import { formatDateTimeLocal, relativeTime } from "../../lib/format";
import {
  DEFAULT_REQUEST_TYPES,
  DEV_PRIORITIES,
  DEV_PRIORITY_MAP,
  DEV_STATUSES,
  devStatusLabel,
  devStatusTone,
  isDevOpen,
  requestTypeMapOf,
} from "../../lib/devhub";

/**
 * One development request: the conversation, and the dev team's controls in a
 * compact toolbar on top. Mirrors the support ticket view — same thread, same
 * shape — with a development vocabulary and the request's own intake fields.
 */
export default function DevRequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [state, setState] = useState({ key: null, data: undefined, denied: false });
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [types, setTypes] = useState(DEFAULT_REQUEST_TYPES);
  const composerRef = useRef(null);

  const load = useCallback(
    (signal) =>
      api
        .devRequest(id)
        .then((data) => !signal?.aborted && setState({ key: id, data, denied: false }))
        .catch((err) => !signal?.aborted && setState({ key: id, data: null, denied: err instanceof ApiForbiddenError })),
    [id],
  );
  const loadMessages = useCallback(
    (signal) => api.devMessages(id).then((d) => !signal?.aborted && setMessages(d.messages ?? [])).catch(() => {}),
    [id],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    loadMessages(controller.signal);
    const timer = setInterval(() => loadMessages(controller.signal), 12_000);
    api.devRequestTypes().then((r) => r?.types?.length && setTypes(r.types)).catch(() => {});
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load, loadMessages]);

  const request = state.data?.request ?? null;
  const can = state.data?.can ?? { work: false, manage: false };
  const type = useMemo(() => (request ? requestTypeMapOf(types)[request.type] : null), [request, types]);

  if (state.key !== id) {
    return (
      <Section className="max-w-4xl">
        <div className="h-96 animate-pulse rounded-2xl bg-white/[0.03]" />
      </Section>
    );
  }
  if (state.denied) return <AccessDenied reason="role" />;
  if (!request) return <NotFound />;

  async function send(payload) {
    const result = await api.postDevMessage(request.id, payload);
    if (result?.ok) {
      setMessages((prev) => [...prev, result.message]);
      load();
    }
    return result;
  }

  async function patch(body) {
    const result = await api.updateDevRequest(request.id, body);
    if (result?.ok) setState((prev) => ({ ...prev, data: { ...prev.data, request: result.request } }));
    return result;
  }

  const mine = request.assignedToDiscordId === user?.id;
  const details = Object.entries(request.details ?? {});

  return (
    <Section className="max-w-4xl">
      <Button as={Link} to={can.work ? "/development/queue" : "/development/requests"} variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="size-4" />
        {can.work ? "Back to the queue" : "My requests"}
      </Button>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-300 ring-1 ring-inset ring-white/[0.06]">
          <MessageSquare className="size-3" />
          Request {request.id}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={devStatusTone(request.status)} dot>
            {devStatusLabel(request.status)}
          </Badge>
          {request.priority !== "normal" && <Badge tone={DEV_PRIORITY_MAP[request.priority]?.tone}>{DEV_PRIORITY_MAP[request.priority]?.label}</Badge>}
        </div>
      </div>

      <h1 className="text-2xl font-black tracking-tight text-white">{request.subject}</h1>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
        <Badge tone={type?.tone ?? "violet"}>{type?.label ?? request.type}</Badge>
        <span>Opened by {request.openedByName}</span>
        <span>·</span>
        <span>{formatDateTimeLocal(request.createdAt)}</span>
        {request.lastMessageAt && request.lastMessageAt !== request.createdAt && (
          <>
            <span>·</span>
            <span>Updated {relativeTime(request.lastMessageAt)}</span>
          </>
        )}
      </p>

      {/* Controls + info. */}
      <Card className="mt-5 p-4">
        {can.work ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[12rem] flex-1">
              <Select
                value={request.status}
                options={DEV_STATUSES.map((s) => ({ value: s.id, label: s.label }))}
                onChange={(status) => patch({ status })}
              />
            </div>
            <div className="min-w-[9rem]">
              <Select
                value={request.priority}
                options={DEV_PRIORITIES.map((p) => ({ value: p.id, label: p.label }))}
                onChange={(priority) => patch({ priority })}
              />
            </div>
            {mine ? (
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
        ) : (
          <p className="text-sm leading-relaxed text-slate-400">
            {DEV_STATUSES.find((s) => s.id === request.status)?.detail}
            {request.assignedToName && (
              <>
                {" "}
                Being handled by <span className="font-semibold text-white">{request.assignedToName}</span>.
              </>
            )}
          </p>
        )}

        {details.length > 0 && (
          <div className="mt-3 border-t border-white/[0.06] pt-3">
            <button
              type="button"
              onClick={() => setShowInfo((v) => !v)}
              className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400 transition hover:text-white"
            >
              {showInfo ? "Hide details" : "Request details"}
            </button>
            {showInfo && (
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                {details.map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-500">
                      {type?.fields?.find((f) => f.id === key)?.label ?? key}
                    </dt>
                    <dd className="mt-0.5 break-words text-sm text-slate-200">
                      {/^https?:\/\//.test(String(value)) ? (
                        <a href={String(value)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-300 hover:underline">
                          Open link <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        String(value)
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </Card>

      <Card className="mt-5 p-5 sm:p-6">
        <TicketThread
          messages={messages}
          meId={user?.id}
          canInternal={can.work}
          greetingName={request.openedByName}
          onSend={send}
          disabled={request.status === "closed" && !can.work}
          composerRef={composerRef}
          draft={draft}
          onDraftChange={setDraft}
        />
        {!isDevOpen(request.status) && request.status !== "closed" && (
          <p className={cn("mt-4 rounded-xl bg-black/25 p-3.5 text-sm text-slate-400 ring-1 ring-inset ring-white/[0.06]")}>
            This request is {devStatusLabel(request.status).toLowerCase()}. You can still reply.
          </p>
        )}
      </Card>
    </Section>
  );
}
