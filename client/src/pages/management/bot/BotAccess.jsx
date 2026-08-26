import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Layers,
  Pencil,
  Plus,
  ShieldCheck,
  Tag,
  Trash2,
} from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import Field from "../../../components/ui/Field";
import Select from "../../../components/ui/Select";
import { TextInput, TextArea } from "../../../components/ui/TextInput";
import BotError from "../../../components/bot/BotError";
import Loading from "../../../components/bot/Loading";
import Empty from "../../../components/bot/Empty";
import DiscordRolePicker from "../../../components/bot/DiscordRolePicker";
import { useBotResource } from "../../../lib/useBotResource";
import { useBotAuth } from "../../../context/useBotAuth";
import { api } from "../../../lib/botApi";

/**
 * Access tiers — the whole access model, in two plain-language pieces.
 *
 *   1. An **access tier** is a named bundle of things someone may do ("Whitelist Team"
 *      can approve whitelist requests). You define it once by ticking abilities off a list.
 *   2. You **assign a tier to a Discord role**. Everyone who holds that role can then do
 *      exactly those things — on the website and on the bot. Lose the role, lose the access.
 *
 * The screen is gated on the `access.manage` capability: the API answers 403 for anyone
 * else, so a caller without it never sees this at all. Nothing here is trusted client-side —
 * every write is re-authorized and re-validated by the bot API.
 */

// Legacy numeric tiers still exist on older mappings; render them with a friendly name.
const LEVELS = [
  { value: 100, label: "Admin (full access)", tone: "rose" },
  { value: 80, label: "Staff", tone: "amber" },
  { value: 60, label: "Manager", tone: "primary" },
  { value: 40, label: "Command", tone: "brand" },
  { value: 20, label: "Supervisor", tone: "slate" },
];

function levelMeta(value) {
  return LEVELS.find((l) => l.value === Number(value)) ?? { label: `Level ${value}`, tone: "slate" };
}

// Plain-language headings for the capability catalogue's raw category keys.
const CATEGORY_LABELS = {
  guild: "Servers",
  mapping: "Role mappings",
  role: "Managed roles",
  grant: "Manual role grants",
  sync: "Synchronization",
  member: "Members",
  audit: "Audit log",
  permission: "Permissions",
  system: "Platform administration",
  roster: "Rosters",
  transfer: "Transfers",
};

const categoryLabel = (key) => CATEGORY_LABELS[key] ?? key;

