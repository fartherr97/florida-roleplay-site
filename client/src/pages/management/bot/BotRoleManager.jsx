import { useMemo, useState } from "react";
import { Plus, ShieldQuestion, Trash2, UserCog } from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import Field from "../../../components/ui/Field";
import Select from "../../../components/ui/Select";
import BotError from "../../../components/bot/BotError";
import Loading from "../../../components/bot/Loading";
import Empty from "../../../components/bot/Empty";
import DiscordRolePicker from "../../../components/bot/DiscordRolePicker";
import { useBotResource } from "../../../lib/useBotResource";
import { useBotAuth } from "../../../context/useBotAuth";
import { api } from "../../../lib/botApi";

/**
 * Role Manager — the per-guild delegation rules behind the bot's `/rolemanager`
 * command. Each rule lets holders of one "grantor" Discord role hand out (and
 * take back) a set of other roles, in that guild, from `/rolemanager assign`.
 *
 * Reading the rules is open to any staff; adding and removing them needs the
 * `rolegrant.manage` capability, so this whole screen is gated on it — the bot
 * API re-authorizes every write regardless, and nothing here is trusted
 * client-side.
 */
export default function BotRoleManager() {
  const { capabilities } = useBotAuth();
  const canManage = capabilities.some((c) => {
    const key = typeof c === "string" ? c : c?.capability;
    return typeof key === "string" && key.toUpperCase() === "ROLEGRANT.MANAGE";
  });

  const guilds = useBotResource("/guilds");
  const guildItems = useMemo(() => guilds.data?.items ?? [], [guilds.data]);

  // Default to the main community server, then whatever sorts first.
  const mainGuild = guildItems.find((g) => g.type === "MAIN_COMMUNITY");
  const [guildId, setGuildId] = useState("");
  const selectedId = guildId || mainGuild?.id || guildItems[0]?.id || "";
  const guild = guildItems.find((g) => g.id === selectedId) ?? null;
  const discordGuildId = guild?.discordGuildId ?? "";

  const rules = useBotResource(
    discordGuildId ? `/role-grants?discordGuildId=${encodeURIComponent(discordGuildId)}` : "",
    { skip: !discordGuildId },
  );

  const [adding, setAdding] = useState(false);

  if (!canManage) {
    return (
      <Empty title="Role Manager is restricted">
        Configuring role delegation needs the <code>rolegrant.manage</code> capability. Ask an admin
        to grant it on the Permissions screen.
      </Empty>
    );
  }

  const groups = rules.data?.groups ?? [];

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm leading-relaxed text-slate-400">
        A <strong className="text-slate-200">delegation rule</strong> lets everyone holding one
        Discord role hand out — and take back — a set of other roles, using the bot's{" "}
        <code>/rolemanager</code> command in that server. Set it up per server here instead of in
        Discord.
      </p>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-56">
          <Field label="Server" htmlFor="rm-guild">
            {guilds.error ? (
              <BotError error={guilds.error} onRetry={guilds.reload} />
            ) : guilds.loading ? (
              <Loading />
            ) : guildItems.length === 0 ? (
              <Empty title="No servers connected">
                Add your community Discord server on the <strong>Servers</strong> tab first.
              </Empty>
            ) : (
              <Select
                id="rm-guild"
                value={selectedId}
                onChange={setGuildId}
                options={guildItems.map((g) => ({ value: g.id, label: g.name ?? g.id }))}
              />
            )}
          </Field>
        </div>
        {discordGuildId && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add delegation
          </Button>
        )}
      </div>

      {!discordGuildId ? null : rules.error ? (
        <BotError error={rules.error} onRetry={rules.reload} />
      ) : rules.loading ? (
        <Loading />
      ) : groups.length === 0 ? (
        <Empty title="No delegation set up here">
          Add a rule to let a role hand out other roles in {guild?.name ?? "this server"}. Until
          then, <code>/rolemanager</code> tells members there is nothing for them to manage.
        </Empty>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <GrantorCard
              key={group.grantorRoleId}
              group={group}
              discordGuildId={discordGuildId}
              onChanged={rules.reload}
            />
          ))}
        </div>
      )}

      {adding && guild && (
        <AddDelegationDialog
          guild={guild}
          discordGuildId={discordGuildId}
          existingGrantorIds={groups.map((g) => g.grantorRoleId)}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            rules.reload();
          }}
        />
      )}
    </div>
  );
}

