import { useEffect, useRef, useState } from "react";
import { CornerUpLeft, Loader2, Lock, Send, X } from "lucide-react";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { TextArea } from "../ui/TextInput";
import { cn } from "../../lib/cn";
import { formatDateTime } from "../../lib/format";

/**
 * The conversation on a ticket.
 *
 * Internal notes sit inline, badged, rather than behind a tab — that is how the
 * team's existing portal shows them, and threading a staff note next to the
 * message it is about is most of its value. The safety is in the composer
 * instead: the note toggle recolours the whole box amber while it is on, so the
 * state you are typing in is impossible to miss.
 *
 * What is *not* a UI decision: an internal note never reaches a member's
 * browser at all. The server drops them from the query.
 */
export default function TicketThread({
  messages,
  meId,
  canInternal,
  onSend,
  disabled = false,
  composerRef,
  draft,
  onDraftChange,
}) {
  const [internal, setInternal] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  const byId = Object.fromEntries(messages.map((m) => [m.id, m]));

  async function send(event) {
    event?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    const result = await onSend({ body, internal, replyToId: replyTo?.id ?? null });
    setSending(false);
    if (result?.ok) {
      onDraftChange("");
      setReplyTo(null);
    } else {
      setError(result?.message ?? "That message was not posted.");
    }
  }

  return (
    <div>
      <div className="space-y-5">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Nothing here yet.</p>
        ) : (
          messages.map((message) => (
            <Message
              key={message.id}
              message={message}
              quoted={message.replyToId ? byId[message.replyToId] : null}
              mine={message.authorId === meId}
              onReply={() => setReplyTo(message)}
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      {!disabled && (
        <form
          onSubmit={send}
          className={cn(
            "mt-6 rounded-2xl p-4 ring-1 ring-inset transition-colors",
            internal ? "bg-amber-500/[0.06] ring-amber-400/30" : "bg-black/20 ring-white/[0.06]",
          )}
        >
          {replyTo && (
            <div className="mb-3 flex items-start gap-2 rounded-xl bg-black/30 px-3 py-2 text-xs">
              <CornerUpLeft className="mt-0.5 size-3.5 shrink-0 text-slate-500" />
              <p className="min-w-0 flex-1 truncate text-slate-400">
                <span className="font-semibold text-slate-300">{replyTo.authorName}</span>{" "}
                {replyTo.body}
              </p>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label="Cancel reply"
                className="shrink-0 text-slate-500 transition hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          <TextArea
            ref={composerRef}
            rows={3}
            value={draft}
            disabled={sending}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder={internal ? "A note the member will not see…" : "Write a reply…"}
            className="bg-transparent"
          />

          {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {canInternal && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                  className="size-4 accent-amber-500"
                />
                <Lock className="size-3.5 text-amber-400" />
                Internal note
              </label>
            )}
            <Button type="submit" size="sm" className="ml-auto" disabled={sending || !draft.trim()}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {internal ? "Add note" : "Send"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Message({ message, quoted, mine, onReply }) {
  return (
    <article className="group flex gap-3">
      <span
        className={cn(
          "mt-0.5 grid size-9 shrink-0 place-items-center rounded-full text-[0.7rem] font-bold ring-1 ring-inset",
          message.internal
            ? "bg-amber-500/10 text-amber-300 ring-amber-400/25"
            : "bg-white/[0.06] text-slate-300 ring-white/10",
        )}
      >
        {initials(message.authorName)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-white">{message.authorName}</span>
          {message.authorRole && (
            <span className="text-slate-500">{message.authorRole}</span>
          )}
          {message.internal && <Badge tone="amber">Internal</Badge>}
          {mine && <Badge tone="slate">You</Badge>}
          <span className="text-slate-600">{formatDateTime(message.createdAt)}</span>
          <button
            type="button"
            onClick={onReply}
            className="ml-auto text-slate-600 opacity-0 transition hover:text-white focus:opacity-100 group-hover:opacity-100"
          >
            Reply
          </button>
        </p>

        {quoted && (
          <div className="mt-2 border-l-2 border-white/15 pl-3">
            <p className="text-xs font-semibold text-slate-400">{quoted.authorName}</p>
            <p className="truncate text-xs text-slate-500">{quoted.body}</p>
          </div>
        )}

        <div
          className={cn(
            "mt-2 whitespace-pre-line break-words rounded-2xl px-4 py-3 text-sm leading-relaxed ring-1 ring-inset",
            message.internal
              ? "bg-amber-500/[0.06] text-amber-100 ring-amber-400/20"
              : "bg-white/[0.04] text-slate-200 ring-white/[0.06]",
          )}
        >
          {message.body}
        </div>
      </div>
    </article>
  );
}

function initials(name = "") {
  return (
    name.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?"
  );
}
