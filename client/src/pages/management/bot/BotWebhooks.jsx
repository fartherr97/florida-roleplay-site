import { useState } from "react";
import { Check, Send, Trash2, Webhook, X } from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Field from "../../../components/ui/Field";
import { TextInput } from "../../../components/ui/TextInput";
import BotError from "../../../components/bot/BotError";
import Loading from "../../../components/bot/Loading";
import { useBotResource } from "../../../lib/useBotResource";
import { api } from "../../../lib/botApi";

/**
 * Log webhooks: point each kind of log at its own Discord channel.
 *
 * Every category falls back to the MOD_LOG_WEBHOOK_URL env webhook until it is given one
 * here, so nothing has to be configured for logging to work — this is only for splitting
 * logs across channels. The full URL is a secret and never leaves the server; the page
 * shows a masked preview of what is set and takes a new URL to replace it.
 */
export default function BotWebhooks() {
  const webhooks = useBotResource("/log-webhooks");
  const [error, setError] = useState(null);

  return (
    <>
      {error && <BotError error={error} className="mb-5" />}

      <div className="mb-6 flex items-start gap-2.5">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary-500/15 text-primary-300">
          <Webhook className="size-5" />
        </span>
        <div>
          <h2 className="text-base font-bold text-white">Log webhooks</h2>
          <p className="text-sm text-slate-400">
            Send each kind of log to its own Discord channel. Create a webhook on the channel
            (Server Settings → Integrations → Webhooks), copy its URL, and paste it here.
            Anything left unset uses the default log channel.
          </p>
        </div>
      </div>

      {webhooks.error ? (
        <BotError error={webhooks.error} onRetry={webhooks.reload} />
      ) : webhooks.loading ? (
        <Loading rows={2} />
      ) : (
        <div className="space-y-3">
          {(webhooks.data?.categories ?? []).map((category) => (
            <WebhookRow
              key={category.key}
              category={category}
              fallbackConfigured={webhooks.data?.fallbackConfigured}
              onError={setError}
              onChanged={webhooks.reload}
            />
          ))}
        </div>
      )}
    </>
  );
}

function WebhookRow({ category, fallbackConfigured, onError, onChanged }) {
  const [url, setUrl] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tested, setTested] = useState(null);

  const run = async (fn) => {
    onError(null);
    setBusy(true);
    try {
      return await fn();
    } catch (err) {
      onError(err);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      await api(`/log-webhooks/${encodeURIComponent(category.key)}`, {
        method: "POST",
        body: { url: url.trim() },
      });
      setUrl("");
      setEditing(false);
      onChanged();
    });

  const clear = () =>
    run(async () => {
      await api(`/log-webhooks/${encodeURIComponent(category.key)}`, {
        method: "POST",
        body: { url: "" },
      });
      onChanged();
    });

  const test = () =>
    run(async () => {
      const result = await api(`/log-webhooks/${encodeURIComponent(category.key)}/test`, {
        method: "POST",
      });
      setTested(result?.delivered ? "ok" : "fail");
    });

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">{category.label}</span>
            {category.configured ? (
              <Badge tone="green" dot>
                Custom channel
              </Badge>
            ) : (
              <Badge tone="slate">{fallbackConfigured ? "Default channel" : "Not logging"}</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">{category.description}</p>
          {category.configured && (
            <code className="mt-1.5 block text-xs text-slate-500">{category.preview}</code>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {(category.configured || fallbackConfigured) && (
            <Button variant="ghost" size="sm" onClick={test} disabled={busy}>
              <Send className="size-4" />
              Test
            </Button>
          )}
          {!editing && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)} disabled={busy}>
              {category.configured ? "Replace" : "Set channel"}
            </Button>
          )}
          {category.configured && (
            <button
              type="button"
              onClick={clear}
              disabled={busy}
              aria-label={`Clear the ${category.label} webhook`}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>

      {tested && (
        <p
          className={`mt-2 flex items-center gap-1.5 text-xs ${
            tested === "ok" ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          {tested === "ok" ? <Check className="size-3.5" /> : <X className="size-3.5" />}
          {tested === "ok"
            ? "Sent — check the channel for the test message."
            : "Couldn't deliver. Double-check the webhook URL."}
        </p>
      )}

      {editing && (
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <Field
            label="Discord webhook URL"
            htmlFor={`wh-${category.key}`}
            hint="Server Settings → Integrations → Webhooks → Copy Webhook URL."
          >
            <TextInput
              id={`wh-${category.key}`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
            />
          </Field>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setUrl("");
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={busy || !url.trim()}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
