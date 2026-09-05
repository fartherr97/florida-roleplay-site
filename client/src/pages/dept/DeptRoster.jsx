import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, BarChart3, ListOrdered, Pencil, Plus, SlidersHorizontal, Sparkles, Trash2, Users } from "lucide-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import DeptBrandMark from "../../components/dept/DeptBrandMark";
import RosterFilters from "../../components/roster/RosterFilters";
import RosterHeader from "../../components/roster/RosterHeader";
import RosterTable from "../../components/roster/RosterTable";
import StatusEditor, { StatusPill } from "../../components/hub/StatusEditor";
import { useAuth } from "../../context/useAuth";
import { useDeptConfig } from "../../context/useDeptConfig";
import { statValue } from "../../lib/deptRoster";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { ACTIVITY_STATUSES } from "../../data/rosterData";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...ACTIVITY_STATUSES.map((s) => ({ value: s.id, label: s.label })),
];

// Column ids the manual editor never touches — they come from the Discord sync,
// the nickname, or the status editor, so the server drops them anyway. Kept in
// step with RESERVED_MEMBER_KEYS in server/src/routes/departmentHub.js.
const RESERVED_FIELD_IDS = new Set([
  "id", "discordId", "characterName", "displayName", "department",
  "rank", "rankFull", "rankColor", "callsign", "status", "source", "loaUntil", "joinedAt",
]);

/**
 * A department's personnel.
 *
 * The layout is the department's own — which bands exist, what colour each one
 * is, which columns show — but the people in it are the community roster,
 * filtered to this department and bucketed by the Discord role map. That is the
 * whole point of the projection: promoting someone in Discord moves them here,
 * and there is no second roster for the bot to keep in step.
 *
 * Activity status is therefore edited against the community roster too, which is
 * why the control asks for the site-wide `roster.edit_status` permission rather
 * than a department capability — a status set here is the same status the
 * Civilian Hub's roster shows.
 */
