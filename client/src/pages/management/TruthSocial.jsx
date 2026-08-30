import { useEffect, useMemo, useState } from "react";
import { Megaphone, Send, Link2, Check, Loader2 } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import { TextInput, TextArea } from "../../components/ui/TextInput";
import { api } from "../../lib/api";

const SITE_NAME = "Florida Roleplay";
const MAX_TITLE = 256;
const MAX_BODY = 4000;

/**
 * Broadcast — a composer that posts a community announcement to a Discord channel
 * through a webhook, pinging @here above an embed. Ownership only (truthsocial.post).
 * The right pane mirrors, as closely as the web can, how the message will land in
 * Discord so there are no surprises before it goes out.
 */
export default function TruthSocial() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [savedWebhook, setSavedWebhook] = useState("");

  const [savingHook, setSavingHook] = useState(false);
  const [hookMsg, setHookMsg] = useState(null); // {tone, text}
  const [posting, setPosting] = useState(false);
  const [postMsg, setPostMsg] = useState(null);

  useEffect(() => {
    let active = true;
    api
      .truthSocialConfig()
      .then((r) => {
        if (!active) return;
        setWebhookUrl(r.webhookUrl ?? "");
        setSavedWebhook(r.webhookUrl ?? "");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const hasWebhook = Boolean(savedWebhook);
  const webhookDirty = webhookUrl.trim() !== savedWebhook;
  const canPost = body.trim().length > 0 && hasWebhook && !posting;

  const saveWebhook = async () => {
    setSavingHook(true);
    setHookMsg(null);
    try {
      const r = await api.saveTruthSocialWebhook(webhookUrl.trim());
      setSavedWebhook(r.webhookUrl ?? "");
      setWebhookUrl(r.webhookUrl ?? "");
      setHookMsg({ tone: "ok", text: r.webhookUrl ? "Webhook saved." : "Webhook cleared." });
    } catch (err) {
      setHookMsg({ tone: "err", text: err?.message ?? "Couldn't save the webhook." });
    } finally {
      setSavingHook(false);
    }
  };

  const send = async () => {
    setPosting(true);
    setPostMsg(null);
    try {
      await api.sendTruthSocialPost({ title: title.trim() || undefined, body: body.trim() });
      setPostMsg({ tone: "ok", text: "Posted to the channel." });
      setTitle("");
      setBody("");
    } catch (err) {
      setPostMsg({ tone: "err", text: err?.message ?? "Couldn't send the post." });
    } finally {
      setPosting(false);
    }
  };

  return (
    <Section>
      <PageHeader
        eyebrow="Management"
        title="Broadcast"
        subtitle="Write a post and send it to the Discord channel — it pings @here above an embed."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Composer */}
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Megaphone className="size-4 text-rose-400" />
            Compose
          </div>

          <Field label="Title (optional)" htmlFor="ts-title">
            <TextInput
              id="ts-title"
              value={title}
              maxLength={MAX_TITLE}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A headline for the embed"
            />
          </Field>

          <Field label="Post" htmlFor="ts-body" required>
            <TextArea
              id="ts-body"
              rows={8}
              value={body}
              maxLength={MAX_BODY}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What's happening?"
            />
          </Field>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Pings @here above the embed.</span>
            <span>{body.length}/{MAX_BODY}</span>
          </div>

          {postMsg && (
            <p className={postMsg.tone === "ok" ? "text-sm text-emerald-300" : "text-sm text-rose-300"}>
              {postMsg.text}
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            {!hasWebhook && (
              <span className="text-xs text-amber-300">Set a webhook below before posting.</span>
            )}
            <Button className="ml-auto" onClick={send} disabled={!canPost}>
              {posting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {posting ? "Posting…" : "Post"}
            </Button>
          </div>
        </Card>

        {/* Live preview */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Live preview
          </p>
          <DiscordPreview title={title} body={body} />
        </div>
      </div>

      {/* Webhook settings */}
      <Card className="mt-6 space-y-3 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Link2 className="size-4 text-slate-400" />
          Channel webhook
        </div>
        <p className="text-sm text-slate-400">
          Create a webhook on the target Discord channel (Channel settings → Integrations →
          Webhooks) and paste its URL here. It is stored on the server and reused for every post.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextInput
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/…"
            className="flex-1"
          />
          <Button variant="secondary" onClick={saveWebhook} disabled={savingHook || !webhookDirty}>
            {savingHook ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {savingHook ? "Saving…" : "Save"}
          </Button>
        </div>
        {hookMsg && (
          <p className={hookMsg.tone === "ok" ? "text-sm text-emerald-300" : "text-sm text-rose-300"}>
            {hookMsg.text}
          </p>
        )}
        {hasWebhook && !hookMsg && (
          <p className="text-xs text-slate-500">A webhook is configured. Posts go to its channel.</p>
        )}
      </Card>
    </Section>
  );
}

/** A close-enough render of how the webhook message lands in Discord. */
function DiscordPreview({ title, body }) {
  const now = useMemo(
    () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    // Recomputed on each render is fine; the clock in a preview need not tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="rounded-xl bg-[#313338] p-4 ring-1 ring-inset ring-black/40">
      <div className="flex gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-rose-500/90 text-sm font-black text-white">
          FL
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{SITE_NAME}</span>
            <span className="rounded bg-indigo-500 px-1 py-px text-[9px] font-bold uppercase leading-none text-white">
              App
            </span>
            <span className="text-[11px] text-[#949ba4]">Today at {now}</span>
          </div>

          {/* @here ping line, above the embed */}
          <div className="mt-1 text-sm text-[#dbdee1]">
            <span className="rounded bg-[#3f4248] px-1 font-medium text-[#c9cdfb]">@here</span>
          </div>

          {/* The embed */}
          <div className="mt-1.5 max-w-lg overflow-hidden rounded border-l-4 border-[#2f81f7] bg-[#2b2d31]">
            <div className="p-3">
              <p className="text-xs font-semibold text-[#dbdee1]">{SITE_NAME}</p>
              {title.trim() && (
                <p className="mt-1 text-[15px] font-bold text-white">{title}</p>
              )}
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#dbdee1]">
                {body.trim() ? body : <span className="text-[#949ba4]">Your post will appear here…</span>}
              </p>
              <p className="mt-2 text-[11px] text-[#949ba4]">
                {SITE_NAME} · Today at {now}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