export default function BotAccess() {
  const { capabilities } = useBotAuth();
  // `capabilities` are objects ({capability, scopeType, scopeId}) with uppercase keys, so
  // match on the field case-insensitively rather than a string include.
  const canManage = capabilities.some((c) => {
    const key = typeof c === "string" ? c : c?.capability;
    return typeof key === "string" && key.toUpperCase() === "ACCESS.MANAGE";
  });

  if (!canManage) {
    return (
      <Empty title="Access management is restricted">
        Managing access tiers needs the <code>access.manage</code> capability. Ask an admin to
        grant it on the Permissions screen.
      </Empty>
    );
  }

  return (
    <div className="space-y-10">
      <p className="max-w-3xl text-sm leading-relaxed text-slate-400">
        An <strong className="text-slate-200">access tier</strong> is a named set of things
        someone can do — you pick the abilities from a checklist. Then you{" "}
        <strong className="text-slate-200">assign a tier to a Discord role</strong>: everyone with
        that role can do exactly those things, on the site and the bot. Take the role away and the
        access goes with it.
      </p>

      <TiersSection />
      <AssignmentsSection />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Section 1 — the reusable tier definitions                                  */
/* -------------------------------------------------------------------------- */

function TiersSection() {
  const tiers = useBotResource("/access/tiers");
  const [editing, setEditing] = useState(null); // tier object, or "new"
  const [removing, setRemoving] = useState(null);

  const items = useMemo(() => {
    const data = tiers.data;
    return data?.items ?? (Array.isArray(data) ? data : []);
  }, [tiers.data]);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-500/10 text-brand-300 ring-1 ring-inset ring-brand-400/20">
            <Layers className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-white">Access tiers</h2>
            <p className="text-xs text-slate-500">Define a set of abilities once, name it, reuse it.</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          New tier
        </Button>
      </div>

      {tiers.error ? (
        <BotError error={tiers.error} onRetry={tiers.reload} />
      ) : tiers.loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty title="No tiers yet">
          Create your first tier — for example a <em>Whitelist Team</em> tier that can approve
          whitelist requests — then assign it to the Discord role your reviewers hold.
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((tier) => (
            <Card key={tier.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{tier.name}</p>
                  {tier.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{tier.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(tier)}
                    aria-label={`Edit ${tier.name}`}
                    className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoving(tier)}
                    aria-label={`Delete ${tier.name}`}
                    className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge tone="brand">
                  {tier.capabilities?.length ?? 0}{" "}
                  {tier.capabilities?.length === 1 ? "ability" : "abilities"}
                </Badge>
                <span>
                  Used by {tier.roleCount ?? 0} {tier.roleCount === 1 ? "role" : "roles"}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <TierEditorDialog
          tier={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            tiers.reload();
          }}
        />
      )}

      {removing && (
        <DeleteTierDialog
          tier={removing}
          onClose={() => setRemoving(null)}
          onDeleted={() => {
            setRemoving(null);
            tiers.reload();
          }}
        />
      )}
    </section>
  );
}

function TierEditorDialog({ tier, onClose, onSaved }) {
  const catalogue = useBotResource("/access/capabilities");
  const caps = useMemo(() => {
    const data = catalogue.data;
    return data?.items ?? (Array.isArray(data) ? data : []);
  }, [catalogue.data]);

  const grouped = useMemo(() => {
    const byCategory = new Map();
    for (const cap of caps) {
      if (!byCategory.has(cap.category)) byCategory.set(cap.category, []);
      byCategory.get(cap.category).push(cap);
    }
    return [...byCategory.entries()];
  }, [caps]);

  const [name, setName] = useState(tier?.name ?? "");
  const [description, setDescription] = useState(tier?.description ?? "");
  const [selected, setSelected] = useState(() => new Set(tier?.capabilities ?? []));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError({ message: "Give the tier a name." });
      return;
    }
    if (selected.size === 0) {
      setError({ message: "Pick at least one ability." });
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const capabilitiesList = [...selected];
      if (tier) {
        await api(`/access/tiers/${encodeURIComponent(tier.id)}`, {
          method: "PATCH",
          body: {
            name: name.trim(),
            description: description.trim() || null,
            capabilities: capabilitiesList,
          },
        });
      } else {
        await api("/access/tiers", {
          method: "POST",
          body: {
            name: name.trim(),
            description: description.trim() || undefined,
            capabilities: capabilitiesList,
          },
        });
      }
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
      title={tier ? "Edit access tier" : "New access tier"}
      subtitle="Name it, then tick everything a holder should be able to do."
      className="max-w-2xl"
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label="Tier name" htmlFor="t-name" required>
          <TextInput
            id="t-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Whitelist Team"
            maxLength={60}
          />
        </Field>

        <Field label="Description" htmlFor="t-desc">
          <TextArea
            id="t-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional — a sentence on who this is for."
            maxLength={300}
          />
        </Field>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Abilities{" "}
            <span className="ml-1 font-normal normal-case text-slate-500">
              ({selected.size} selected)
            </span>
          </p>

          {catalogue.error ? (
            <BotError error={catalogue.error} onRetry={catalogue.reload} />
          ) : catalogue.loading ? (
            <Loading />
          ) : (
            <div className="space-y-4 rounded-2xl bg-black/20 p-4 ring-1 ring-inset ring-white/[0.06]">
              {grouped.map(([category, list]) => (
                <div key={category}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {categoryLabel(category)}
                  </p>
                  <div className="space-y-1">
                    {list.map((cap) => (
                      <label
                        key={cap.key}
                        className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.03]"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(cap.key)}
                          onChange={() => toggle(cap.key)}
                          className="mt-0.5 size-4 shrink-0 rounded border-white/20 bg-black/40 text-brand-500 focus:ring-brand-500/60"
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-sm text-slate-200">
                            {cap.description}
                            {cap.dangerous && (
                              <Badge tone="amber" className="shrink-0">
                                Sensitive
                              </Badge>
                            )}
                          </span>
                          <span className="text-[11px] text-slate-500">{cap.key}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-rose-300">{error.message ?? "Couldn't save the tier."}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : tier ? "Save changes" : "Create tier"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteTierDialog({ tier, onClose, onDeleted }) {
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    setError(null);
    setRemoving(true);
    try {
      await api(`/access/tiers/${encodeURIComponent(tier.id)}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      setError(err);
      setRemoving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Delete this tier?">
      <div className="space-y-4">
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-white">{tier.name}</span> will be deleted.
          {tier.roleCount > 0 && (
            <>
              {" "}
              The {tier.roleCount} {tier.roleCount === 1 ? "role" : "roles"} it is assigned to will
              lose this access.
            </>
          )}
        </p>

        {error && (
          <p className="text-sm text-rose-300">{error.message ?? "Couldn't delete the tier."}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={remove} disabled={removing}>
            {removing ? "Deleting…" : "Delete tier"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Section 2 — mapping Discord roles to tiers                                 */
/* -------------------------------------------------------------------------- */

function AssignmentsSection() {
  const rules = useBotResource("/access");
  const tiers = useBotResource("/access/tiers");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);

  const items = useMemo(() => {
    const data = rules.data;
    return data?.items ?? (Array.isArray(data) ? data : []);
  }, [rules.data]);

  const tierItems = useMemo(() => {
    const data = tiers.data;
    return data?.items ?? (Array.isArray(data) ? data : []);
  }, [tiers.data]);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary-500/10 text-primary-300 ring-1 ring-inset ring-primary-400/20">
            <Tag className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-white">Role assignments</h2>
            <p className="text-xs text-slate-500">
              Which Discord role gets which tier. Holding the role is the access.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setAdding(true)}
          disabled={tierItems.length === 0}
          title={tierItems.length === 0 ? "Create a tier first" : undefined}
        >
          <Plus className="size-4" />
          Assign a role
        </Button>
      </div>

      {rules.error ? (
        <BotError error={rules.error} onRetry={rules.reload} />
      ) : rules.loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty title="No role assignments yet">
          {tierItems.length === 0
            ? "Create a tier above first, then assign it to the Discord role your team holds."
            : "Assign a tier to a Discord role to grant access. Until then only Discord's own /access grant can let anyone in."}
        </Empty>
      ) : (
        <Card className="divide-y divide-white/[0.06]">
          {items.map((rule) => {
            const tierName = rule.accessTier?.name;
            const meta = tierName ? null : levelMeta(rule.permissionLevel);
            return (
              <div key={rule.discordRoleId} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {rule.roleName ?? rule.discordRoleId}
                  </p>
                  <p className="truncate text-xs text-slate-500">{rule.discordRoleId}</p>
                </div>
                {tierName ? (
                  <Badge tone="brand">
                    <ShieldCheck className="size-3" />
                    {tierName}
                  </Badge>
                ) : (
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                )}
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
        <AssignRoleDialog
          tiers={tierItems}
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
    </section>
  );
}

function AssignRoleDialog({ tiers, onClose, onSaved }) {
  const guilds = useBotResource("/guilds");
  const guildItems = guilds.data?.items ?? [];
  const [guildId, setGuildId] = useState("");
  const [role, setRole] = useState(null);
  const [tierId, setTierId] = useState(tiers[0]?.id ?? "");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Access is mapped on main-guild roles, so default to the main community server (falling
  // back to the first) rather than whichever guild happens to sort first.
  const mainGuild = guildItems.find((g) => g.type === "MAIN_COMMUNITY");
  const effectiveGuild = guildId || mainGuild?.id || guildItems[0]?.id || "";

  const submit = async (event) => {
    event.preventDefault();
    if (!role) {
      setError({ message: "Pick a Discord role first." });
      return;
    }
    if (!tierId) {
      setError({ message: "Pick a tier to grant." });
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api("/access", {
        method: "POST",
        body: { discordRoleId: role.id, roleName: role.name, accessTierId: tierId },
      });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Assign a tier to a role">
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
          {guilds.error ? (
            <BotError error={guilds.error} onRetry={guilds.reload} />
          ) : guilds.loading ? (
            <Loading />
          ) : guildItems.length === 0 ? (
            <Empty title="No servers connected">
              The bot has no approved server yet, so there are no roles to map. Add your community
              Discord server on the <strong>Servers</strong> tab first, then come back here.
            </Empty>
          ) : (
            <DiscordRolePicker guildId={effectiveGuild} value={role?.id} onChange={setRole} />
          )}
        </Field>

        <Field label="Tier" htmlFor="a-tier" required>
          <Select
            id="a-tier"
            value={tierId}
            onChange={setTierId}
            options={tiers.map((t) => ({ value: t.id, label: t.name }))}
          />
        </Field>

        {error && (
          <p className="text-sm text-rose-300">{error.message ?? "Couldn't save the assignment."}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !role}>
            {saving ? "Saving…" : "Assign"}
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

  const tierName = rule.accessTier?.name;
  const meta = tierName ? null : levelMeta(rule.permissionLevel);

  return (
    <Modal open onClose={onClose} title="Remove this assignment?">
      <div className="space-y-4">
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-white">{rule.roleName ?? rule.discordRoleId}</span>{" "}
          will lose its{" "}
          {tierName ? (
            <Badge tone="brand">{tierName}</Badge>
          ) : (
            <Badge tone={meta.tone}>{meta.label}</Badge>
          )}{" "}
          access to the site and the bot.
        </p>

        <p className="flex items-start gap-2 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/25">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          If this is a role you hold, removing it may lock you out of this dashboard. You can
          restore access from Discord with <code>/access grant</code>.
        </p>

        {error && (
          <p className="text-sm text-rose-300">{error.message ?? "Couldn't remove the assignment."}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={remove} disabled={removing}>
            {removing ? "Removing…" : "Remove"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
