import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { TextInput } from "../ui/TextInput";
import { api } from "../../lib/api";
import { SITE } from "../../data/mockData";
import { cn } from "../../lib/cn";

/**
 * Chat panel for the server's rules assistant. Messages post to /api/assistant,
 * which returns a canned reply until a real model is wired up behind it.
 */
export default function AssistantModal({ open, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: `Hey! I'm ${SITE.assistantName}. Ask me anything about the rules, applications or getting whitelisted.`,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  const send = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setDraft("");
    setSending(true);
    try {
      const { reply } = await api.assistant(text);
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Ask ${SITE.assistantName}`}
      subtitle="Rules, applications and getting started"
      className="max-w-xl"
    >
      <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={cn(
              "flex",
              message.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <p
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                message.role === "user"
                  ? "bg-primary-500/15 text-slate-100 ring-1 ring-inset ring-primary-400/20"
                  : "bg-white/[0.04] text-slate-300 ring-1 ring-inset ring-white/10",
              )}
            >
              {message.text}
            </p>
          </div>
        ))}
        {sending && (
          <p className="text-xs text-slate-500">{SITE.assistantName} is typing…</p>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="mt-5 flex items-center gap-2">
        <TextInput
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about a rule…"
          aria-label="Message the assistant"
        />
        <Button type="submit" size="md" disabled={sending || !draft.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </Modal>
  );
}
