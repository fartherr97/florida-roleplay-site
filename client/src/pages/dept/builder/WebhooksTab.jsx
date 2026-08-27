import { useState } from "react";
import { Check } from "lucide-react";
import Card from "../../../components/ui/Card";
import Field from "../../../components/ui/Field";
import { TextInput } from "../../../components/ui/TextInput";
import { useDeptConfig } from "../../../context/useDeptConfig";
import TabIntro from "./TabIntro";

const WEBHOOK_RE = /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\//;

/**
 * Discord webhooks. Today one hook is wired: the Emergency-Services admin log
 * posts each newly-filed entry to a channel. The URL is a write credential for
 * that channel, so it is stored server-side and only ever shown to someone who
 * can manage the site — which is exactly who can open this tab.
 */
export default function WebhooksTab({ config }) {
  const { mutate } = useDeptConfig();
  const hook = config.webhooks?.adminlog ?? {};

  const set = (changes) =>
    mutate((current) => ({
      ...current,
      webhooks: {
        ...(current.webhooks ?? {}),
        adminlog: { ...(current.webhooks?.adminlog ?? {}), ...changes },
      },
    }));

  // The URL is kept in local state and only committed when it is blank or a
  // valid Discord webhook URL, so a half-typed address never trips the
  // server-side validation on the debounced autosave.
  const [url, setUrl] = useState(hook.url ?? "");
  const urlValid = url === "" || WEBHOOK_RE.test(url);
  const onUrl = (value) => {
    setUrl(value);
    if (value === "" || WEBHOOK_RE.test(value)) set({ url: value });
  };

  return (
    <>
      <TabIntro title="Webhooks">
        Point the department's Emergency-Services admin log at a Discord channel and every entry
        filed on the Admin Log page is posted there automatically. The webhook URL never leaves the
        server — it is shown here only because you can manage this site.
      </TabIntro>

      <Card className="max-w-2xl space-y-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">Admin log → Discord</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Posts promotions, commendations and discipline as they are filed.
            </p>
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={!!hook.enabled}
              onChange={(e) => set({ enabled: e.target.checked })}
              className="size-4 accent-[var(--dept-accent)]"
            />
            Enabled
          </label>
        </div>

        <Field
          label="Webhook URL"
          htmlFor="wh-url"
          hint="Discord → Channel → Integrations → Webhooks → Copy Webhook URL."
        >
          <TextInput
            id="wh-url"
            value={url}
            onChange={(e) => onUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/…"
          />
        </Field>
        {!urlValid && (
          <p className="text-xs text-rose-300">
            That isn't a Discord webhook URL, so it hasn't been saved yet.
          </p>
        )}
        {urlValid && url !== "" && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-300">
            <Check className="size-3.5" />
            Saved. New admin-log entries will post to this channel when enabled.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bot name" htmlFor="wh-name" hint="Optional — overrides the webhook's name.">
            <TextInput
              id="wh-name"
              value={hook.botName ?? ""}
              onChange={(e) => set({ botName: e.target.value })}
              placeholder={config.branding.shortName}
            />
          </Field>
          <Field label="Avatar URL" htmlFor="wh-avatar" hint="Optional — a link to an image.">
            <TextInput
              id="wh-avatar"
              value={hook.avatarUrl ?? ""}
              onChange={(e) => set({ avatarUrl: e.target.value })}
              placeholder="https://…"
            />
          </Field>
        </div>
      </Card>
    </>
  );
}