/** One grantor role and the roles its holders may hand out. */
function GrantorCard({ group, discordGuildId, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const removeGrantable = async (roleId) => {
    setBusy(true);
    try {
      await api("/role-grants", {
        method: "DELETE",
        body: { discordGuildId, grantorRoleId: group.grantorRoleId, grantableRoleIds: [roleId] },
      });
      onChanged();
    } catch {
      setBusy(false);
    }
  };

  const removeAll = async () => {
    setBusy(true);
    try {
      await api("/role-grants", {
        method: "DELETE",
        body: { discordGuildId, grantorRoleId: group.grantorRoleId },
      });
      onChanged();
    } catch {
      setBusy(false);
      setConfirmAll(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary-500/10 text-primary-300 ring-1 ring-inset ring-primary-400/20">
            <UserCog className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">{group.grantorRoleName}</p>
            <p className="text-xs text-slate-500">can hand out {group.grantables.length} role{group.grantables.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmAll(true)}
          aria-label={`Remove all delegation for ${group.grantorRoleName}`}
          className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {group.grantables.map((role) => (
          <span
            key={role.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-xs text-slate-200 ring-1 ring-inset ring-white/10"
          >
            {role.name}
            <button
              type="button"
              disabled={busy}
              onClick={() => removeGrantable(role.id)}
              aria-label={`Stop handing out ${role.name}`}
              className="text-slate-500 transition hover:text-rose-300"
            >
              <Trash2 className="size-3" />
            </button>
          </span>
        ))}
      </div>

      {confirmAll && (
        <Modal open onClose={() => setConfirmAll(false)} title="Remove all delegation?">
          <p className="text-sm text-slate-300">
            Holders of <span className="font-semibold text-white">{group.grantorRoleName}</span> will
            no longer be able to hand out any roles here. The Discord roles themselves are not
            touched.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmAll(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={removeAll} disabled={busy}>
              {busy ? "Removing…" : "Remove all"}
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}

function AddDelegationDialog({ guild, discordGuildId, existingGrantorIds, onClose, onSaved }) {
  const [grantor, setGrantor] = useState(null);
  const [grantables, setGrantables] = useState(new Map()); // id -> name
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const grantableIds = [...grantables.keys()];

  const toggleGrantable = (role) => {
    setGrantables((prev) => {
      const next = new Map(prev);
      if (next.has(role.id)) next.delete(role.id);
      else next.set(role.id, role.name);
      return next;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!grantor) {
      setError({ message: "Pick the role whose holders will hand out others." });
      return;
    }
    const picked = grantableIds.filter((id) => id !== grantor.id);
    if (picked.length === 0) {
      setError({ message: "Pick at least one role for them to hand out." });
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api("/role-grants", {
        method: "POST",
        body: {
          discordGuildId,
          grantor: { id: grantor.id, name: grantor.name },
          grantables: picked.map((id) => ({ id, name: grantables.get(id) })),
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
    <Modal
      open
      onClose={onClose}
      title="Add role delegation"
      subtitle={`In ${guild.name ?? "this server"}`}
      className="max-w-2xl"
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label="Grantor role" required>
          <p className="mb-2 text-xs text-slate-500">Holders of this role will be able to hand out the roles you pick below.</p>
          <DiscordRolePicker guildId={guild.id} value={grantor?.id} onChange={setGrantor} />
        </Field>

        {existingGrantorIds.includes(grantor?.id) && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200 ring-1 ring-inset ring-amber-400/25">
            <ShieldQuestion className="mt-0.5 size-3.5 shrink-0" />
            This role already delegates some roles — the ones you pick will be added to its existing list.
          </p>
        )}

        <Field label="Roles it may hand out" required>
          <DiscordRolePicker
            guildId={guild.id}
            multiple
            value={grantableIds}
            onChange={toggleGrantable}
          />
        </Field>

        {grantables.size > 0 && (
          <div className="flex flex-wrap gap-2">
            {[...grantables.entries()].map(([id, name]) => (
              <Badge key={id} tone="primary">{name}</Badge>
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-rose-300">{error.message ?? "Couldn't save the delegation."}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !grantor}>
            {saving ? "Saving…" : "Add delegation"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
