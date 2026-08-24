import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Send, Trash2 } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import AccessDenied from "../../components/auth/AccessDenied";
import { DeptChip } from "../../components/transfers/TicketBits";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import {
  DEFAULT_WEBHOOK,
  TRANSFER_DEPARTMENTS,
  WEBHOOK_VARIABLES,
  buildWebhookPayload,
  departmentLabel,
} from "../../lib/transferPortal";

/** A sample ticket, so the preview shows a filled-in message rather than braces. */
const SAMPLE = {
  id: "TR-SAMPLE",
  memberName: "Owen Brady",
  memberDiscordId: "402118844500000921",
  currentRank: "Senior Trooper",
  fromDept: "fhp",
  toDept: "hcso",
  reason: "Eight months on the interstate and I want the county side.",
  createdAt: "2026-04-01T20:00:00.000Z",
};

/**
 * Where each department wants to hear about new transfers.
 *
 * A webhook posts a message and nothing else, which is the right tool here: a
 * transfer is decided in this portal by two department heads, so the Discord
 * message is a notification rather than a control surface and needs no buttons.
 *
 * The URL is write-only. It never comes back from the API, because anybody
 * holding it can post into that channel as the department forever — so the page
 * shows whether one is set, not what it is.
 */
export default function TransferSettings() {
  const { hasPermission } = useAuth();
  const [webhooks, setWebhooks] = useState(null);

  useEffect(() => {
    let active = true;
    api
      .transferWebhooks()
      .then((data) => active && setWebhooks(data.webhooks ?? {}))
      .catch(() => active && setWebhooks({}));
    return () => {
      active = false;
    };
  }, []);

  if (!hasPermission("transfers.manage")) return <AccessDenied reason="role" />;

  return (
    <Section className="max-w-4xl">
      <Button as={Link} to="/transfers" variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="size-4" />
        Back to the queue
      </Button>

      <PageHeader
        eyebrow="Transfer portal"
        title="Discord notifications"
        subtitle="Each department can have a channel that hears about every transfer touching it — outgoing or incoming."
      />

      <Card className="mb-6 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
          Template variables
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {WEBHOOK_VARIABLES.map((variable) => (
            <p key={variable.key} className="text-xs text-slate-400">
              <code className="rounded bg-black/30 px-1.5 py-0.5 text-brand-300">{`{${variable.key}}`}</code>{" "}
              {variable.detail}
            </p>
          ))}
        </div>
      </Card>

      {webhooks === null ? (
        <div className="space-y-4">
          {[0, 1].map((n) => (
            <div key={n} className="h-40 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {TRANSFER_DEPARTMENTS.map((department) => (
            <DepartmentWebhook
              key={department.id}
              department={department}
              stored={webhooks[department.id] ?? DEFAULT_WEBHOOK}
            />
          ))}
        </div>
      )}
    </Section>
  );
}

function DepartmentWebhook({ department, stored }) {
  const [config, setConfig] = useState({ ...DEFAULT_WEBHOOK, ...stored, url: "" });
  const [hasUrl, setHasUrl] = useState(Boolean(stored.hasUrl));
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(null);
  const [open, setOpen] = useState(false);

  const set = (patch) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    setStatus(null);
  };

  async function save(extra = {}) {
    setBusy("save");
    setStatus(null);
    try {
      const result = await api.saveTransferWebhook(department.id, { ...config, ...extra });
      if (result?.ok) {
        setHasUrl(Boolean(result.config?.hasUrl));
        setConfig((prev) => ({ ...prev, url: "" }));
        setStatus({ tone: "green", message: result.message ?? "Saved." });
      } else {
        setStatus({ tone: "rose", message: result?.message ?? "That did not save." });
      }
    } catch (err) {
      setStatus({
        tone: "rose",
        message: err?.errors?.url ?? err?.message ?? "That did not save.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    setStatus(null);
    const result = await api.testTransferWebhook(department.id);
    setStatus({ tone: result?.ok ? "green" : "rose", message: result?.message ?? "No answer." });
    setBusy(null);
  }

  const payload = buildWebhookPayload(config, SAMPLE);
  const embed = payload.embeds[0];
  const color = `#${(embed.color ?? 0).toString(16).padStart(6, "0")}`;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-3 px-5 py-4 text-left transition hover:bg-white/[0.02]"
      >
        <DeptChip id={department.id} />
        <span className="min-w-0 flex-1 text-sm font-semibold text-white">{department.label}</span>
        {hasUrl ? <Badge tone="green" dot>Connected</Badge> : <Badge tone="slate">No channel</Badge>}
      </button>

      {open && (
        <div className="space-y-5 border-t border-white/[0.06] px-5 py-5">
          <Field
            label="Webhook URL"
            hint={
              hasUrl
                ? "One is saved. It is never sent back to the browser — paste a new one to replace it."
                : "Discord → Edit Channel → Integrations → Webhooks → Copy Webhook URL."
            }
          >
            <TextInput
              value={config.url}
              type="password"
              autoComplete="off"
              placeholder={hasUrl ? "••••••••••  (leave blank to keep)" : "https://discord.com/api/webhooks/…"}
              onChange={(e) => set({ url: e.target.value })}
              className="font-mono text-xs"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Post as" hint="Blank uses the webhook's own name.">
              <TextInput value={config.username} onChange={(e) => set({ username: e.target.value })} />
            </Field>
            <Field label="Colour" hint="Six hex digits. Blank uses the department's own.">
              <TextInput
                value={config.color}
                placeholder="#3b82f6"
                onChange={(e) => set({ color: e.target.value.trim() })}
                className="font-mono text-sm"
              />
            </Field>
          </div>

          <Field label="Title">
            <TextInput value={config.embedTitle} onChange={(e) => set({ embedTitle: e.target.value })} />
          </Field>

          <Field label="Body">
            <TextArea rows={5} value={config.embedDescription} onChange={(e) => set({ embedDescription: e.target.value })} />
          </Field>

          <Field label="Footer">
            <TextInput value={config.footer} onChange={(e) => set({ footer: e.target.value })} />
          </Field>

          {/* What Discord will show, drawn as Discord draws it. */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Preview</p>
            <div className="rounded-2xl bg-[#313338] p-4 ring-1 ring-inset ring-black/40">
              <div className="overflow-hidden rounded-[4px] bg-[#2b2d31]" style={{ borderLeft: `4px solid ${color}` }}>
                <div className="space-y-2 p-4">
                  {embed.title && <p className="text-base font-semibold text-white">{embed.title}</p>}
                  {embed.description && (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-[#dbdee1]">
                      {embed.description.replace(/\*\*(.+?)\*\*/g, "$1")}
                    </p>
                  )}
                  {embed.footer?.text && <p className="pt-1 text-[0.7rem] text-[#949ba4]">{embed.footer.text}</p>}
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Sample: a {SAMPLE.currentRank} moving from {departmentLabel(SAMPLE.fromDept)} to{" "}
              {departmentLabel(SAMPLE.toDept)}.
            </p>
          </div>

          {status && (
            <p className={status.tone === "green" ? "text-sm text-emerald-300" : "text-sm text-rose-300"}>
              {status.message}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => save()} disabled={Boolean(busy)}>
              {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Save
            </Button>
            <Button variant="secondary" size="sm" onClick={test} disabled={Boolean(busy) || !hasUrl}>
              {busy === "test" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send a test
            </Button>
            {hasUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => save({ clearUrl: true })}
                disabled={Boolean(busy)}
                className="ml-auto"
              >
                <Trash2 className="size-4" />
                Disconnect
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
