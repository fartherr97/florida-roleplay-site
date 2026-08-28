import { useEffect, useMemo, useState } from "react";
import { Check, Plus, ShieldAlert, Trash2 } from "lucide-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import DeptPageHeader from "../../components/dept/DeptPageHeader";
import { useAuth } from "../../context/useAuth";
import { useDeptConfig } from "../../context/useDeptConfig";
import { CAPABILITIES, accessLevelFor } from "../../lib/departmentConfig";
import { api } from "../../lib/api";
import { cn } from "../../lib/cn";

/**
 * Who may do what inside this department.
 *
 * Everything is bound to a Discord role, exactly as the rest of the community's
 * permissions are — this page is the department-scoped counterpart to the site
 * permissions page, and the two use the same role keys.
 *
 * Two rules keep it from being a way to lock people out:
 *  - You cannot edit a grant at or above your own level, so a Lieutenant cannot
 *    demote the Colonel who granted them access.
 *  - The table must always leave someone able to manage the site. The server
 *    refuses a save that would not, so this is a second copy of that rule, not
 *    the only one.
 */
export default function DeptAccess({ page, config }) {
  const { user } = useAuth();
  const { can, mutate, saveMessage, saveState } = useDeptConfig();
  const [roles, setRoles] = useState([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.rosterRoleMap().then((result) => {
      if (active) setRoles(result?.roles ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  const editable = can("manageAccess");
  const myLevel = accessLevelFor(config, user?.roles ?? [], new Set());
  // Community-wide `departments.access.manage` outranks everything configured
  // here, which is what makes a locked-out department recoverable.
  const level = can("manage") ? Infinity : myLevel;

  const grants = useMemo(() => config.access ?? [], [config.access]);
  const grantedKeys = useMemo(() => new Set(grants.map((g) => g.roleKey)), [grants]);

  /** Roles worth offering: this department's own ranks first, then the rest. */
  const options = useMemo(() => {
    const mine = roles.filter((role) => role.department === config.id);
    const others = roles.filter((role) => role.department !== config.id);
    return [...mine, ...others].filter((role) => !grantedKeys.has(role.key));
  }, [config.id, grantedKeys, roles]);

  const update = (roleKey, changes) => {
    setError("");
    const next = grants.map((grant) =>
      grant.roleKey === roleKey ? { ...grant, ...changes } : grant,
    );
    if (!next.some((grant) => grant.manage)) {
      setError("Someone has to be able to manage this site — otherwise nobody could undo it.");
      return;
    }
    mutate((current) => ({ ...current, access: next }));
  };

  const remove = (roleKey) => {
    setError("");
    const next = grants.filter((grant) => grant.roleKey !== roleKey);
    if (!next.some((grant) => grant.manage)) {
      setError("That would leave nobody able to manage this site.");
      return;
    }
    mutate((current) => ({ ...current, access: next }));
  };

  const add = (roleKey, label, grantLevel) => {
    mutate((current) => ({
      ...current,
      access: [
        ...(current.access ?? []),
        {
          roleKey,
          label,
          level: grantLevel,
          manage: false,
          editRoster: false,
          editStructure: false,
          manageCalendar: false,
          manageLog: false,
          manageAccess: false,
          viewAudit: true,
        },
      ],
    }));
    setAdding(false);
  };

  return (
    <>
      <DeptPageHeader
        icon={page.icon}
        eyebrow={config.branding.shortName}
        title={page.label}
        subtitle="Every capability here is granted to a Discord role. Change the role in Discord and access follows on the next request."
        actions={
          editable && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Grant a role
            </Button>
          )
        }
      />

      {!editable && (
        <Card className="mb-5 flex items-start gap-3 p-5">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-400" />
          <p className="text-sm text-slate-400">
            You can read this table but not change it. Managing access needs the “Manage access”
            capability from this department's command staff, or the community-wide department
            permission.
          </p>
        </Card>
      )}

      {(error || (saveState === "error" && saveMessage)) && (
        <p className="mb-5 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-400/25">
          {error || saveMessage}
        </p>
      )}

      {adding && (
        <AddGrant options={options} onCancel={() => setAdding(false)} onAdd={add} maxLevel={level} />
      )}

      {grants.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-slate-400">
            No Discord role can manage this department yet — only community-wide department
            managers can reach it.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {[...grants]
            .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))
            .map((grant) => {
              const locked = !editable || (grant.level ?? 0) >= level;
              return (
                <Card key={grant.roleKey} className="p-5">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white">{grant.label}</div>
                      <code className="text-xs text-slate-500">{grant.roleKey}</code>
                    </div>
                    <Badge tone="slate">Level {grant.level}</Badge>
                    {locked && editable && <Badge tone="amber">Above your level</Badge>}
                    {editable && !locked && (
                      <button
                        type="button"
                        onClick={() => remove(grant.roleKey)}
                        aria-label={`Remove ${grant.label}`}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {CAPABILITIES.map((capability) => {
                      const on = !!grant[capability.key];
                      return (
                        <button
                          key={capability.key}
                          type="button"
                          disabled={locked}
                          onClick={() => update(grant.roleKey, { [capability.key]: !on })}
                          title={capability.detail}
                          className={cn(
                            "flex items-start gap-2.5 rounded-xl p-3 text-left ring-1 ring-inset transition",
                            on
                              ? "dept-accent-tile"
                              : "bg-white/[0.02] text-slate-400 ring-white/[0.06]",
                            locked ? "cursor-not-allowed opacity-60" : "hover:bg-white/[0.06]",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 grid size-4 shrink-0 place-items-center rounded ring-1 ring-inset",
                              on ? "dept-accent-bg ring-transparent text-white" : "ring-white/20",
                            )}
                          >
                            {on && <Check className="size-3" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold">{capability.label}</span>
                            <span className="mt-0.5 block text-[11px] leading-snug opacity-80">
                              {capability.detail}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
        </div>
      )}
    </>
  );
}

/** Picks a Discord role and the level its grant sits at. */
function AddGrant({ options, onCancel, onAdd, maxLevel }) {
  const [roleKey, setRoleKey] = useState("");
  const [level, setLevel] = useState("1");

  const chosen = options.find((role) => role.key === roleKey);
  // Never offer a level at or above the granter's own.
  const levels = [0, 1, 2, 3].filter((value) => value < maxLevel);

  return (
    <Card className="mb-5 p-5">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <Field label="Discord role" htmlFor="grant-role">
          <Select
            id="grant-role"
            value={roleKey}
            onChange={setRoleKey}
            placeholder="Choose a role…"
            options={options.map((role) => ({
              value: role.key,
              label: `${role.rankFull || role.rank} — ${role.department}`,
            }))}
          />
        </Field>
        <Field label="Level" htmlFor="grant-level" hint="Higher levels administer lower ones.">
          <Select
            id="grant-level"
            value={level}
            onChange={setLevel}
            options={levels.map((value) => ({ value, label: String(value) }))}
          />
        </Field>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!chosen}
            onClick={() => onAdd(chosen.key, chosen.rankFull || chosen.rank, Number(level))}
          >
            Add
          </Button>
        </div>
      </div>
      {options.length === 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Every mapped Discord role already has a grant here.
        </p>
      )}
    </Card>
  );
}
