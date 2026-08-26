import { useEffect, useMemo, useState } from "react";
import { Plus, RotateCcw, Save, Search, TriangleAlert, Trash2 } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import { api } from "../../lib/api";
import { buildNickname } from "../../lib/roster";
import {
  DEPARTMENTS,
  DIVISIONS,
  ROLE_MAP,
  SPECIAL_ROLES,
} from "../../data/rosterData";
import { cn } from "../../lib/cn";

const SNOWFLAKE = /^\d{17,20}$/;
/** The placeholder ids shipped with the repo, so unmapped rows can be flagged. */
const PLACEHOLDER = /^10000000000000\d{4}$/;

/** Badge copy for the kinds of role that are mapped but never rostered. */
const KIND_LABELS = { tag: "Tag", tier: "Tier", base: "Base" };
const KIND_TONES = { tag: "amber", tier: "rose", base: "slate" };

const DEPARTMENT_OPTIONS = DEPARTMENTS.map((d) => ({
  value: d.id,
  label: d.label,
}));

/** A sample entry so each row can show what its template actually produces. */
const SAMPLE = { characterName: "Aaron Jones", callsign: "122" };

/**
 * Every known role from the seed, overlaid with whatever has been saved.
 *
 * The server returns only the rows that were saved, so a map saved with just the
 * staff ranks in it would come back missing every department and civilian rank —
 * and those divisions would then look empty, with no way to map them. Merging keeps
 * every rank on the page (saved values winning), so a division is never blank and
 * one save fills the map out in full. Saved rows with no seed match (custom ranks)
 * are kept on the end.
 */
function mergeMaps(seedList, savedList, matchKey = "key") {
  const saved = new Map((savedList ?? []).map((row) => [row[matchKey], row]));
  const merged = seedList.map((seedRow) => {
    const match = saved.get(seedRow[matchKey]);
    return match ? { ...seedRow, ...match } : seedRow;
  });
  const seedKeys = new Set(seedList.map((row) => row[matchKey]));
  (savedList ?? []).forEach((row) => {
    if (!seedKeys.has(row[matchKey])) merged.push(row);
  });
  return merged;
}

function blankRole() {
  return {
    roleId: "",
    key: "",
    department: "staff",
    rank: "",
    rankFull: "",
    order: 100,
    displayTemplate: "{callsign} | {rank} | {surname}",
    isNew: true,
  };
}

/**
 * Every Discord role the community binds something to, in one editable table:
 * membership and whitelisting, civilian tiers, the staff ladder, each
 * department's ranks, and status tags like LOA.
 *
 * This is the layer under the permissions page. Permissions grant access to a
 * role *key*; this decides which Discord snowflake that key actually is. Getting
 * it wrong mis-ranks the whole community, which is why it sits with Directorship.
 */
