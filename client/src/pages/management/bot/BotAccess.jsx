import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import Field from "../../../components/ui/Field";
import Select from "../../../components/ui/Select";
import { TextInput } from "../../../components/ui/TextInput";
import BotError from "../../../components/bot/BotError";
import Loading from "../../../components/bot/Loading";
import Empty from "../../../components/bot/Empty";
import DiscordRolePicker from "../../../components/bot/DiscordRolePicker";
import { useBotResource } from "../../../lib/useBotResource";
import { useBotAuth } from "../../../context/useBotAuth";
import { api } from "../../../lib/botApi";

/**
 * Discord-role → access-tier mappings.
 *
 * Holding a mapped Discord role is the whole access model: it grants both the
 * website and the bot, and there is no separate user list or invite flow. The
 * screen is gated on the `access.manage` capability — the API returns 403 for
 * anyone else, so a caller without it never sees this at all.
 */
const LEVELS = [
  { value: 100, label: "Admin", tone: "rose" },
  { value: 80, label: "Staff", tone: "amber" },
  { value: 60, label: "Manager", tone: "primary" },
  { value: 40, label: "Command", tone: "sky" },
  { value: 20, label: "Supervisor", tone: "slate" },
];

function levelMeta(value) {
  return LEVELS.find((l) => l.value === Number(value)) ?? { label: String(value), tone: "slate" };
}

export default function BotAccess() {
  const { capabilities } = useBotAuth();
  // `capabilities` are objects ({capability, scopeType, scopeId}) with uppercase
  // keys, so match on the field case-insensitively rather than a string include.
  const canManage = capabilities.some((c) => {
    const key = typeof c === "string" ? c : c?.capability;
    return typeof key === "string" && key.toUpperCase() === "ACCESS.MANAGE";
  });

  const rules = useBotResource("/access", { skip: !canManage });
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);

  const items = useMemo(() => {
    const data = rules.data;
    return data?.items ?? (Array.isArray(data) ? data : []);
  }, [rules.data]);

  if (!canManage) {
    return (
      <Empty title="Access management is restricted">
        Managing access tiers needs the <code>access.manage</code> capability.
        Ask an admin to grant it on the Permissions screen.
      </Empty>
    );
  }

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">
          Each rule maps a Discord role to an access tier. Holding the role is
          what grants access — to both the site and the bot.
        </p>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          Add rule
        </Button>
      </div>

      {rules.error ? (
        <BotError error={rules.error} onRetry={rules.reload} />
      ) : rules.loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty title="No access rules yet">
          Add one to grant a Discord role access. Until then only Discord's own
          <code> /access grant</code> can let anyone in.
        </Empty>
      ) : (
        <Card className="divide-y divide-white/[0.06]">
          {items.map((rule) => {
            const meta = levelMeta(rule.level);
            return (
              <div
                key={rule.discordRoleId}
                className="flex items-center gap-4 px-5 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {rule.roleName ?? rule.discordRoleId}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {rule.discordRoleId}
                    {rule.reason ? ` · ${rule.reason}` : ""}
                  </p>
                </div>
                <Badge tone={meta.tone}>{meta.label}</Badge>
                <button
                  type="button"
                  onClick={() => setRemoving(rule)}
                  aria-label={`Remove ${rule.roleName ?? rule.discordRoleId}`}
                  className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </Card>
      )}

      {adding && (
        <AddRuleDialog
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            rules.reload();
          }}
        />
      )}

      {removing && (
        <RemoveRuleDialog
          rule={removing}
          onClose={() => setRemoving(null)}
          onRemoved={() => {
            setRemoving(null);
            rules.reload();
          }}
        />
      )}
    </>
  );
}

function AddRuleDialog({ onClose, onSaved }) {
  const guilds = useBotResource("/guilds");
  const guildItems = guilds.data?.items ?? [];
  const [guildId, setGuildId] = useState("");
  const [role, setRole] = useState(null);
  const [level, setLevel] = useState(80);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Default to the only guild, or the first, once loaded.
  const effectiveGuild = guildId || guildItems[0]?.id || "";

  const submit = async (event) => {
    event.preventDefault();
    if (!role) {
      setError({ message: "Pick a Discord role first." });
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api("/access", {
        method: "POST",
        body: {
          discordRoleId: role.id,
          roleName: role.name,
          level: Number(level),
          reason: reason.trim() || undefined,
        },
      });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add an access rule">
      <form onSubmit={submit} className="space-y-4">
        {guildItems.length > 1 && (
          <Field label="Server" htmlFor="a-guild" required>
            <Select
              id="a-guild"
              value={effectiveGuild}
              onChange={(value) => {
                setGuildId(value);
                setRole(null);
              }}
              options={guildItems.map((g) => ({ value: g.id, label: g.name ?? g.id }))}
            />
          </Field>
        )}

        <Field label="Discord role" required>
          <DiscordRolePicker
            guildId={effectiveGuild}
            value={role?.id}
            onChange={setRole}
          />
        </Field>

        <Field label="Access tier" htmlFor="a-level" required>
          <Select
            id="a-level"
            value={String(level)}
            onChange={(value) => setLevel(Number(value))}
            options={LEVELS.map((l) => ({ value: String(l.value), label: `${l.label} (${l.value})` }))}
          />
        </Field>

        <Field label="Reason" htmlFor="a-reason">
          <TextInput
            id="a-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional — why this role gets this tier"
          />
        </Field>

        {error && (
          <p className="text-sm text-rose-300">{error.message ?? "Couldn't save the rule."}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !role}>
            {saving ? "Saving…" : "Add rule"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RemoveRuleDialog({ rule, onClose, onRemoved }) {
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    setError(null);
    setRemoving(true);
    try {
      await api(`/access/${encodeURIComponent(rule.discordRoleId)}`, { method: "DELETE" });
      onRemoved();
    } catch (err) {
      setError(err);
      setRemoving(false);
    }
  };

  const meta = levelMeta(rule.level);

  return (
    <Modal open onClose={onClose} title="Remove this access rule?">
      <div className="space-y-4">
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-white">{rule.roleName ?? rule.discordRoleId}</span>{" "}
          will lose its <Badge tone={meta.tone}>{meta.label}</Badge> tier and, with it,
          access to the site and the bot.
        </p>

        <p className="flex items-start gap-2 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/25">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          If this is a role you hold, removing it locks you out of this dashboard.
          You can restore access from Discord with <code>/access grant</code>.
        </p>

        {error && (
          <p className="text-sm text-rose-300">{error.message ?? "Couldn't remove the rule."}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={remove} disabled={removing}>
            {removing ? "Removing…" : "Remove rule"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
