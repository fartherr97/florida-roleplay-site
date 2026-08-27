import { useEffect, useRef, useState } from "react";
import { CornerUpLeft, Loader2, Send, Sparkles, X } from "lucide-react";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { TextArea } from "../ui/TextInput";
import { cn } from "../../lib/cn";
import { toneTile } from "../../lib/tones";
import { formatDateTime } from "../../lib/format";

/**
 * A staff name reads by its role, the way the team's Discord does — so an owner
 * answering and a trial mod answering are told apart at a glance. The colour is
 * derived from the role string, so a newly named rank gets a stable colour with
 * nothing to wire up. Members (no role) stay neutral.
 */
const ROLE_TONES = ["brand", "green", "violet", "primary", "amber", "rose"];
const NAME_TEXT = {
  brand: "text-brand-300",
  green: "text-emerald-300",
  violet: "text-violet-300",
  primary: "text-primary-300",
  amber: "text-amber-300",
  rose: "text-rose-300",
  slate: "text-white",
};

function roleTone(role) {
  if (!role) return "slate";
  let hash = 0;
  for (const char of String(role)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ROLE_TONES[hash % ROLE_TONES.length];
}

/**
 * The conversation on a ticket.
 *
 * A greeting opens every thread so a member who has just opened one sees an
 * answer waiting rather than their own message alone. Bubbles hug their text
 * the way a chat app does, names read by role, and internal notes sit inline,
 * badged — that is how the team's portal shows them, and threading a staff note
 * next to the message it is about is most of its value. The safety is in the
 * composer: the note toggle recolours the whole box amber while it is on, so the
 * state you are typing in is impossible to miss.
 *
 * What is *not* a UI decision: an internal note never reaches a member's browser
 * at all. The server drops them from the query.
 */
export default function TicketThread({
  messages,
  meId,
  canInternal,
  greetingName,
  viewers = [],
  onTyping,
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
  const present = viewers.filter(Boolean);
  const typers = present.filter((v) => v.typing && !v.self);

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
      {present.length > 0 && (
        <div className="mb-4 flex items-center gap-2 border-b border-white/[0.06] pb-3">
          <div className="flex -space-x-2">
            {present.slice(0, 5).map((v) => (
              <Avatar key={v.discordId} name={v.name} avatar={v.avatar} className="ring-2 ring-[#0d1220]" />
            ))}
          </div>
          <p className="text-xs text-slate-400">
            {present.length === 1 && present[0].self
              ? "Only you are here"
              : `${present.length} viewing`}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* The system greeting opens every thread. */}
        <div className="rounded-2xl bg-white/[0.03] px-4 py-3.5 text-sm leading-relaxed text-slate-300 ring-1 ring-inset ring-white/[0.06]">
          <p className="mb-1 flex items-center gap-1.5 text-[0.66rem] font-bold uppercase tracking-[0.14em] text-primary-400">
            <Sparkles className="size-3.5" />
            Support
          </p>
          Hi <span className="font-semibold text-white">{greetingName || "there"}</span>, we&apos;ve
          received your ticket. A staff member will review it and respond here as soon as possible. If
          you have extra details, screenshots or clips, add them here anytime.
        </div>

        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            quoted={message.replyToId ? byId[message.replyToId] : null}
            mine={message.authorId === meId}
            onReply={() => setReplyTo(message)}
          />
        ))}
        <div ref={endRef} />
      </div>

      {typers.length > 0 && (
        <div className="mt-3 flex items-center gap-2.5 text-xs text-slate-400">
          <Avatar name={typers[0].name} avatar={typers[0].avatar} size="sm" />
          <span>
            {typers.length === 1
              ? `${typers[0].name} is typing`
              : `${typers.length} people are typing`}
          </span>
          <TypingDots />
        </div>
      )}

      {!disabled && (
        <form
          onSubmit={send}
          className={cn(
            "mt-5 rounded-2xl p-4 ring-1 ring-inset transition-colors",
            internal ? "bg-amber-500/[0.06] ring-amber-400/30" : "bg-black/20 ring-white/[0.06]",
          )}
        >
          <div className="mb-2.5 flex items-center gap-3">
            {canInternal ? (
              <button
                type="button"
                onClick={() => setInternal((v) => !v)}
                aria-pressed={internal}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.66rem] font-bold uppercase tracking-[0.12em] ring-1 ring-inset transition",
                  internal
                    ? "bg-amber-500/15 text-amber-200 ring-amber-400/40"
                    : "bg-white/[0.03] text-slate-400 ring-white/10 hover:text-slate-200",
                )}
              >
                <span className={cn("size-1.5 rounded-full", internal ? "bg-amber-400" : "bg-slate-600")} />
                Internal reply {internal ? "on" : "off"}
              </button>
            ) : (
              <span />
            )}
            <span className="ml-auto text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-slate-600">
              {present.length || 1} viewing
            </span>
          </div>

          {replyTo && (
            <div className="mb-3 flex items-start gap-2 rounded-xl bg-black/30 px-3 py-2 text-xs">
              <CornerUpLeft className="mt-0.5 size-3.5 shrink-0 text-slate-500" />
              <p className="min-w-0 flex-1 truncate text-slate-400">
                <span className="font-semibold text-slate-300">{replyTo.authorName}</span> {replyTo.body}
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
            onChange={(e) => {
              onDraftChange(e.target.value);
              onTyping?.();
            }}
            placeholder={internal ? "A note the member will not see…" : "Type a message…"}
            className="bg-transparent"
          />

          {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

          <div className="mt-3 flex justify-end">
            <Button type="submit" size="sm" disabled={sending || !draft.trim()}>
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
  const tone = message.internal ? "amber" : roleTone(message.authorRole);
  return (
    <article className="group flex gap-3">
      <Avatar name={message.authorName} avatar={message.authorAvatar} tone={tone} className="mt-0.5" />

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-xs">
          <span className={cn("font-bold", NAME_TEXT[tone] ?? "text-white")}>{message.authorName}</span>
          {message.authorRole && (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide ring-1 ring-inset",
                toneTile(tone),
              )}
            >
              {message.authorRole}
            </span>
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

        {/* The bubble hugs its text rather than spanning the column, the way a
            chat app reads — a one-word reply is a one-word bubble. */}
        <div
          className={cn(
            "mt-1.5 w-fit max-w-full whitespace-pre-line break-words rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm leading-relaxed ring-1 ring-inset",
            message.internal
              ? "bg-amber-500/[0.06] text-amber-100 ring-amber-400/20"
              : "bg-white/[0.05] text-slate-200 ring-white/[0.06]",
          )}
        >
          {message.body}
        </div>
      </div>
    </article>
  );
}

/** A member's real Discord avatar, or their initials on a toned tile. */
function Avatar({ name, avatar, tone = "slate", size = "md", className }) {
  const box = size === "sm" ? "size-6 text-[0.6rem]" : "size-9 text-[0.7rem]";
  if (avatar) {
    return (
      <img
        src={avatar}
        alt=""
        className={cn("shrink-0 rounded-full object-cover ring-1 ring-inset ring-white/10", box, className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-bold ring-1 ring-inset",
        box,
        toneTile(tone),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** The three-dot "someone is typing" animation. */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-bounce rounded-full bg-slate-400"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

function initials(name = "") {
  return (
    name.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?"
  );
}