export default function HubDiscordRoles() {
  const [roles, setRoles] = useState(ROLE_MAP);
  const [special, setSpecial] = useState(SPECIAL_ROLES);
  const [saved, setSaved] = useState({ roles: ROLE_MAP, special: SPECIAL_ROLES });
  const [departments, setDepartments] = useState(DEPARTMENTS);
  const [scope, setScope] = useState("staff");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api.discordRoleMap().then((data) => {
      if (!active || !data?.roles) return;
      // Merge over the seed so every rank stays on the page even if the saved map
      // only holds a subset — otherwise whole divisions look empty.
      const roles = mergeMaps(ROLE_MAP, data.roles);
      const special = mergeMaps(SPECIAL_ROLES, data.special);
      setRoles(roles);
      setSpecial(special);
      setSaved({ roles, special });
      if (data.departments?.length) setDepartments(data.departments);
    });
    return () => {
      active = false;
    };
  }, []);

  const scopeOptions = useMemo(
    () => [
      { value: "special", label: `Base, tiers & tags (${special.length})` },
      ...DIVISIONS.filter((division) =>
        departments.some((d) => d.division === division.id),
      ).map((division) => {
        const ids = departments
          .filter((d) => d.division === division.id)
          .map((d) => d.id);
        return {
          value: division.id,
          label: `${division.label} (${roles.filter((r) => ids.includes(r.department)).length})`,
        };
      }),
    ],
    [roles, special, departments],
  );

  const visibleRoles = useMemo(() => {
    if (scope === "special") return [];
    const ids = departments
      .filter((d) => d.division === scope)
      .map((d) => d.id);
    const needle = query.trim().toLowerCase();
    return roles.filter((role) => {
      if (!ids.includes(role.department)) return false;
      if (!needle) return true;
      return [role.key, role.rank, role.rankFull, role.roleId]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [roles, scope, query, departments]);

  /** Every id entered more than once, which would make role resolution random. */
  const duplicates = useMemo(() => {
    const counts = new Map();
    [...roles, ...special].forEach((role) => {
      const id = String(role.roleId ?? "").trim();
      if (!id) return;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [roles, special]);

  const unmapped = useMemo(
    () =>
      [...roles, ...special].filter(
        (role) => !role.roleId || PLACEHOLDER.test(role.roleId),
      ).length,
    [roles, special],
  );

  const invalid = useMemo(
    () =>
      [...roles, ...special].filter(
        (role) => role.roleId && !SNOWFLAKE.test(String(role.roleId).trim()),
      ).length,
    [roles, special],
  );

  const dirty =
    JSON.stringify({ roles, special }) !== JSON.stringify(saved);

  const updateRole = (key, field, value) =>
    setRoles((prev) =>
      prev.map((role) => (role.key === key ? { ...role, [field]: value } : role)),
    );

  const updateSpecial = (key, value) =>
    setSpecial((prev) =>
      prev.map((role) => (role.key === key ? { ...role, roleId: value } : role)),
    );

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.saveDiscordRoleMap({ roles, special });
      setSaved({ roles, special });
      setStatus({
        tone: result?.message ? "amber" : "green",
        text: result?.message ?? "Discord role mapping saved.",
      });
    } catch (err) {
      setStatus({ tone: "rose", text: (err.errors ?? [err.message]).join(" ") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <HubPageHeader
        icon="Key"
        eyebrow="Staff Hub"
        title="Discord Role Mapping"
        subtitle="Every rank, tier and tag bound to its Discord role. The bot reads this to decide who belongs where and what their nickname should be."
        actions={
          <>
            <Badge tone="rose">Directorship and Ownership only</Badge>
            {dirty && <Badge tone="amber" dot>Unsaved</Badge>}
          </>
        }
      />

      {status && (
        <Card className="mb-6 p-4">
          <p
            className={cn(
              "text-sm font-semibold",
              status.tone === "green"
                ? "text-emerald-300"
                : status.tone === "amber"
                  ? "text-amber-300"
                  : "text-rose-300",
            )}
          >
            {status.text}
          </p>
        </Card>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Mapped roles
          </p>
          <p className="mt-2 text-2xl font-extrabold text-white">
            {roles.length + special.length}
          </p>
        </Card>
        <Card className={cn("p-5", unmapped > 0 && "ring-1 ring-inset ring-amber-400/30")}>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Still placeholders
          </p>
          <p
            className={cn(
              "mt-2 text-2xl font-extrabold",
              unmapped > 0 ? "text-amber-400" : "text-emerald-400",
            )}
          >
            {unmapped}
          </p>
        </Card>
        <Card
          className={cn(
            "p-5",
            (duplicates.size > 0 || invalid > 0) && "ring-1 ring-inset ring-rose-400/30",
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Problems
          </p>
          <p
            className={cn(
              "mt-2 text-2xl font-extrabold",
              duplicates.size > 0 || invalid > 0 ? "text-rose-400" : "text-emerald-400",
            )}
          >
            {duplicates.size + invalid}
          </p>
        </Card>
      </div>

      {(duplicates.size > 0 || invalid > 0) && (
        <Card className="mb-6 flex items-start gap-3 p-4 ring-1 ring-inset ring-rose-400/30">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-400" />
          <p className="text-sm text-rose-200">
            {duplicates.size > 0 &&
              `${duplicates.size} Discord role ${duplicates.size === 1 ? "ID is" : "IDs are"} used more than once — which rank a member resolves to would be arbitrary. `}
            {invalid > 0 &&
              `${invalid} ${invalid === 1 ? "ID is" : "IDs are"} not a valid 17–20 digit snowflake. `}
            Saving is blocked until these are fixed.
          </p>
        </Card>
      )}

      <div className="mb-6 flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by key, rank or Discord ID"
            aria-label="Search roles"
            className="pl-11"
          />
        </div>
        <Select value={scope} onChange={setScope} options={scopeOptions} className="lg:w-64" />
      </div>

      {scope === "special" ? (
        <Card className="overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-bold text-white">Base roles, tiers and tags</h2>
            <p className="mt-1 text-xs text-slate-500">
              Not ranks, but everything else keys off them — membership,
              whitelisting, the LOA tag the bot applies and removes, and tiers
              that carry permissions without occupying a seat on a roster.
            </p>
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {special.map((role) => (
              <li key={role.key} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    {role.label}
                    <Badge tone={KIND_TONES[role.kind] ?? "slate"}>
                      {KIND_LABELS[role.kind] ?? "Base"}
                    </Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{role.detail}</p>
                  <code className="mt-1 inline-block text-[10px] text-slate-600">
                    {role.key}
                  </code>
                </div>
                <RoleIdInput
                  value={role.roleId}
                  onChange={(value) => updateSpecial(role.key, value)}
                  duplicate={duplicates.has(String(role.roleId).trim())}
                  label={`Discord role ID for ${role.label}`}
                />
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[62rem] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-5 py-3 font-bold">Rank</th>
                  <th className="px-3 py-3 font-bold">Department</th>
                  <th className="px-3 py-3 font-bold">Discord role ID</th>
                  <th className="px-3 py-3 text-right font-bold">Order</th>
                  <th className="px-3 py-3 font-bold">Nickname preview</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {visibleRoles.map((role) => {
                  const department = departments.find((d) => d.id === role.department);
                  return (
                    <tr key={role.key} className="transition hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1.5">
                          <TextInput
                            value={role.rank}
                            onChange={(e) => updateRole(role.key, "rank", e.target.value)}
                            aria-label={`Short rank for ${role.key}`}
                            className="h-9 max-w-[10rem] text-sm"
                          />
                          <TextInput
                            value={role.rankFull ?? ""}
                            onChange={(e) => updateRole(role.key, "rankFull", e.target.value)}
                            aria-label={`Full rank label for ${role.key}`}
                            className="h-8 max-w-[14rem] text-xs"
                          />
                          <code className="text-[10px] text-slate-600">{role.key}</code>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <Select
                          value={role.department}
                          onChange={(value) => updateRole(role.key, "department", value)}
                          options={DEPARTMENT_OPTIONS}
                          className="w-48"
                        />
                      </td>
                      <td className="px-3 py-3.5">
                        <RoleIdInput
                          value={role.roleId}
                          onChange={(value) => updateRole(role.key, "roleId", value)}
                          duplicate={duplicates.has(String(role.roleId).trim())}
                          label={`Discord role ID for ${role.key}`}
                        />
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <TextInput
                          value={role.order}
                          inputMode="numeric"
                          onChange={(e) => updateRole(role.key, "order", e.target.value)}
                          aria-label={`Precedence for ${role.key}`}
                          className="h-9 w-20 text-right text-sm"
                        />
                      </td>
                      <td className="px-3 py-3.5">
                        <code className="text-xs text-slate-400">
                          {buildNickname(
                            { ...SAMPLE, rank: role.rank },
                            department,
                            role.displayTemplate,
                          )}
                        </code>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setRoles((prev) => prev.filter((r) => r.key !== role.key))
                          }
                          aria-label={`Remove ${role.key}`}
                          className="grid size-8 place-items-center rounded-lg text-slate-500 ring-1 ring-inset ring-white/10 transition hover:bg-rose-500/10 hover:text-rose-400"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {visibleRoles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">
                      No roles here yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-lg text-xs text-slate-500">
          Precedence is highest-wins, so a member holding several mapped roles is
          rostered under the highest order — which is why a promotion works without
          removing the old role first.
        </p>
        <div className="flex flex-wrap gap-3">
          {scope !== "special" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRoles((prev) => [...prev, blankRole()])}
            >
              <Plus className="size-4" />
              Add role
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRoles(saved.roles);
              setSpecial(saved.special);
            }}
            disabled={!dirty}
          >
            <RotateCcw className="size-4" />
            Discard
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={saving || !dirty || duplicates.size > 0 || invalid > 0}
          >
            <Save className="size-4" />
            {saving ? "Saving…" : "Save mapping"}
          </Button>
        </div>
      </div>
    </>
  );
}

/** Snowflake field that flags an unmapped placeholder or a duplicate inline. */
function RoleIdInput({ value, onChange, duplicate, label }) {
  const text = String(value ?? "").trim();
  const placeholder = !text || PLACEHOLDER.test(text);
  const malformed = text && !SNOWFLAKE.test(text);

  return (
    <div className="min-w-[13rem]">
      <TextInput
        value={value ?? ""}
        inputMode="numeric"
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        placeholder="Discord role ID"
        className={cn(
          "h-9 font-mono text-xs",
          (malformed || duplicate) && "ring-rose-400/50",
          !malformed && !duplicate && placeholder && "ring-amber-400/40",
        )}
      />
      {(malformed || duplicate || placeholder) && (
        <p
          className={cn(
            "mt-1 text-[10px] font-bold uppercase tracking-[0.14em]",
            malformed || duplicate ? "text-rose-400" : "text-amber-400/80",
          )}
        >
          {duplicate
            ? "Duplicate ID"
            : malformed
              ? "Not a snowflake"
              : "Not mapped yet"}
        </p>
      )}
    </div>
  );
}
