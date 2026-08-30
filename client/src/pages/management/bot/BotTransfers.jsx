import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Loader,
  Pencil,
  Users,
  XCircle,
} from "lucide-react";
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
import { cn } from "../../../lib/cn";

/**
 * ES Transfer Portal.
 *
 * A transfer strips the outgoing department's roles in its Discord server and
 * grants the incoming department's roles in its server. Which roles define a
 * department is configured here, per department; running a transfer then only
 * needs the member and the two departments.
 *
 * Two capabilities gate the two halves. `transfer.manage` configures the role
 * sets; `transfer.execute` runs a move. The API enforces both — this only hides
 * what the caller cannot use.
 */
function hasCap(capabilities, key) {
  return capabilities.some((c) => {
    const value = typeof c === "string" ? c : c?.capability;
    return typeof value === "string" && value.toUpperCase() === key;
  });
}

export default function BotTransfers() {
  const { capabilities } = useBotAuth();
  const canManage = hasCap(capabilities, "TRANSFER.MANAGE");
  const canExecute = hasCap(capabilities, "TRANSFER.EXECUTE");

  const config = useBotResource("/transfers/config", { skip: !canManage && !canExecute });

  const guilds = useMemo(() => config.data?.guilds ?? [], [config.data]);
  // A department can be transferred OUT of only if it has a "roles removed" set, and
  // transferred INTO only if it has a "roles added" set — the two are independent.
  const fromEndpoints = useMemo(
    () => guilds.filter((g) => (g.stripRoleIds ?? []).length > 0),
    [guilds],
  );
  const toEndpoints = useMemo(
    () => guilds.filter((g) => (g.grantRoleIds ?? []).length > 0),
    [guilds],
  );

  if (!canManage && !canExecute) {
    return (
      <Empty title="Transfers are restricted">
        Moving members between departments needs the <code>transfer.execute</code>{" "}
        capability, and configuring the role sets needs <code>transfer.manage</code>.
        Ask an admin to grant them on the Permissions screen.
      </Empty>
    );
  }

  if (config.error) return <BotError error={config.error} onRetry={config.reload} />;
  if (config.loading) return <Loading />;

  return (
    <div className="space-y-10">
      {canExecute && (
        <ProcessTransfer
          fromEndpoints={fromEndpoints}
          toEndpoints={toEndpoints}
          onDone={config.reload}
        />
      )}

      {canManage && (
        <DepartmentConfig guilds={guilds} onSaved={config.reload} />
      )}

      {canExecute && <TransferHistory guilds={guilds} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Process a transfer                                                  */
/* ------------------------------------------------------------------ */

const TERMINAL = new Set(["completed", "failed", "partial", "expired"]);

function ProcessTransfer({ fromEndpoints, toEndpoints, onDone }) {
  const [discordUserId, setDiscordUserId] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(null); // { jobId, state, result }

  // Role names for the two chosen departments, so the preview reads as names
  // rather than snowflakes.
  const fromRoles = useBotResource(
    fromId ? `/guilds/${fromId}/discord-roles` : "",
    { skip: !fromId },
  );
  const toRoles = useBotResource(toId ? `/guilds/${toId}/discord-roles` : "", { skip: !toId });

  const nameMap = useMemo(() => {
    const map = new Map();
    for (const role of fromRoles.data?.roles ?? []) map.set(role.id, role.name);
    for (const role of toRoles.data?.roles ?? []) map.set(role.id, role.name);
    return map;
  }, [fromRoles.data, toRoles.data]);

  const fromOptions = fromEndpoints.map((g) => ({ value: g.id, label: g.name ?? g.id }));
  const toOptions = toEndpoints.map((g) => ({ value: g.id, label: g.name ?? g.id }));
  const ready = discordUserId.trim() && fromId && toId && fromId !== toId;

  // Any change to the request invalidates a stale preview, so clear it from the
  // handlers that change the request rather than reacting to it in an effect.
  const changeUser = (value) => {
    setDiscordUserId(value);
    setPreview(null);
  };
  const changeFrom = (value) => {
    setFromId(value);
    setPreview(null);
  };
  const changeTo = (value) => {
    setToId(value);
    setPreview(null);
  };

  const runPreview = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await api("/transfers/preview", {
        method: "POST",
        body: { discordUserId: discordUserId.trim(), fromGuildId: fromId, toGuildId: toId },
      });
      setPreview(result);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const canTransfer =
    fromOptions.length > 0 &&
    toOptions.length > 0 &&
    new Set([...fromOptions, ...toOptions].map((o) => o.value)).size >= 2;

  if (!canTransfer) {
    return (
      <section>
        <SectionHeading
          icon={Users}
          title="Process a transfer"
          subtitle="Move a member from one department to another."
        />
        <Empty title="Not enough departments configured">
          A transfer needs a department with a &ldquo;roles removed&rdquo; set to move out
          of, and a different one with a &ldquo;roles added&rdquo; set to move into.
          Configure them below first.
        </Empty>
      </section>
    );
  }

  return (
    <section>
      <SectionHeading
        icon={Users}
        title="Process a transfer"
        subtitle="Strip the outgoing department's roles and grant the incoming department's."
      />

      <Card className="space-y-4 p-5">
        <Field label="Member's Discord ID" htmlFor="t-user" required>
          <TextInput
            id="t-user"
            value={discordUserId}
            onChange={(e) => changeUser(e.target.value)}
            placeholder="e.g. 123456789012345678"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <Field label="From department" htmlFor="t-from" required>
            <Select
              id="t-from"
              value={fromId}
              onChange={changeFrom}
              placeholder="Outgoing"
              options={fromOptions.filter((o) => o.value !== toId)}
            />
          </Field>
          <div className="hidden pb-2.5 text-slate-500 sm:block">
            <ArrowRight className="size-5" />
          </div>
          <Field label="To department" htmlFor="t-to" required>
            <Select
              id="t-to"
              value={toId}
              onChange={changeTo}
              placeholder="Incoming"
              options={toOptions.filter((o) => o.value !== fromId)}
            />
          </Field>
        </div>

        {fromId && toId && fromId === toId && (
          <p className="text-sm text-amber-300">
            The outgoing and incoming departments must be different.
          </p>
        )}

        <Field label="Reason" htmlFor="t-reason">
          <TextInput
            id="t-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional — shown in the Discord audit log and history"
          />
        </Field>

        {error && (
          <p className="text-sm text-rose-300">{error.message ?? "Something went wrong."}</p>
        )}

        {!preview ? (
          <div className="flex justify-end">
            <Button onClick={runPreview} disabled={!ready || busy}>
              {busy ? "Checking…" : "Preview transfer"}
            </Button>
          </div>
        ) : (
          <PreviewPanel
            preview={preview}
            nameMap={nameMap}
            reason={reason}
            busy={busy}
            job={job}
            onCancel={() => setPreview(null)}
            onConfirm={async () => {
              setError(null);
              setBusy(true);
              setJob(null);
              try {
                const queued = await api("/transfers", {
                  method: "POST",
                  body: {
                    discordUserId: discordUserId.trim(),
                    fromGuildId: fromId,
                    toGuildId: toId,
                    reason: reason.trim() || undefined,
                  },
                });
                setJob({ jobId: queued.jobId, state: "queued", result: null });
              } catch (err) {
                setError(err);
                setBusy(false);
              }
            }}
            onSettled={(final) => {
              setBusy(false);
              onDone?.();
              // Clear the form on a clean run so the next transfer starts fresh.
              if (final?.state === "completed") {
                setDiscordUserId("");
                setReason("");
                setPreview(null);
                setJob(null);
              }
            }}
          />
        )}
      </Card>
    </section>
  );
}

function PreviewPanel({ preview, nameMap, busy, job, onConfirm, onCancel, onSettled }) {
  const label = (id) => nameMap.get(id) ?? id;

  return (
    <div className="space-y-4 rounded-xl bg-black/20 p-4 ring-1 ring-inset ring-white/[0.06]">
      <div className="grid gap-4 sm:grid-cols-2">
        <RoleColumn
          tone="rose"
          heading={`Remove in ${preview.from?.name ?? "outgoing"}`}
          ids={preview.from?.removeRoleIds ?? []}
          label={label}
        />
        <RoleColumn
          tone="emerald"
          heading={`Add in ${preview.to?.name ?? "incoming"}`}
          ids={preview.to?.addRoleIds ?? []}
          label={label}
        />
      </div>

      <p className="text-xs leading-relaxed text-slate-500">
        A role the member does not already hold (or already has) is skipped, so the
        applied numbers may be lower than shown.
      </p>

      {job ? (
        <TransferResult job={job} onSettled={onSettled} />
      ) : (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Back
          </Button>
          <Button type="button" onClick={onConfirm} disabled={busy}>
            {busy ? "Starting…" : "Confirm & transfer"}
          </Button>
        </div>
      )}
    </div>
  );
}

function RoleColumn({ tone, heading, ids, label }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {heading}
      </p>
      {ids.length === 0 ? (
        <p className="text-sm text-slate-500">None configured.</p>
      ) : (
        <ul className="space-y-1.5">
          {ids.map((id) => (
            <li key={id} className="flex items-center gap-2 text-sm text-slate-200">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  tone === "rose" ? "bg-rose-400" : "bg-emerald-400",
                )}
              />
              <span className="truncate">{label(id)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Polls one queued transfer until it settles, then shows what happened. */
function TransferResult({ job, onSettled }) {
  const [state, setState] = useState(job);
  const settledRef = useRef(false);

  useEffect(() => {
    if (!job?.jobId) return undefined;
    let active = true;
    settledRef.current = false;

    const tick = async () => {
      try {
        const next = await api(`/transfers/${encodeURIComponent(job.jobId)}`);
        if (!active) return;
        setState(next);
        if (TERMINAL.has(next.state)) {
          settledRef.current = true;
          onSettled?.(next);
          return;
        }
      } catch {
        // Transient read error — keep polling; the interval will try again.
      }
      if (active && !settledRef.current) setTimeout(tick, 1200);
    };
    tick();

    return () => {
      active = false;
    };
    // onSettled is an inline callback; re-running would start a second poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.jobId]);

  const running = !TERMINAL.has(state.state);
  const result = state.result;
  const failed = result?.failed ?? [];

  const OUTCOME = {
    completed: { label: "Completed", tone: "green", Icon: CheckCircle2 },
    partial: { label: "Partly completed", tone: "amber", Icon: CircleAlert },
    failed: { label: "Failed", tone: "rose", Icon: XCircle },
    expired: { label: "Expired", tone: "slate", Icon: CircleAlert },
  };
  const outcome = OUTCOME[state.state];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <>
            <Loader className="size-4 animate-spin text-slate-400" />
            <span className="text-sm font-semibold text-white">
              Applying the transfer…
            </span>
            <Badge tone="slate">{state.state}</Badge>
          </>
        ) : (
          outcome && (
            <>
              <outcome.Icon
                className={cn(
                  "size-4",
                  outcome.tone === "green" && "text-emerald-400",
                  outcome.tone === "amber" && "text-amber-400",
                  outcome.tone === "rose" && "text-rose-400",
                  outcome.tone === "slate" && "text-slate-400",
                )}
              />
              <span className="text-sm font-semibold text-white">Transfer</span>
              <Badge tone={outcome.tone}>{outcome.label}</Badge>
            </>
          )
        )}
      </div>

      {result && (
        <dl className="flex flex-wrap gap-x-5 gap-y-1.5">
          <Count label="Removed" value={result.removed?.length ?? 0} />
          <Count label="Added" value={result.added?.length ?? 0} />
          <Count label="Skipped" value={result.skipped?.length ?? 0} />
          <Count label="Failed" value={failed.length} />
        </dl>
      )}

      {failed.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-200 ring-1 ring-inset ring-rose-400/25">
          {failed.map((f, i) => (
            <li key={`${f.id}-${i}`}>
              <span className="font-semibold uppercase">{f.side}</span> {f.message}
            </li>
          ))}
        </ul>
      )}

      {state.failedReason && !result && (
        <p className="text-sm text-rose-300">{state.failedReason}</p>
      )}
    </div>
  );
}

function Count({ label, value }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="text-sm font-bold text-white">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Department configuration                                            */
/* ------------------------------------------------------------------ */

function DepartmentConfig({ guilds, onSaved }) {
  const [editing, setEditing] = useState(null);

  return (
    <section>
      <SectionHeading
        icon={Pencil}
        title="Department transfer roles"
        subtitle="Two separate sets per department: the roles stripped when a member leaves it, and the roles added when a member joins it."
      />

      {guilds.length === 0 ? (
        <Empty title="No servers">
          No connected servers were returned. Add one on the Servers screen first.
        </Empty>
      ) : (
        <Card className="divide-y divide-white/[0.06]">
          {guilds.map((guild) => {
            const strip = (guild.stripRoleIds ?? []).length;
            const grant = (guild.grantRoleIds ?? []).length;
            return (
              <div key={guild.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{guild.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {strip === 0 && grant === 0
                      ? "No transfer roles set"
                      : `Removes ${strip} · adds ${grant}`}
                  </p>
                </div>
                {strip > 0 && (
                  <Badge tone="rose">{strip} out</Badge>
                )}
                {grant > 0 && (
                  <Badge tone="green">{grant} in</Badge>
                )}
                <Button size="sm" variant="ghost" onClick={() => setEditing(guild)}>
                  <Pencil className="size-4" />
                  Edit
                </Button>
              </div>
            );
          })}
        </Card>
      )}

      {editing && (
        <EditRolesDialog
          guild={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onSaved?.();
          }}
        />
      )}
    </section>
  );
}

function EditRolesDialog({ guild, onClose, onSaved }) {
  const [strip, setStrip] = useState(guild.stripRoleIds ?? []);
  const [grant, setGrant] = useState(guild.grantRoleIds ?? []);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const toggle = (setter) => (role) => {
    setter((current) =>
      current.some((id) => String(id) === String(role.id))
        ? current.filter((id) => String(id) !== String(role.id))
        : [...current, role.id],
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api("/transfers/config", {
        method: "POST",
        body: {
          guildId: guild.id,
          stripRoleIds: strip,
          grantRoleIds: grant,
          reason: reason.trim() || undefined,
        },
      });
      onSaved();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Transfer roles — ${guild.name}`}
      className="max-w-2xl"
    >
      <form onSubmit={submit} className="space-y-5">
        <p className="text-sm text-slate-400">
          Two independent sets. The first is stripped from a member{" "}
          <span className="font-semibold text-rose-300">leaving</span> this department; the
          second is granted to a member{" "}
          <span className="font-semibold text-emerald-300">joining</span> it. They can be
          the same or different.
        </p>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-rose-300">
              Roles removed when leaving
            </p>
            <span className="text-xs text-slate-500">{strip.length} selected</span>
          </div>
          <DiscordRolePicker
            guildId={guild.id}
            value={strip}
            onChange={toggle(setStrip)}
            multiple
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300">
              Roles added when joining
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setGrant(strip)}
                className="text-xs text-slate-400 underline-offset-2 hover:text-white hover:underline"
              >
                Copy from removed
              </button>
              <span className="text-xs text-slate-500">{grant.length} selected</span>
            </div>
          </div>
          <DiscordRolePicker
            guildId={guild.id}
            value={grant}
            onChange={toggle(setGrant)}
            multiple
          />
        </div>

        <Field label="Reason" htmlFor="c-reason">
          <TextInput
            id="c-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional — why these roles changed"
          />
        </Field>

        {error && (
          <p className="text-sm text-rose-300">{error.message ?? "Couldn't save."}</p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save roles"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

function TransferHistory({ guilds }) {
  const history = useBotResource("/transfers?limit=15");
  const nameById = useMemo(() => {
    const map = new Map();
    for (const g of guilds) map.set(g.id, g.name);
    return map;
  }, [guilds]);

  const transfers = history.data?.transfers ?? [];

  return (
    <section>
      <SectionHeading title="Recent transfers" subtitle="The last few moves, newest first." />

      {history.error ? (
        <BotError error={history.error} onRetry={history.reload} />
      ) : history.loading ? (
        <Loading />
      ) : transfers.length === 0 ? (
        <Empty title="No transfers yet">Transfers you run will be listed here.</Empty>
      ) : (
        <Card className="divide-y divide-white/[0.06]">
          {transfers.map((row) => {
            const state = row.newState ?? {};
            const from = state.fromName ?? nameById.get(state.fromGuildId) ?? "—";
            const to = state.toName ?? nameById.get(state.toGuildId) ?? "—";
            const failedCount = Array.isArray(state.failed) ? state.failed.length : 0;
            return (
              <div key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm text-white">
                    <span className="font-semibold">{from}</span>
                    <ArrowRight className="size-3.5 text-slate-500" />
                    <span className="font-semibold">{to}</span>
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {row.targetDiscordId}
                    {row.reason ? ` · ${row.reason}` : ""}
                    {" · "}
                    {formatWhen(row.createdAt)}
                    {row.actor?.displayName ? ` · by ${row.actor.displayName}` : ""}
                  </p>
                </div>
                <Badge tone={row.success ? "green" : failedCount > 0 ? "rose" : "amber"}>
                  {row.success ? "Completed" : state.status ?? "Failed"}
                </Badge>
              </div>
            );
          })}
        </Card>
      )}
    </section>
  );
}

function formatWhen(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

/* ------------------------------------------------------------------ */

function SectionHeading({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-white">
        {Icon && <Icon className="size-4 text-slate-400" />}
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
    </div>
  );
}
