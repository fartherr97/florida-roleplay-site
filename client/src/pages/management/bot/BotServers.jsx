import { useState } from "react";
import { FlaskConical, Plus, Power, Trash2 } from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import Field from "../../../components/ui/Field";
import { TextInput } from "../../../components/ui/TextInput";
import BotError from "../../../components/bot/BotError";
import Loading from "../../../components/bot/Loading";
import Empty from "../../../components/bot/Empty";
import MappingPreview from "../../../components/bot/MappingPreview";
import { useBotResource } from "../../../lib/useBotResource";
import { api } from "../../../lib/botApi";
import { cn } from "../../../lib/cn";

/**
 * Discord servers, the roles the bot manages in them, and the mappings that
 * decide what it does.
 *
 * Mappings get the most room because they are the part that changes people's
 * roles, and `test` gets a button of its own beside every one. Previewing what a
 * rule would do is the difference between finding out now and finding out from
 * a hundred members at once, so it is not hidden behind an overflow menu.
 */
export default function BotServers() {
  const guilds = useBotResource("/guilds");
  const mappings = useBotResource("/mappings");
  const roles = useBotResource("/roles");
  const [error, setError] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [addingGuild, setAddingGuild] = useState(false);

  const act = async (fn, reload) => {
    setError(null);
    try {
      await fn();
      reload?.();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <>
      {error && <BotError error={error} className="mb-5" />}

      <section className="mb-8">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
            Discord servers
          </h2>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setAddingGuild(true)}>
            <Plus className="size-4" />
            Add a server
          </Button>
        </div>
        {guilds.error ? (
          <BotError error={guilds.error} onRetry={guilds.reload} />
        ) : guilds.loading ? (
          <Loading rows={2} />
        ) : (guilds.data?.items ?? []).length === 0 ? (
          <Empty title="No servers configured">
            Add the Discord server the bot should manage.
          </Empty>
        ) : (
          <div className="space-y-3">
            {guilds.data.items.map((guild) => (
              <GuildCard
                key={guild.id ?? guild.guildId}
                guild={guild}
                onDelete={() =>
                  act(
                    () =>
                      api(`/guilds/${encodeURIComponent(guild.guildId ?? guild.id)}`, {
                        method: "DELETE",
                      }),
                    guilds.reload,
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
          Mappings
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          A mapping is a rule the bot applies to members. Test one before enabling it —
          the preview shows exactly who it would affect without touching anybody.
        </p>

        {testResult && (
          <Card className="mb-4 p-5 ring-1 ring-inset ring-brand-400/25">
            <div className="flex items-start gap-3">
              <FlaskConical className="mt-0.5 size-5 shrink-0 text-brand-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  Preview — nothing was applied
                </p>
                <MappingPreview result={testResult} />
              </div>
              <Button variant="ghost" size="sm" onClick={() => setTestResult(null)}>
                Dismiss
              </Button>
            </div>
          </Card>
        )}

        {mappings.error ? (
          <BotError error={mappings.error} onRetry={mappings.reload} />
        ) : mappings.loading ? (
          <Loading rows={3} />
        ) : (mappings.data?.items ?? []).length === 0 ? (
          <Empty title="No mappings yet">
            Nothing is being applied automatically.
          </Empty>
        ) : (
          <div className="space-y-3">
            {mappings.data.items.map((mapping) => (
              <Card key={mapping.id} className="flex flex-wrap items-center gap-3 p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {mapping.name ?? mapping.type ?? `Mapping ${mapping.id}`}
                    </span>
                    <Badge tone={mapping.enabled ? "green" : "slate"} dot={mapping.enabled}>
                      {mapping.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  {mapping.description && (
                    <p className="mt-1.5 text-sm text-slate-400">{mapping.description}</p>
                  )}
                  <code className="mt-1.5 block text-xs text-slate-600">{mapping.id}</code>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    act(async () => {
                      const result = await api(
                        `/mappings/${encodeURIComponent(mapping.id)}/test`,
                        { method: "POST" },
                      );
                      setTestResult(result);
                    })
                  }
                >
                  <FlaskConical className="size-4" />
                  Test
                </Button>

                <Button
                  variant={mapping.enabled ? "ghost" : "secondary"}
                  size="sm"
                  onClick={() =>
                    act(
                      () =>
                        api(`/mappings/${encodeURIComponent(mapping.id)}/enabled`, {
                          method: "POST",
                          body: { enabled: !mapping.enabled },
                        }),
                      mappings.reload,
                    )
                  }
                >
                  <Power className="size-4" />
                  {mapping.enabled ? "Disable" : "Enable"}
                </Button>

                <button
                  type="button"
                  onClick={() =>
                    act(
                      () =>
                        api(`/mappings/${encodeURIComponent(mapping.id)}`, { method: "DELETE" }),
                      mappings.reload,
                    )
                  }
                  aria-label="Delete mapping"
                  className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                >
                  <Trash2 className="size-4" />
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
          Managed roles
        </h2>
        {roles.error ? (
          <BotError error={roles.error} onRetry={roles.reload} />
        ) : roles.loading ? (
          <Loading rows={2} />
        ) : (roles.data?.items ?? []).length === 0 ? (
          <Empty title="No managed roles">
            The bot is not managing any Discord roles yet.
          </Empty>
        ) : (
          <Card className="divide-y divide-white/[0.06]">
            {roles.data.items.map((role) => (
              <div key={role.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className="min-w-0 flex-1 text-sm text-white">
                  {role.name ?? role.discordRoleId}
                </span>
                <code className="text-xs text-slate-600">{role.discordRoleId}</code>
                <button
                  type="button"
                  onClick={() =>
                    act(
                      () => api(`/roles/${encodeURIComponent(role.id)}`, { method: "DELETE" }),
                      roles.reload,
                    )
                  }
                  aria-label={`Stop managing ${role.name ?? role.discordRoleId}`}
                  className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </Card>
        )}
      </section>

      {addingGuild && (
        <AddGuild
          onClose={() => setAddingGuild(false)}
          onAdded={() => {
            setAddingGuild(false);
            guilds.reload();
          }}
        />
      )}
    </>
  );
}

/** A server plus its live status, which is a separate call per guild. */
function GuildCard({ guild, onDelete }) {
  const id = guild.guildId ?? guild.id;
  const status = useBotResource(`/guilds/${encodeURIComponent(id)}/status`);

  return (
    <Card className="flex flex-wrap items-center gap-3 p-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-white">{guild.name ?? id}</span>
          {status.data && (
            <Badge
              tone={status.data.connected === false ? "rose" : "green"}
              dot={status.data.connected !== false}
            >
              {status.data.connected === false ? "Disconnected" : "Connected"}
            </Badge>
          )}
        </div>
        <code className="mt-1 block text-xs text-slate-600">{id}</code>
        {status.data?.message && (
          <p className="mt-1.5 text-sm text-slate-400">{status.data.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Remove ${guild.name ?? id}`}
        className={cn(
          "rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300",
        )}
      >
        <Trash2 className="size-4" />
      </button>
    </Card>
  );
}

function AddGuild({ onClose, onAdded }) {
  const [guildId, setGuildId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api("/guilds", {
        method: "POST",
        body: { guildId: guildId.trim(), name: name.trim() || undefined },
      });
      onAdded();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add a Discord server">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Server ID" htmlFor="g-id" required>
          <TextInput id="g-id" value={guildId} onChange={(e) => setGuildId(e.target.value)} />
        </Field>
        <Field label="Name" htmlFor="g-name" hint="For your own reference.">
          <TextInput id="g-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {error && <BotError error={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Adding…" : "Add"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
