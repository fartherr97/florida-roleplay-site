import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeftRight,
  FlaskConical,
  Plus,
  Power,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Field from "../../../components/ui/Field";
import Select from "../../../components/ui/Select";
import { TextInput } from "../../../components/ui/TextInput";
import BotError from "../../../components/bot/BotError";
import Loading from "../../../components/bot/Loading";
import Empty from "../../../components/bot/Empty";
import MappingPreview from "../../../components/bot/MappingPreview";
import { useBotResource } from "../../../lib/useBotResource";
import { api } from "../../../lib/botApi";
import { cn } from "../../../lib/cn";

/**
 * Role mapping setup, built for the common case: one role in the main server should
 * grant a role in several other servers at once. The builder takes a single source
 * role and a list of target servers, and creates one mapping per target in a single
 * pass — so "Community Director grants Full Access in four servers" is four clicks,
 * not four trips through a slash command.
 *
 * Everything here is a thin client over the bot API. Direction, protection policy and
 * cycle checks are all decided server-side; a mapping that touches a protected role
 * comes back needing a second approver, and the UI just reports what the API said.
 */
export default function BotMappings() {
  const guilds = useBotResource("/guilds");
  const mappings = useBotResource("/mappings");
  const [error, setError] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const guildList = guilds.data?.items ?? [];
  const roleCatalogs = useRoleCatalogs(guildList);

  const act = async (fn, reload) => {
    setError(null);
    try {
      await fn();
      reload?.();
    } catch (err) {
      setError(err);
      // The error banner is at the top of the page; an Enable button can be well below the
      // fold, so bring the reason into view rather than leaving the click looking ignored.
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <>
      {error && <BotError error={error} className="mb-5" />}

      {guilds.error ? (
        <BotError error={guilds.error} onRetry={guilds.reload} />
      ) : guilds.loading ? (
        <Loading rows={3} />
      ) : guildList.length < 1 ? (
        <Empty title="Add a server first">
          Role mappings connect two servers. Add the servers on the Servers tab, then come
          back here to wire their roles together.
        </Empty>
      ) : (
        <MappingBuilder
          guilds={guildList}
          roleCatalogs={roleCatalogs}
          onCreated={mappings.reload}
        />
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
          Existing mappings
        </h2>

        {testResult && (
          <Card className="mb-4 p-5 ring-1 ring-inset ring-brand-400/25">
            <div className="flex items-start gap-3">
              <FlaskConical className="mt-0.5 size-5 shrink-0 text-brand-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Preview — nothing was applied</p>
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
          <Empty title="No mappings yet">Nothing is being applied automatically.</Empty>
        ) : (
          <MappingGroups
            items={mappings.data.items}
            roleName={(guildPlatformId, roleId) =>
              roleCatalogs.nameFor(guildPlatformId, roleId)
            }
            onTest={(id) =>
              act(async () => {
                const result = await api(`/mappings/${encodeURIComponent(id)}/test`, {
                  method: "POST",
                });
                setTestResult(result);
              })
            }
            onToggle={(mapping) =>
              act(
                () =>
                  api(`/mappings/${encodeURIComponent(mapping.id)}/enabled`, {
                    method: "POST",
                    body: {
                      enabled: !mapping.enabled,
                      reason: mapping.enabled
                        ? "Disabled from the bot dashboard"
                        : "Enabled from the bot dashboard",
                    },
                  }),
                mappings.reload,
              )
            }
            onDelete={(id) =>
              act(
                () => api(`/mappings/${encodeURIComponent(id)}`, { method: "DELETE" }),
                mappings.reload,
              )
            }
          />
        )}
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ builder */

const DIRECTIONS = [
  {
    value: "ONE_WAY",
    label: "One-way",
    hint: "The source role controls the target: gaining or losing it there is mirrored here.",
    Icon: ArrowRight,
  },
  {
    value: "TWO_WAY",
    label: "Two-way",
    hint: "Either side is authoritative — the two roles are kept in step in both directions.",
    Icon: ArrowLeftRight,
  },
];

function newTarget() {
  return { key: Math.random().toString(36).slice(2), guildId: "", roleId: "", direction: "ONE_WAY" };
}

function MappingBuilder({ guilds, roleCatalogs, onCreated }) {
  const [sourceGuildId, setSourceGuildId] = useState("");
  const [sourceRoleId, setSourceRoleId] = useState("");
  const [targets, setTargets] = useState(() => [newTarget()]);
  const [nameInput, setNameInput] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [reason, setReason] = useState("");
  const [enableNow, setEnableNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const guildOptions = guilds.map((g) => ({ value: g.id, label: g.name ?? g.discordGuildId }));
  const platformToSnowflake = useMemo(
    () => Object.fromEntries(guilds.map((g) => [g.id, g.discordGuildId])),
    [guilds],
  );

  const sourceRoleName = roleCatalogs.nameFor(sourceGuildId, sourceRoleId);

  // The name defaults to the source role until the operator types their own — derived
  // during render rather than mirrored into state, so the two never fight.
  const suggestedName = sourceRoleName ? `${sourceRoleName} access` : "";
  const name = nameTouched ? nameInput : suggestedName;

  const reset = () => {
    setSourceGuildId("");
    setSourceRoleId("");
    setTargets([newTarget()]);
    setNameInput("");
    setNameTouched(false);
    setReason("");
    setEnableNow(false);
  };

  const readyTargets = targets.filter((t) => t.guildId && t.roleId);
  const canSubmit =
    sourceGuildId && sourceRoleId && name.trim() && readyTargets.length > 0 && !busy;

  const submit = async () => {
    setError(null);
    setResults(null);
    setBusy(true);
    const sourceSnowflake = platformToSnowflake[sourceGuildId];
    const finalReason = reason.trim() || "Set up from the bot dashboard";
    const out = [];

    for (const target of readyTargets) {
      const targetSnowflake = platformToSnowflake[target.guildId];
      const targetLabel =
        guilds.find((g) => g.id === target.guildId)?.name ?? targetSnowflake;
      const roleLabel = roleCatalogs.nameFor(target.guildId, target.roleId) ?? target.roleId;
      const suffix = readyTargets.length > 1 ? ` → ${targetLabel}` : "";
      try {
        const res = await api("/mappings", {
          method: "POST",
          body: {
            name: `${name.trim()}${suffix}`,
            sourceGuildId: sourceSnowflake,
            sourceRoleId,
            targetGuildId: targetSnowflake,
            targetRoleId: target.roleId,
            direction: target.direction,
            enabled: enableNow,
            reason: finalReason,
          },
        });
        out.push({
          key: target.key,
          ok: true,
          label: `${roleLabel} in ${targetLabel}`,
          warnings: res?.warnings ?? [],
          requiresApproval: Boolean(res?.requiresApproval),
        });
      } catch (err) {
        out.push({
          key: target.key,
          ok: false,
          label: `${roleLabel} in ${targetLabel}`,
          message: err?.message ?? "Failed",
        });
      }
    }

    setBusy(false);
    setResults(out);
    if (out.some((r) => r.ok)) {
      onCreated?.();
      // Keep the source selected so wiring one role into many servers stays a fast loop.
      setTargets([newTarget()]);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-primary-500/15 text-primary-300">
          <Wand2 className="size-5" />
        </span>
        <div>
          <h2 className="text-base font-bold text-white">Set up a mapping</h2>
          <p className="text-sm text-slate-400">
            Pick a role, then the servers it should grant a role in. One role can feed as many
            servers as you like.
          </p>
        </div>
      </div>

      {/* Source */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          When a member has…
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Server" htmlFor="src-guild">
            <Select
              id="src-guild"
              value={sourceGuildId}
              onChange={(v) => {
                setSourceGuildId(v);
                setSourceRoleId("");
              }}
              options={guildOptions}
              placeholder="Choose a server"
            />
          </Field>
          <Field label="Role" htmlFor="src-role">
            <RoleSelect
              id="src-role"
              guildPlatformId={sourceGuildId}
              catalogs={roleCatalogs}
              value={sourceRoleId}
              onChange={setSourceRoleId}
            />
          </Field>
        </div>
      </div>

      {/* Targets */}
      <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          …give them these roles
        </p>
        <div className="space-y-3">
          {targets.map((target, index) => (
            <TargetRow
              key={target.key}
              index={index}
              target={target}
              guildOptions={guildOptions}
              roleCatalogs={roleCatalogs}
              canRemove={targets.length > 1}
              onChange={(patch) =>
                setTargets((rows) =>
                  rows.map((r) => (r.key === target.key ? { ...r, ...patch } : r)),
                )
              }
              onRemove={() =>
                setTargets((rows) => rows.filter((r) => r.key !== target.key))
              }
            />
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={() => setTargets((rows) => [...rows, newTarget()])}
        >
          <Plus className="size-4" />
          Add another server
        </Button>
      </div>

      {/* Options */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field
          label="Name"
          htmlFor="map-name"
          hint="Shown in the mappings list. A per-server suffix is added automatically."
        >
          <TextInput
            id="map-name"
            value={name}
            onChange={(e) => {
              setNameTouched(true);
              setNameInput(e.target.value);
            }}
            placeholder="e.g. Community Director access"
          />
        </Field>
        <Field label="Reason" htmlFor="map-reason" hint="Recorded in the audit log.">
          <TextInput
            id="map-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional"
          />
        </Field>
      </div>

      <label className="mt-4 flex items-start gap-2.5 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={enableNow}
          onChange={(e) => setEnableNow(e.target.checked)}
          className="mt-0.5 size-4 rounded border-white/20 bg-white/5 text-primary-500 focus:ring-primary-500/40"
        />
        <span>
          Turn these on right away.{" "}
          <span className="text-slate-500">
            Leave unticked to create them disabled and test first. Mappings that touch a
            protected role always wait for a second approver.
          </span>
        </span>
      </label>

      {error && <BotError error={error} className="mt-4" />}

      {results && (
        <div className="mt-4 space-y-1.5">
          {results.map((r) => (
            <div
              key={r.key}
              className={cn(
                "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
                r.ok ? "bg-emerald-500/10 text-emerald-200" : "bg-rose-500/10 text-rose-200",
              )}
            >
              {r.ok ? (
                <ArrowRight className="mt-0.5 size-4 shrink-0" />
              ) : (
                <X className="mt-0.5 size-4 shrink-0" />
              )}
              <span className="min-w-0">
                {r.ok ? "Created" : "Failed"}: {r.label}
                {r.requiresApproval && " — waiting for a second approver"}
                {r.ok && !r.requiresApproval && r.warnings?.length > 0 && (
                  <span className="text-amber-300"> — {r.warnings.join(" ")}</span>
                )}
                {!r.ok && r.message && <span className="text-rose-300/80"> — {r.message}</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>
          Clear
        </Button>
        <Button size="sm" onClick={submit} disabled={!canSubmit}>
          {busy
            ? "Creating…"
            : readyTargets.length > 1
              ? `Create ${readyTargets.length} mappings`
              : "Create mapping"}
        </Button>
      </div>
    </Card>
  );
}

function TargetRow({ index, target, guildOptions, roleCatalogs, canRemove, onChange, onRemove }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">Server {index + 1}</span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove this server"
            className="rounded-lg p-1 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          value={target.guildId}
          onChange={(v) => onChange({ guildId: v, roleId: "" })}
          options={guildOptions}
          placeholder="Choose a server"
        />
        <RoleSelect
          guildPlatformId={target.guildId}
          catalogs={roleCatalogs}
          value={target.roleId}
          onChange={(v) => onChange({ roleId: v })}
        />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {DIRECTIONS.map((dir) => {
          const active = target.direction === dir.value;
          return (
            <button
              key={dir.value}
              type="button"
              onClick={() => onChange({ direction: dir.value })}
              title={dir.hint}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ring-1 ring-inset",
                active
                  ? "bg-primary-500/15 text-primary-200 ring-primary-400/30"
                  : "text-slate-400 ring-white/10 hover:text-white",
              )}
            >
              <dir.Icon className="size-3.5" />
              {dir.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RoleSelect({ id, guildPlatformId, catalogs, value, onChange }) {
  const entry = catalogs.get(guildPlatformId);
  const options = (entry?.roles ?? []).map((role) => ({ value: role.id, label: role.name }));

  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      disabled={!guildPlatformId || entry?.loading}
      placeholder={
        !guildPlatformId
          ? "Pick a server first"
          : entry?.loading
            ? "Loading roles…"
            : entry?.error
              ? "Couldn't load roles"
              : options.length === 0
                ? "No roles found"
                : "Choose a role"
      }
    />
  );
}

/* -------------------------------------------------------------- existing list */

function MappingGroups({ items, roleName, onTest, onToggle, onDelete }) {
  // Group by source role so "one role → many servers" reads as one block.
  const groups = useMemo(() => {
    const map = new Map();
    for (const m of items) {
      const key = `${m.sourceGuild?.discordGuildId ?? m.sourceGuildId}:${m.sourceRoleId}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          sourceGuild: m.sourceGuild,
          sourceRoleId: m.sourceRoleId,
          rows: [],
        });
      }
      map.get(key).rows.push(m);
    }
    return [...map.values()];
  }, [items]);

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const sourceLabel =
          roleName(group.sourceGuild?.id, group.sourceRoleId) ?? group.sourceRoleId;
        return (
          <Card key={group.key} className="p-5">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-white">{sourceLabel}</span>
              <span className="text-xs text-slate-500">
                in {group.sourceGuild?.name ?? group.sourceGuild?.discordGuildId} · grants{" "}
                {group.rows.length} {group.rows.length === 1 ? "role" : "roles"}
              </span>
            </div>
            <div className="space-y-2">
              {group.rows.map((mapping) => {
                const targetLabel =
                  roleName(mapping.targetGuild?.id, mapping.targetRoleId) ?? mapping.targetRoleId;
                return (
                  <div
                    key={mapping.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                  >
                    <span className="text-slate-500">
                      {mapping.direction === "TWO_WAY" ? (
                        <ArrowLeftRight className="size-4" />
                      ) : (
                        <ArrowRight className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-white">{targetLabel}</span>
                        <span className="text-xs text-slate-500">
                          in {mapping.targetGuild?.name ?? mapping.targetGuild?.discordGuildId}
                        </span>
                        <Badge tone={mapping.enabled ? "green" : "slate"} dot={mapping.enabled}>
                          {mapping.enabled ? "On" : "Off"}
                        </Badge>
                        {mapping.requiresApproval && !mapping.enabled && (
                          <Badge tone="amber">Needs approval</Badge>
                        )}
                      </div>
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => onTest(mapping.id)}>
                      <FlaskConical className="size-4" />
                      Test
                    </Button>
                    <Button
                      variant={mapping.enabled ? "ghost" : "secondary"}
                      size="sm"
                      onClick={() => onToggle(mapping)}
                    >
                      <Power className="size-4" />
                      {mapping.enabled ? "Disable" : "Enable"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => onDelete(mapping.id)}
                      aria-label="Delete mapping"
                      className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- catalogs */

/**
 * Fetches each server's Discord roles once and keeps them keyed by the platform guild
 * id. Selects read from it for their options, and the list reads from it to turn role
 * ids back into names. A guild is requested at most once for the life of the page.
 */
function useRoleCatalogs(guilds) {
  const [catalogs, setCatalogs] = useState({});
  const requested = useRef(new Set());

  useEffect(() => {
    let active = true;
    for (const guild of guilds) {
      if (requested.current.has(guild.id)) continue;
      requested.current.add(guild.id);
      setCatalogs((c) => ({ ...c, [guild.id]: { roles: [], loading: true, error: null } }));
      api(`/guilds/${encodeURIComponent(guild.id)}/discord-roles`)
        .then((data) => {
          if (!active) return;
          setCatalogs((c) => ({
            ...c,
            [guild.id]: { roles: data?.roles ?? [], loading: false, error: null },
          }));
        })
        .catch((error) => {
          if (!active) return;
          setCatalogs((c) => ({ ...c, [guild.id]: { roles: [], loading: false, error } }));
        });
    }
    return () => {
      active = false;
    };
  }, [guilds]);

  return useMemo(
    () => ({
      get: (platformId) => (platformId ? catalogs[platformId] : undefined),
      nameFor: (platformId, roleId) => {
        if (!platformId || !roleId) return null;
        return catalogs[platformId]?.roles.find((r) => r.id === roleId)?.name ?? null;
      },
    }),
    [catalogs],
  );
}
