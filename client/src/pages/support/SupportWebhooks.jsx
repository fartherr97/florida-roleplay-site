import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Save, Webhook } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import { TextInput } from "../../components/ui/TextInput";
import AccessDenied from "../../components/auth/AccessDenied";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";

/**
 * Where a new support ticket is announced on Discord — ownership only.
 *
 * Two shapes, matching how tickets are routed. The **support team** webhook catches every
 * queue without its own department webhook and pings the support team role above the
 * embed. A **department** webhook (one per queue) takes that queue's tickets into the
 * department's own Discord, with no ping. A queue left blank falls back to the support
 * webhook. The server sanitises every URL to a real Discord webhook, so a bad paste is
 * simply dropped.
 */
export default function SupportWebhooks() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("support.webhooks");

  const [loaded, setLoaded] = useState(false);
  const [types, setTypes] = useState([]);
  const [supportWebhookUrl, setSupportWebhookUrl] = useState("");
  const [supportPingRoleId, setSupportPingRoleId] = useState("");
  const [deptWebhooks, setDeptWebhooks] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    api.supportWebhooks().then((data) => {
      if (!active) return;
      setTypes(data.types ?? []);
      setSupportWebhookUrl(data.supportWebhookUrl ?? "");
      setSupportPingRoleId(data.supportPingRoleId ?? "");
      setDeptWebhooks(data.deptWebhooks ?? {});
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [canManage]);

  if (!canManage) return <AccessDenied reason="role" />;

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const saved = await api.saveSupportWebhooks({
        supportWebhookUrl,
        supportPingRoleId,
        deptWebhooks,
      });
      // Reflect what the server actually stored (sanitised URLs, cleared bad ones).
      setSupportWebhookUrl(saved.supportWebhookUrl ?? "");
      setSupportPingRoleId(saved.supportPingRoleId ?? "");
      setDeptWebhooks(saved.deptWebhooks ?? {});
      setMessage("Saved. New tickets will announce to these webhooks.");
    } catch (err) {
      setError(err?.message || "Could not save the webhook settings.");
    } finally {
      setSaving(false);
    }
  };

  const setDept = (typeId, url) =>
    setDeptWebhooks((prev) => ({ ...prev, [typeId]: url }));

  return (
    <Section className="max-w-3xl">
      <Link to="/support/queue" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="size-4" />
        Back to the queue
      </Link>
      <PageHeader
        eyebrow="Support portal"
        title="Ticket webhooks"
        description="Announce every new ticket on Discord. The support team's queues ping your support role; each department's queue posts into its own server."
      />

      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Webhook className="size-4 text-primary-300" />
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-white">Support team</h3>
        </div>
        <p className="mb-4 text-sm text-slate-400">
          Used for every queue without its own department webhook below. A new ticket posts
          an embed here and pings the role you set above it.
        </p>
        <Field label="Support webhook URL" htmlFor="sw-url" hint="A Discord channel webhook — Channel settings → Integrations → Webhooks. Leave empty to send no support-team announcement.">
          <TextInput
            id="sw-url"
            value={supportWebhookUrl}
            onChange={(e) => setSupportWebhookUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/…"
          />
        </Field>
        <div className="mt-4">
          <Field label="Support team role ID" htmlFor="sw-role" hint="The role pinged above the embed for support tickets. Leave empty to post with no ping.">
            <TextInput
              id="sw-role"
              value={supportPingRoleId}
              onChange={(e) => setSupportPingRoleId(e.target.value)}
              placeholder="1534380749304889384"
              className="max-w-xs"
            />
          </Field>
        </div>
      </Card>

      <Card className="mt-5 p-5">
        <h3 className="mb-1 text-sm font-bold uppercase tracking-[0.14em] text-white">Department queues</h3>
        <p className="mb-4 text-sm text-slate-400">
          Give a queue its own webhook and its tickets go to that department's Discord
          instead — the same “a new ticket has been created” embed, with no ping. Leave one
          blank to route it to the support team above.
        </p>

        {!loaded ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : types.length === 0 ? (
          <p className="text-sm text-slate-500">No ticket queues are configured yet.</p>
        ) : (
          <div className="space-y-4">
            {types.map((type) => (
              <Field
                key={type.id}
                label={type.label}
                htmlFor={`dw-${type.id}`}
                hint={`Tickets in “${type.label}” post here.`}
              >
                <TextInput
                  id={`dw-${type.id}`}
                  value={deptWebhooks[type.id] ?? ""}
                  onChange={(e) => setDept(type.id, e.target.value)}
                  placeholder="https://discord.com/api/webhooks/…  (blank → support team)"
                />
              </Field>
            ))}
          </div>
        )}
      </Card>

      {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}
      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

      <div className="mt-5 flex justify-end">
        <Button onClick={save} disabled={saving || !loaded}>
          <Save className="size-4" />
          {saving ? "Saving…" : "Save webhooks"}
        </Button>
      </div>
    </Section>
  );
}