export default function DeptRoster({ page, config }) {
  const { hasPermission } = useAuth();
  const { id, can, mutate } = useDeptConfig();
  const canEditRoster = can("editRoster");
  const [managing, setManaging] = useState(null); // "new" | member row | null
  const [rankOpen, setRankOpen] = useState(false);
  const [loaded, setLoaded] = useState({ id: null, subdivisions: [] });
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState(null);
  const [editingFields, setEditingFields] = useState(null); // member whose columns are being edited
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [guildNames, setGuildNames] = useState({});

  const canSync = hasPermission("discord.roles.manage");

  useEffect(() => {
    let active = true;
    api.deptRoster(id).then((result) => {
      if (active) setLoaded({ id, subdivisions: result?.subdivisions ?? [] });
    });
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  // Names for the guilds a manual pull reports on, so the diagnostic reads
  // "FHP server" rather than a bare snowflake.
  useEffect(() => {
    if (!canSync) return undefined;
    let active = true;
    api.deptList().then((list) => {
      if (!active) return;
      const map = {};
      (list ?? []).forEach((d) => {
        if (d.guildId) map[d.guildId] = `${d.shortName || d.name} server`;
      });
      setGuildNames(map);
    });
    return () => {
      active = false;
    };
  }, [canSync]);

  // Refresh re-reads the roster. For anyone who can manage the role map it first
  // pulls from Discord and reports the per-guild outcome, so an empty roster
  // after mapping roles explains itself instead of staying blank.
  const refresh = async () => {
    if (!canSync) {
      setReloadKey((key) => key + 1);
      return;
    }
    setSyncing(true);
    setNotice("");
    try {
      // Scoped to this department: reads its own server plus the main one, and only
      // touches this department's members.
      const result = await api.pullRoster(id);
      setNotice(describeSync(result, guildNames, id, config.branding.shortName));
    } catch (err) {
      setNotice(err?.message || "Could not pull the roster from Discord.");
    } finally {
      setSyncing(false);
      setReloadKey((key) => key + 1);
    }
  };

  const subdivisions = loaded.id === id ? loaded.subdivisions : [];
  // Derived rather than reset in an effect, so switching department renders the
  // new department's first unit instead of the old department's selection.
  const active = subdivisions.find((sub) => sub.id === activeId) ?? subdivisions[0] ?? null;

  const canEditStatus = hasPermission("roster.edit_status");
  const canManageLoa = hasPermission("roster.manage_loa");
  const fields = config.roster.memberFields ?? [];
  // The columns editable by hand: the department's own data columns, minus the
  // ones the sync or a dedicated editor owns — status (its own editor), callsign
  // (the Discord nickname / manual-member form) and the synced identity/date
  // fields. This set matches the server's, so the editor never offers a column a
  // save would silently drop.
  const editableFields = fields.filter(
    (field) => field.type !== "status" && !RESERVED_FIELD_IDS.has(field.id),
  );
  // The bands a member can be placed into: the configured categories of the
  // roster being viewed (never the synthetic "Unassigned" the projection adds).
  const bandOptions = useMemo(() => {
    const configSub = (config.roster?.subdivisions ?? []).find((s) => s.id === activeId) ?? (config.roster?.subdivisions ?? [])[0];
    return (configSub?.categories ?? []).filter((c) => !c.unassigned).map((c) => ({ id: c.id, name: c.name }));
  }, [config, activeId]);
  const stats = config.roster.stats;

  const everyone = useMemo(
    () => (active?.categories ?? []).flatMap((category) => category.members),
    [active],
  );

  // Ranks already on the roster, offered as suggestions when adding a manual member
  // so a hand-typed rank matches an existing band rather than landing in Unassigned.
  const rankOptions = useMemo(
    () => [...new Set(everyone.map((m) => m.rankFull || m.rank).filter(Boolean))],
    [everyone],
  );

  const removeManual = async (member) => {
    await api.deleteManualMember(id, member.id);
    setReloadKey((key) => key + 1);
  };

  // The department's manual rank-seniority override. Applied here as well as on the
  // server so a save from the Rank order control reorders the roster instantly.
  const rankOrder = config.roster?.rankOrder ?? {};
  const effOrder = (member) =>
    (member.roleKey != null && member.roleKey in rankOrder ? rankOrder[member.roleKey] : member.order) ?? 0;

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (active?.categories ?? [])
      .map((category) => ({
        id: category.id,
        label: category.name,
        color: category.color,
        insigniaUrl: category.insigniaUrl,
        rows: category.members
          .filter((member) => {
            if (status !== "all" && member.status !== status) return false;
            if (!needle) return true;
            return [member.characterName, member.rank, member.rankFull, member.callsign]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(needle));
          })
          .sort(
            (a, b) =>
              effOrder(b) - effOrder(a) ||
              String(a.callsign || "").localeCompare(String(b.callsign || ""), undefined, { numeric: true }) ||
              String(a.characterName || "").localeCompare(String(b.characterName || "")),
          ),
      }))
      .filter((group) => group.rows.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, query, status, rankOrder]);

  // The distinct ranks on the roster, richest first — what the Rank order control reorders.
  const rankList = useMemo(() => {
    const seen = new Map();
    for (const sub of subdivisions) {
      for (const category of sub.categories ?? []) {
        for (const member of category.members ?? []) {
          if (!member.roleKey || seen.has(member.roleKey)) continue;
          seen.set(member.roleKey, {
            roleKey: member.roleKey,
            label: member.rankFull || member.rank || member.roleKey,
            order: effOrder(member),
          });
        }
      }
    }
    return [...seen.values()].sort((a, b) => b.order - a.order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subdivisions, rankOrder]);

  // Reuse the reordered ranks' own order values, reassigned top-first, so each rank
  // keeps its band and only its position relative to its neighbours changes.
  const saveRankOrder = async (ordered) => {
    const values = ordered.map((r) => r.order).sort((a, b) => b - a);
    await mutate(
      (c) => {
        const next = { ...(c.roster?.rankOrder ?? {}) };
        ordered.forEach((r, i) => {
          next[r.roleKey] = values[i];
        });
        return { ...c, roster: { ...c.roster, rankOrder: next } };
      },
      { immediate: true },
    );
    setRankOpen(false);
  };

  const totals = useMemo(
    () =>
      active && stats?.show
        ? (stats.items ?? []).map((item) => ({ ...item, value: statValue(item, active) }))
        : [],
    [active, stats],
  );

  const counts = useMemo(
    () =>
      ACTIVITY_STATUSES.map((entry) => ({
        label: entry.label,
        value: everyone.filter((member) => member.status === entry.id).length,
        color: entry.color,
      })).filter((entry) => entry.value > 0),
    [everyone],
  );

  const columns = [
    {
      key: "callsign",
      label: "Callsign",
      width: "w-24",
      render: (member) =>
        member.callsign ? (
          <span className="dept-accent-text font-bold">{member.callsign}</span>
        ) : (
          <span className="text-slate-600">—</span>
        ),
    },
    {
      key: "name",
      label: "Name",
      render: (member) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{member.characterName}</p>
          <p className="truncate text-xs text-slate-500">{member.displayName}</p>
        </div>
      ),
    },
    {
      key: "rank",
      label: "Rank",
      render: (member) => (
        <span
          className="text-sm font-semibold text-slate-300"
          style={member.rankColor ? { color: member.rankColor } : undefined}
        >
          {member.rankFull || member.rank}
        </span>
      ),
    },
    // The columns beyond rank are the department's own, so they come from its
    // config rather than being fixed here.
    ...fields
      .filter((field) => field.id !== "callsign")
      .map((field) => ({
        key: field.id,
        label: field.label,
        hideBelow: field.id === "status" ? undefined : "lg",
        render: (member) => (
          <MemberCell field={field} member={member} editable={canEditStatus} onEdit={setEditing} />
        ),
      })),
    // Every member can have their column values (hire date, troop, dates, …)
    // edited by hand — synced members included, since those columns are the
    // department's own overlay rather than anything Discord owns. A hand-added
    // (manual) member additionally has its identity editable and can be removed.
    ...(canEditRoster
      ? [
          {
            key: "manage",
            label: "",
            width: "w-28",
            render: (member) => (
              <div className="flex items-center gap-1">
                {(editableFields.length > 0 || bandOptions.length > 0) && (
                  <button
                    type="button"
                    onClick={() => setEditingFields(member)}
                    aria-label={`Edit ${member.characterName}'s band and details`}
                    title="Place in a band / edit roster columns"
                    className="grid size-7 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    <SlidersHorizontal className="size-3.5" />
                  </button>
                )}
                {member.source === "manual" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setManaging(member)}
                      aria-label={`Edit ${member.characterName}`}
                      title="Edit name, rank and callsign"
                      className="grid size-7 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeManual(member)}
                      aria-label={`Remove ${member.characterName}`}
                      className="grid size-7 place-items-center rounded-lg text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  // One click to seed placements from ranks for a roster that had a good layout
  // before placement went manual. Only touches members still Unassigned.
  const [filling, setFilling] = useState(false);
  const fillBands = async () => {
    setFilling(true);
    try {
      const result = await api.fillBandsFromRanks(id);
      setNotice(
        result?.ok === false
          ? result.message || "Could not fill the bands."
          : `Placed ${result?.filled ?? 0} member${result?.filled === 1 ? "" : "s"} by rank${
              result?.skipped ? `; ${result.skipped} had no matching band and stay Unassigned` : ""
            }.`,
      );
      setReloadKey((key) => key + 1);
    } finally {
      setFilling(false);
    }
  };

  const saveStatus = async (payload) => {
    // The API answers with a message when the write did not land — a member who
    // has never been synced has no record to update. Discarding it would show
    // the new status until the next reload and then quietly revert.
    const result = await api.updateRosterStatus(payload.id, payload);
    setNotice(result?.message ?? "");
    setReloadKey((key) => key + 1);
  };

  return (
    <>
      <RosterHeader
        mark={<DeptBrandMark config={config} className="size-10" />}
        title={`${config.branding.shortName} · ${page.label}`}
        subtitle="Personnel follow Discord roles — promote someone there and they move here."
        views={subdivisions.map((sub) => ({ id: sub.id, label: sub.name }))}
        activeView={active?.id}
        onView={setActiveId}
        onRefresh={refresh}
        refreshing={syncing}
        total={everyone.length}
        counts={counts}
      />

      {active && <SubdivisionBanner config={config} sub={active} />}

      <StatsBar
        title={stats?.title || `${active?.name ?? config.branding.shortName} statistics`}
        totals={totals}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <RosterFilters
            query={query}
            onQuery={setQuery}
            placeholder="Search name, rank or callsign…"
            filters={[
              { id: "status", label: "Status", value: status, onChange: setStatus, options: STATUS_OPTIONS },
            ]}
          />
        </div>
        {canEditRoster && rankList.length > 1 && (
          <Button variant="ghost" size="sm" onClick={() => setRankOpen(true)}>
            <ListOrdered className="size-4" />
            Rank order
          </Button>
        )}
        {canEditRoster && bandOptions.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={fillBands}
            disabled={filling}
            title="Place every still-Unassigned member into the band their rank maps to. Never moves anyone already placed."
          >
            <Sparkles className="size-4" />
            {filling ? "Placing…" : "Fill bands from ranks"}
          </Button>
        )}
        {canEditRoster && (
          <Button variant="ghost" size="sm" onClick={() => setManaging("new")}>
            <Plus className="size-4" />
            Add member
          </Button>
        )}
      </div>

      {notice && (
        <Card className="mb-5 p-4">
          <p className="text-sm font-semibold text-amber-300">{notice}</p>
        </Card>
      )}

      {everyone.length === 0 ? (
        <Card className="p-10 text-center">
          <Users className="mx-auto size-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">
            Nobody holds a {config.branding.shortName} role in Discord yet. As soon as someone
            does, the roster bot adds them here.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Ranks are bound to Discord roles on the{" "}
            <Link to="/staff-hub/discord-roles" className="underline hover:text-slate-300">
              role mapping page
            </Link>
            .
          </p>
        </Card>
      ) : (
        <RosterTable
          columns={columns}
          groups={groups}
          empty={`Nobody in ${config.branding.shortName} matches that search.`}
        />
      )}

      {editing && (
        <StatusEditor
          key={editing.id}
          member={editing}
          open
          onClose={() => setEditing(null)}
          onSave={saveStatus}
          canManageLoa={canManageLoa}
        />
      )}

      {managing && (
        <ManualMemberModal
          deptId={id}
          member={managing === "new" ? null : managing}
          rankOptions={rankOptions}
          onClose={() => setManaging(null)}
          onSaved={() => {
            setManaging(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}

      {editingFields && (
        <MemberFieldsModal
          deptId={id}
          member={editingFields}
          fields={editableFields}
          bands={bandOptions}
          onClose={() => setEditingFields(null)}
          onSaved={() => {
            setEditingFields(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}

      {rankOpen && (
        <RankOrderModal ranks={rankList} onClose={() => setRankOpen(false)} onSave={saveRankOrder} />
      )}
    </>
  );
}

/**
 * Edit one member's hand-entered column values. Renders an input per configured
 * column, typed to match how the column shows in the table — a date picker for a
 * date, a dropdown for a select, a toggle for a checkbox/cert, text otherwise.
 * Works for any member on the roster, synced or manual.
 */
function MemberFieldsModal({ deptId, member, fields, bands = [], onClose, onSaved }) {
  // Which band the member sits in. Placement is manual — a synced member
  // starts Unassigned and stays there until command places them here.
  const [band, setBand] = useState(member.categoryId ?? "");
  const [values, setValues] = useState(() => {
    const initial = {};
    for (const field of fields) {
      const current = member[field.id];
      initial[field.id] =
        field.type === "checkbox" || field.type === "cert" ? Boolean(current) : current ?? "";
    }
    return initial;
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (id, value) => setValues((v) => ({ ...v, [id]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (band !== (member.categoryId ?? "")) {
        const placed = await api.setMemberBand(deptId, member.id, band || null);
        if (placed?.ok === false) {
          setError(placed.message || "Could not place the member.");
          setSaving(false);
          return;
        }
      }
      if (fields.length > 0) {
        const result = await api.saveMemberFields(deptId, member.id, values);
        if (result?.ok === false) {
          setError(result.message || "Could not save.");
          setSaving(false);
          return;
        }
      }
      onSaved();
    } catch (err) {
      setError(err?.message || "Could not save the member's details.");
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Edit ${member.characterName}`} subtitle="Band and roster columns" className="max-w-lg">
      {fields.length === 0 && bands.length === 0 ? (
        <p className="text-sm text-slate-400">This roster has no bands or editable columns configured.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {bands.length > 0 && (
            <Field label="Band" htmlFor="mf-band" hint="Where this member sits on the roster. New members start Unassigned.">
              <Select
                id="mf-band"
                value={band}
                onChange={setBand}
                options={[{ value: "", label: "Unassigned" }, ...bands.map((b) => ({ value: b.id, label: b.name }))]}
              />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <Field key={field.id} label={field.label} htmlFor={`mf-${field.id}`}>
                {field.type === "date" ? (
                  <TextInput
                    id={`mf-${field.id}`}
                    type="date"
                    value={values[field.id] || ""}
                    onChange={(e) => set(field.id, e.target.value)}
                  />
                ) : field.type === "checkbox" || field.type === "cert" ? (
                  <Select
                    id={`mf-${field.id}`}
                    value={values[field.id] ? "yes" : "no"}
                    onChange={(v) => set(field.id, v === "yes")}
                    options={[
                      { value: "no", label: field.type === "cert" ? "N/A" : "No" },
                      { value: "yes", label: field.type === "cert" ? "Certified" : "Yes" },
                    ]}
                  />
                ) : field.type === "select" && field.options?.length ? (
                  <Select
                    id={`mf-${field.id}`}
                    value={values[field.id] || ""}
                    onChange={(v) => set(field.id, v)}
                    options={[
                      { value: "", label: "—" },
                      ...field.options.map((o) => ({ value: o, label: o })),
                    ]}
                  />
                ) : (
                  <TextInput
                    id={`mf-${field.id}`}
                    value={values[field.id] || ""}
                    onChange={(e) => set(field.id, e.target.value)}
                    maxLength={200}
                  />
                )}
              </Field>
            ))}
          </div>
          {error && <p className="text-sm font-semibold text-rose-300">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/**
 * Reorder ranks by hand — the manual alternative to editing seniority numbers on
 * the role-mapping page. It moves ranks up and down and saves a department-local
 * override, so command can, say, drop a Lieutenant Colonel below a Colonel without
 * touching the site-wide role map. Every rank keeps its band; only its position
 * among its neighbours changes.
 */
function RankOrderModal({ ranks, onClose, onSave }) {
  const [items, setItems] = useState(ranks);
  const [saving, setSaving] = useState(false);

  const move = (index, delta) => {
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    setItems((list) => {
      const copy = [...list];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSave(items);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Rank order" className="max-w-md">
      <p className="mb-4 text-xs leading-relaxed text-slate-500">
        Highest rank at the top. Move a rank up or down to set who outranks whom on this
        department's roster and chain of command — no role-map edit needed.
      </p>
      <ul className="space-y-1.5">
        {items.map((rank, index) => (
          <li
            key={rank.roleKey}
            className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
          >
            <span className="w-5 shrink-0 text-center text-xs font-bold text-slate-500">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{rank.label}</span>
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${rank.label} up`}
                className="grid size-7 place-items-center rounded-lg text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label={`Move ${rank.label} down`}
                className="grid size-7 place-items-center rounded-lg text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
              >
                <ArrowDown className="size-3.5" />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save order"}
        </Button>
      </div>
    </Modal>
  );
}

/** Add or edit a hand-maintained roster member — the backup for the Discord sync. */
function ManualMemberModal({ deptId, member, rankOptions, onClose, onSaved }) {
  const isEdit = Boolean(member);
  const [values, setValues] = useState({
    characterName: member?.characterName ?? "",
    rank: member?.rankFull || member?.rank || "",
    callsign: member?.callsign ?? "",
    status: member?.status ?? "Active",
    discordId: /^\d{17,20}$/.test(String(member?.discordId ?? "")) ? member.discordId : "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!values.characterName.trim()) return setError("A name is required.");
    if (!values.rank.trim()) return setError("A rank is required.");
    setError("");
    setSaving(true);
    try {
      const result = await api.saveManualMember(deptId, {
        ...(isEdit ? { id: member.id } : {}),
        characterName: values.characterName.trim(),
        rank: values.rank.trim(),
        callsign: values.callsign.trim(),
        status: values.status,
        discordId: values.discordId.trim(),
      });
      if (result?.ok === false) {
        setError(result.message || "Could not save.");
        setSaving(false);
        return;
      }
      onSaved();
    } catch (err) {
      setError(err?.message || "Could not save the member.");
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit roster member" : "Add roster member"}>
      <p className="mb-4 text-xs leading-relaxed text-slate-500">
        A manual entry the Discord sync never touches — use it for someone the bot can't
        cover yet. Match an existing rank so they land in the right band.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="mm-name" required>
            <TextInput
              id="mm-name"
              value={values.characterName}
              onChange={(e) => setValues((v) => ({ ...v, characterName: e.target.value }))}
            />
          </Field>
          <Field label="Callsign" htmlFor="mm-cs" hint="Optional.">
            <TextInput
              id="mm-cs"
              value={values.callsign}
              onChange={(e) => setValues((v) => ({ ...v, callsign: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Rank" htmlFor="mm-rank" required hint="Type a rank; suggestions match this roster's bands.">
          <TextInput
            id="mm-rank"
            list="mm-rank-options"
            value={values.rank}
            onChange={(e) => setValues((v) => ({ ...v, rank: e.target.value }))}
          />
          <datalist id="mm-rank-options">
            {rankOptions.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status" htmlFor="mm-status">
            <Select
              id="mm-status"
              value={values.status}
              onChange={(value) => setValues((v) => ({ ...v, status: value }))}
              options={ACTIVITY_STATUSES.map((s) => ({ value: s.label, label: s.label }))}
            />
          </Field>
          <Field label="Discord ID" htmlFor="mm-did" hint="Optional — lets a later sync take over.">
            <TextInput
              id="mm-did"
              inputMode="numeric"
              value={values.discordId}
              onChange={(e) => setValues((v) => ({ ...v, discordId: e.target.value }))}
              className="font-mono text-xs"
            />
          </Field>
        </div>
        {error && <p className="text-sm font-semibold text-rose-300">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save" : "Add"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Turn one guild's failure code into a sentence that names the fix. */
function syncErrorLabel(code) {
  const c = String(code || "");
  if (c === "MEMBERS_INTENT" || c.includes("403")) {
    return "the bot's Server Members Intent is off — turn it on in the Discord Developer Portal (Bot → Privileged Gateway Intents)";
  }
  if (c.includes("404")) return "the bot isn't a member of that server";
  if (c === "not-configured") return "no bot token or server ID is set";
  return c;
}

/**
 * A plain-language summary of a manual pull, so an empty roster explains itself:
 * how many servers were read and members matched, and for any server that
 * failed, exactly why and what to change.
 */
function describeSync(result, names, deptId, deptShort) {
  if (!result || result.configured === false) {
    return "No Discord bot token is configured on the server, so the roster can't sync from Discord.";
  }
  if (result.error === "no-guilds") {
    return "No Discord servers are configured to sync from. Set each department's server ID in the Builder.";
  }
  const label = (gid) => names[gid] || "Main server";
  const perGuild = result.perGuild ?? [];
  const failed = perGuild.filter((g) => !g.ok);
  const okGuilds = perGuild.filter((g) => g.ok);
  const here = result.byDept?.[deptId] ?? 0;
  const parts = [];

  if (typeof result.matched === "number") {
    parts.push(
      `Read ${okGuilds.length} server${okGuilds.length === 1 ? "" : "s"}, matched ${result.matched} member${result.matched === 1 ? "" : "s"} to a mapped rank — ${here} in ${deptShort || "this department"}.`,
    );
    if (here === 0 && failed.length === 0) {
      parts.push(
        `Nobody the bot can see holds a ${deptShort || "department"} role. Import that server's roles and set their department to ${deptShort || "this one"} on the role mapping page, then Save.`,
      );
    }
  } else if (result.error === "unreadable") {
    parts.push("Couldn't read any of the configured Discord servers.");
  }

  failed.forEach((g) => parts.push(`${label(g.guildId)}: ${syncErrorLabel(g.error)}.`));
  return parts.join(" ");
}

/**
 * The banner across the top of the active subdivision — the reference hub's
 * centrepiece. Uses the subdivision's own banner artwork when it has any, and
 * otherwise an accent-tinted gradient with the department mark, so every roster
 * gets the same strong header whether or not one has been uploaded.
 */
function SubdivisionBanner({ config, sub }) {
  const banner = sub?.banner ?? {};
  const title = banner.title || sub?.name || config.branding.shortName;
  const subtitle = banner.subtitle || config.branding.tagline;

  return (
    <div className="relative mb-5 overflow-hidden rounded-2xl border border-white/10">
      {banner.imageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${banner.imageUrl})` }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: banner.imageUrl
            ? "linear-gradient(90deg, rgba(6,12,24,0.92) 0%, rgba(6,12,24,0.7) 55%, color-mix(in srgb, var(--dept-accent) 24%, rgba(6,12,24,0.5)) 100%)"
            : "linear-gradient(120deg, color-mix(in srgb, var(--dept-accent) 22%, #0b1424) 0%, #0b1424 62%)",
        }}
      />
      <div className="relative flex items-center gap-4 px-5 py-6 sm:px-8">
        {banner.logoUrl ? (
          <img src={banner.logoUrl} alt="" className="size-14 shrink-0 object-contain sm:size-16" />
        ) : (
          <DeptBrandMark config={config} className="size-14 text-base sm:size-16" />
        )}
        <div className="min-w-0 flex-1 text-center">
          <h2 className="dept-accent-text truncate text-xl font-extrabold tracking-tight sm:text-3xl">
            {title}
          </h2>
          {subtitle && (
            <div className="mt-0.5 truncate text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 sm:text-sm">
              {subtitle}
            </div>
          )}
        </div>
        {/* A mirror slot on the right keeps the title optically centred. */}
        {banner.logoUrl2 ? (
          <img src={banner.logoUrl2} alt="" className="size-14 shrink-0 object-contain sm:size-16" />
        ) : (
          <span className="hidden size-14 shrink-0 sm:block sm:size-16" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

/**
 * The full-width statistics bar — a titled header and a row of accent-edged
 * tiles, exactly where the reference hub puts it, rather than tucked into a
 * side rail.
 */
function StatsBar({ title, totals }) {
  if (totals.length === 0) return null;
  return (
    <Card className="mb-4 overflow-hidden p-0">
      <div
        className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5"
        style={{ borderLeft: "3px solid var(--dept-accent)" }}
      >
        <BarChart3 className="dept-accent-text size-4" />
        <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-200">
          {title}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
        {totals.map((item) => (
          <div
            key={item.id}
            className="hub-card-hover rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
            style={{ borderLeft: `3px solid ${item.color || "var(--dept-accent)"}` }}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              {item.label}
            </div>
            <div
              className="dept-accent-text mt-0.5 text-2xl font-black tabular-nums"
              style={item.color ? { color: item.color } : undefined}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** One configured column for one member. */
function MemberCell({ field, member, editable, onEdit }) {
  const value = member[field.id];

  if (field.id === "status" || field.type === "status") {
    return <StatusPill member={member} editable={editable} onEdit={onEdit} />;
  }
  if (field.type === "date") {
    return value ? (
      <span className="whitespace-nowrap text-slate-400">{formatDate(value)}</span>
    ) : (
      <span className="text-slate-600">—</span>
    );
  }
  if (field.type === "checkbox") {
    return value ? <span className="dept-accent-text font-bold">✓</span> : <span className="text-slate-600">—</span>;
  }
  if (field.type === "cert") {
    return value ? <Badge tone="green">Certified</Badge> : <Badge tone="slate">N/A</Badge>;
  }
  if (field.type === "select" && field.pill) {
    if (!value) return <span className="text-slate-600">—</span>;
    const color = field.optionColors?.[value];
    if (color) {
      return (
        <span
          className="inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-bold"
          style={{
            backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
            borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
            color,
          }}
        >
          {value}
        </span>
      );
    }
    return <Badge tone="slate">{value}</Badge>;
  }
  return value ? <span className="text-slate-400">{value}</span> : <span className="text-slate-600">—</span>;
}
