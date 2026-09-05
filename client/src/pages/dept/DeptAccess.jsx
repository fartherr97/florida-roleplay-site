import { useEffect, useMemo, useState } from "react";
import { Check, Plus, ShieldAlert, Trash2, Users, X } from "lucide-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
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
  const { id, can, reload, saveMessage, saveState } = useDeptConfig();
  const [roles, setRoles] = useState([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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

  // Saved through the access endpoint rather than the whole-config save: that
  // one needs the full Builder ("manage"), while this page is open to anyone
  // with "manageAccess" — the narrower route is the one they are allowed to hit.
  const saveAccess = async (next) => {
    setSaving(true);
    setError("");
    try {
      const result = await api.saveDeptAccess(id, next);
      if (result?.ok === false) {
        setError(result.errors?.join(" ") || result.message || "That change was rejected.");
        return false;
      }
      reload();
      return true;
    } catch (err) {
      setError(err?.errors?.join(" ") || err?.message || "That change was rejected.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const update = (roleKey, changes) => {
    setError("");
    const next = grants.map((grant) =>
      grant.roleKey === roleKey ? { ...grant, ...changes } : grant,
    );
    if (!next.some((grant) => grant.manage)) {
      setError("Someone has to be able to manage this site — otherwise nobody could undo it.");
      return;
    }
    saveAccess(next);
  };

  const remove = (roleKey) => {
    setError("");
    const next = grants.filter((grant) => grant.roleKey !== roleKey);
    if (!next.some((grant) => grant.manage)) {
      setError("That would leave nobody able to manage this site.");
      return;
    }
    saveAccess(next);
  };

  const add = async (roleKey, label, grantLevel) => {
    const ok = await saveAccess([
      ...grants,
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
    ]);
    if (ok) setAdding(false);
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
                          disabled={locked || saving}
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

      <UnitEditors config={config} deptId={id} editable={editable} onSaved={reload} />
    </>
  );
}

/**
 * Who may arrange each unit roster, by Discord user id.
 *
 * A subdivision head usually holds no department-wide capability — they run one
 * unit, not the roster. Naming their Discord id on their unit lets them place
 * members into its bands and edit those members' columns from the unit's own
 * tab, and nothing else. Saved on its own endpoint (manageAccess), like the
 * grants above.
 */
function UnitEditors({ config, deptId, editable, onSaved }) {
  const subdivisions = config.roster?.subdivisions ?? [];
  const mainId = (subdivisions.find((sub) => sub.main) ?? subdivisions[0])?.id;
  const units = subdivisions.filter((sub) => sub.id !== mainId);
  const [names, setNames] = useState({});
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  // Names for the ids, so a pasted snowflake reads as a person once saved.
  useEffect(() => {
    let active = true;
    api.deptRoster(deptId).then((result) => {
      if (!active) return;
      const map = {};
      for (const sub of result?.subdivisions ?? []) {
        for (const category of sub.categories ?? []) {
          for (const member of category.members ?? []) {
            if (member.discordId && /^\d{17,20}$/.test(member.discordId)) {
              map[member.discordId] = member.characterName || member.displayName;
            }
          }
        }
      }
      setNames(map);
    });
    return () => {
      active = false;
    };
  }, [deptId]);

  const save = async (subId, ids) => {
    setBusy(subId);
    setError("");
    try {
      const result = await api.saveDeptUnitEditors(deptId, { [subId]: ids });
      if (result?.ok === false) {
        setError(result.errors?.join(" ") || result.message || "Could not save the unit editors.");
        return;
      }
      setDrafts((d) => ({ ...d, [subId]: "" }));
      onSaved();
    } catch (err) {
      setError(err?.errors?.join(" ") || err?.message || "Could not save the unit editors.");
    } finally {
      setBusy("");
    }
  };

  const addIds = (sub) => {
    const pasted = String(drafts[sub.id] ?? "")
      .split(/[\s,;]+/)
      .map((v) => v.replace(/[<@!>]/g, "").trim())
      .filter(Boolean);
    const valid = pasted.filter((v) => /^\d{17,20}$/.test(v));
    if (valid.length === 0) {
      setError("Paste one or more Discord user ids (17–20 digits).");
      return;
    }
    save(sub.id, [...new Set([...(sub.editorIds ?? []), ...valid])]);
  };

  return (
    <Card className="mt-8 p-5">
      <div className="mb-1 flex items-center gap-2">
        <Users className="size-4 text-slate-400" />
        <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-white">Unit roster editors</h3>
      </div>
      <p className="mb-4 text-sm text-slate-400">
        Let a subdivision head run their own unit tab without department-wide roster access. Paste
        their Discord user id under the unit; they can then place members into that unit's bands and
        edit those members' columns, and nothing else. Anyone with “Arrange the roster” above already
        covers every unit.
      </p>

      {error && (
        <p className="mb-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-400/25">
          {error}
        </p>
      )}

      {units.length === 0 ? (
        <p className="text-sm text-slate-500">
          This department has no unit rosters yet. Add one under Roster → “Add a unit” in the Builder.
        </p>
      ) : (
        <div className="space-y-4">
          {units.map((sub) => {
            const ids = sub.editorIds ?? [];
            return (
              <div key={sub.id} className="rounded-2xl bg-white/[0.02] p-4 ring-1 ring-inset ring-white/[0.06]">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-white">{sub.name}</span>
                  <Badge tone="slate">{ids.length === 1 ? "1 editor" : `${ids.length} editors`}</Badge>
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  {ids.length === 0 && (
                    <span className="text-xs text-slate-500">Nobody yet — only department roster editors can arrange this unit.</span>
                  )}
                  {ids.map((uid) => (
                    <span
                      key={uid}
                      className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] py-1 pl-3 pr-1.5 text-xs ring-1 ring-inset ring-white/[0.08]"
                    >
                      <span className="font-semibold text-slate-200">{names[uid] || "Unknown member"}</span>
                      <code className="text-[11px] text-slate-500">{uid}</code>
                      {editable && (
                        <button
                          type="button"
                          disabled={busy === sub.id}
                          onClick={() => save(sub.id, ids.filter((v) => v !== uid))}
                          aria-label={`Remove ${names[uid] || uid} from ${sub.name} editors`}
                          className="grid size-5 place-items-center rounded-full text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {editable && (
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="Discord user id(s)" htmlFor={`ue-${sub.id}`} className="min-w-64 flex-1">
                      <TextInput
                        id={`ue-${sub.id}`}
                        value={drafts[sub.id] ?? ""}
                        onChange={(e) => setDrafts((d) => ({ ...d, [sub.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addIds(sub);
                          }
                        }}
                        placeholder="Paste one or more ids, separated by spaces or commas"
                        className="h-10"
                      />
                    </Field>
                    <Button size="sm" disabled={busy === sub.id || !(drafts[sub.id] ?? "").trim()} onClick={() => addIds(sub)}>
                      <Plus className="size-4" />
                      {busy === sub.id ? "Saving…" : "Add"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
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
