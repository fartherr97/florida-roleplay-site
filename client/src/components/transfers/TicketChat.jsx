import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Lock, Send } from "lucide-react";
import Button from "../ui/Button";
import { TextArea } from "../ui/TextInput";
import { cn } from "../../lib/cn";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/format";

const THREADS = [
  { id: "public", label: "Discussion", internal: false },
  { id: "internal", label: "Staff only", internal: true },
];

/**
 * The two threads on a ticket.
 *
 * They are tabs rather than the original's side-by-side panels: side by side
 * works on a director's monitor and nowhere else, and the thing that must never
 * happen here is typing into the wrong one. One thread visible at a time, with
 * the staff-only one marked in amber the whole time it is open, makes that
 * mistake hard to make.
 *
 * The server decides what comes back — the internal thread is filtered out of
 * the query for anybody who may not see it, not hidden here.
 */
export default function TicketChat({ ticketId, canInternal, meId }) {
  const [thread, setThread] = useState("public");
  const [state, setState] = useState({ key: null, messages: [] });
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);

  const load = useCallback(
    (signal) =>
      api
        .transferMessages(ticketId)
        .then((data) => {
          if (!signal?.aborted) setState({ key: ticketId, messages: data.messages ?? [] });
        })
        .catch(() => {
          if (!signal?.aborted) setState({ key: ticketId, messages: [] });
        }),
    [ticketId],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    // Polled rather than pushed. A transfer conversation is two or three people
    // over a day, so a websocket would be a lot of moving parts for a thread
    // that changes a handful of times.
    const timer = setInterval(() => load(controller.signal), 10_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load]);

  const internal = thread === "internal";
  const visible = (state.key === ticketId ? state.messages : []).filter((m) => Boolean(m.internal) === internal);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [visible.length, thread]);

  async function send(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      const result = await api.postTransferMessage(ticketId, body, internal);
      if (result?.ok) {
        setDraft("");
        setState((prev) => ({ ...prev, messages: [...prev.messages, result.message] }));
      } else {
        setError(result?.message ?? "That message was not posted.");
      }
    } catch (err) {
      setError(err?.message ?? "That message was not posted.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      {canInternal && (
        <div className="mb-4 flex gap-2">
          {THREADS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setThread(entry.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition",
                thread === entry.id
                  ? entry.internal
                    ? "bg-amber-500/15 text-amber-200 ring-amber-400/40"
                    : "bg-brand-500/15 text-white ring-brand-400/40"
                  : "bg-black/20 text-slate-400 ring-white/[0.06] hover:text-white",
              )}
            >
              {entry.internal && <Lock className="size-3.5" />}
              {entry.label}
            </button>
          ))}
        </div>
      )}

      {internal && (
        <p className="mb-3 rounded-xl bg-amber-500/[0.07] px-3 py-2 text-xs leading-relaxed text-amber-200 ring-1 ring-inset ring-amber-400/25">
          Only the two departments on this transfer read this thread. The member does not.
        </p>
      )}

      <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
        {visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            {internal ? "No staff notes yet." : "Nothing said yet."}
          </p>
        ) : (
          visible.map((message) => (
            <article key={message.id} className={cn("flex gap-3", message.authorId === meId && "flex-row-reverse")}>
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[0.7rem] font-bold text-slate-300">
                {initials(message.authorName)}
              </span>
              <div className={cn("min-w-0 max-w-[85%]", message.authorId === meId && "text-right")}>
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-300">{message.authorName}</span>
                  {" · "}
                  {formatDateTime(message.createdAt)}
                </p>
                <p
                  className={cn(
                    "mt-1 inline-block whitespace-pre-line break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed text-left ring-1 ring-inset",
                    message.internal
                      ? "bg-amber-500/[0.07] text-amber-100 ring-amber-400/20"
                      : "bg-white/[0.04] text-slate-200 ring-white/[0.06]",
                  )}
                >
                  {message.body}
                </p>
              </div>
            </article>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="mt-4">
        <TextArea
          rows={2}
          value={draft}
          disabled={sending}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={internal ? "A note for the other department…" : "Write a message…"}
          onKeyDown={(e) => {
            // Enter sends, shift+Enter breaks the line — the convention every
            // chat box in Discord and elsewhere already trained people on.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(e);
            }
          }}
        />
        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
        <div className="mt-2 flex justify-end">
          <Button type="submit" size="sm" disabled={sending || !draft.trim()}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}

function initials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  );
}
