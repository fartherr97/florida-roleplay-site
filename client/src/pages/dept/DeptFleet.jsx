import { useEffect, useMemo, useRef, useState } from "react";
import {
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Columns3,
  Copy,
  Pencil,
  Plus,
  Rows3,
  Tags,
  Trash2,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import DeptPageHeader from "../../components/dept/DeptPageHeader";
import { useDeptConfig } from "../../context/useDeptConfig";
import { cn } from "../../lib/cn";

/**
 * The vehicle roster ("fleet"): which vehicles each rank or unit may operate, as
 * a matrix of columns (or rows) — one per rank/unit — each holding vehicle cards
 * (display name + spawn code), with a colour-coded legend. Page config shape:
 *   { tags: [{id,label,color}], tiers: [{id,name,vehicles:[{id,name,code,tagId}]}],
 *     notes, layout }
 * Editing needs the editStructure capability; a viewer sees it read-only.
 */

const DEFAULT_TAGS = [
  { id: "tag-livery", label: "Livery + Lightbar", color: "#e2e8f0" },
  { id: "tag-slicktop", label: "Slicktop", color: "#eab308" },
  { id: "tag-ghosted", label: "Ghosted", color: "#22c55e" },
  { id: "tag-unmarked", label: "Unmarked", color: "#ef4444" },
];

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export default function DeptFleet({ page, config }) {
  const { can, savePage } = useDeptConfig();
  const canEdit = can("editStructure");

  // Local, editable copy of this page's config, so typing a rank name or a note
  // stays instant; the save is debounced and flushed on Done/unmount so nothing
  // is lost. A viewer never edits, so their copy is just the config as loaded.
  const [cfg, setCfg] = useState(() => normalizeFleet(page.config));

  const pending = useRef(null);
  const timer = useRef(null);
  const flushRef = useRef(null);
  const flush = () => {
    clearTimeout(timer.current);
    if (!pending.current) return;
    const next = pending.current;
    pending.current = null;
    savePage(page.id, next).catch(() => {});
  };
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => () => flushRef.current?.(), []);

  const commit = (patch) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    pending.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 400);
  };

  const tags = cfg.tags.length ? cfg.tags : DEFAULT_TAGS;
  const tiers = cfg.tiers;
  const tagById = useMemo(() => Object.fromEntries(tags.map((t) => [t.id, t])), [tags]);
  const layout = cfg.layout === "rows" ? "rows" : "columns";
  const tierWord = layout === "rows" ? "row" : "column";

  const [vehicleModal, setVehicleModal] = useState(null); // { tierId, vehicle }
  const [tagsOpen, setTagsOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [copyTarget, setCopyTarget] = useState(null);

  const setTiers = (next) => commit({ tiers: next });
  const updateTier = (tierId, patch) =>
    setTiers(tiers.map((t) => (t.id === tierId ? { ...t, ...patch } : t)));

  const moveTier = (tierId, dir) => {
    const i = tiers.findIndex((t) => t.id === tierId);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= tiers.length) return;
    const next = [...tiers];
    [next[i], next[j]] = [next[j], next[i]];
    setTiers(next);
  };
  const moveVehicle = (tierId, vehicleId, dir) => {
    const tier = tiers.find((t) => t.id === tierId);
    const list = [...(tier?.vehicles || [])];
    const i = list.findIndex((v) => v.id === vehicleId);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    updateTier(tierId, { vehicles: list });
  };
  const saveVehicle = (draft) => {
    const { tierId } = vehicleModal;
    const { isNew, ...clean } = draft;
    const tier = tiers.find((t) => t.id === tierId);
    const list = tier?.vehicles || [];
    updateTier(tierId, {
      vehicles: isNew ? [...list, clean] : list.map((v) => (v.id === clean.id ? clean : v)),
    });
    setVehicleModal(null);
  };
  const copyVehiclesFrom = (sourceTierId) => {
    const src = tiers.find((t) => t.id === sourceTierId);
    const target = tiers.find((t) => t.id === copyTarget);
    if (!src || !target) return;
    updateTier(copyTarget, {
      vehicles: [
        ...(target.vehicles || []),
        ...(src.vehicles || []).map((v) => ({ ...v, id: uid("veh") })),
      ],
    });
    setCopyTarget(null);
  };
  const addTier = () =>
    setTiers([...tiers, { id: uid("tier"), name: "New Rank / Unit", vehicles: [] }]);

  const tierControls = (tier, idx) => (
    <div className="mt-2 flex items-center justify-center gap-1">
      <MiniIcon
        icon={layout === "rows" ? ChevronUp : ChevronLeft}
        label={layout === "rows" ? "Move up" : "Move left"}
        disabled={idx === 0}
        onClick={() => moveTier(tier.id, -1)}
      />
      <MiniIcon
        icon={Plus}
        label="Add vehicle"
        onClick={() =>
          setVehicleModal({
            tierId: tier.id,
            vehicle: { id: uid("veh"), name: "", code: "", tagId: "", isNew: true },
          })
        }
      />
      <MiniIcon
        icon={Copy}
        label={`Copy vehicles from another ${tierWord}`}
        disabled={tiers.length < 2}
        onClick={() => setCopyTarget(tier.id)}
      />
      <MiniIcon
        icon={Trash2}
        label={`Delete ${tierWord}`}
        danger
        onClick={() => setConfirm({ type: "tier", tier })}
      />
      <MiniIcon
        icon={layout === "rows" ? ChevronDown : ChevronRight}
        label={layout === "rows" ? "Move down" : "Move right"}
        disabled={idx === tiers.length - 1}
        onClick={() => moveTier(tier.id, 1)}
      />
    </div>
  );

  const tierHeader = (tier) => (
    <div
      className="mb-2 rounded-lg border border-white/15 px-2 py-2 text-center"
      style={{ backgroundColor: "color-mix(in srgb, var(--dept-accent) 16%, transparent)" }}
    >
      {canEdit ? (
        <input
          value={tier.name}
          onChange={(e) => updateTier(tier.id, { name: e.target.value })}
          aria-label="Rank or unit name"
          className="w-full bg-transparent text-center text-[13px] font-bold text-white outline-none"
        />
      ) : (
        <div className="text-[13px] font-bold text-white">{tier.name}</div>
      )}
    </div>
  );

  const vehicleGrid = (tier) => (
    <div className="grid gap-1.5">
      {(tier.vehicles || []).map((v, vIdx) => (
        <VehicleCard
          key={v.id}
          vehicle={v}
          tag={tagById[v.tagId]}
          canEdit={canEdit}
          isFirst={vIdx === 0}
          isLast={vIdx === (tier.vehicles || []).length - 1}
          onMove={(dir) => moveVehicle(tier.id, v.id, dir)}
          onEdit={() => setVehicleModal({ tierId: tier.id, vehicle: v })}
          onDelete={() => setConfirm({ type: "vehicle", tierId: tier.id, vehicle: v })}
        />
      ))}
      {(tier.vehicles || []).length === 0 && (
        <div className="rounded-lg border border-dashed border-white/10 px-2 py-3 text-center text-[11px] text-slate-600">
          No vehicles
        </div>
      )}
    </div>
  );

  return (
    <>
      <DeptPageHeader
        icon={page.icon}
        eyebrow={config.branding.shortName}
        title={page.label}
        subtitle="Which vehicles each rank and unit may operate."
        actions={
          canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-stretch overflow-hidden rounded-xl border border-white/10">
                {[
                  ["columns", Columns3, "Columns"],
                  ["rows", Rows3, "Rows"],
                ].map(([value, Icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => commit({ layout: value })}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition",
                      layout === value ? "bg-primary-500/20 text-white" : "text-slate-400 hover:text-white",
                    )}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setTagsOpen(true)}>
                <Tags className="size-4" />
                Legend
              </Button>
              <Button size="sm" onClick={addTier}>
                <Plus className="size-4" />
                Add {tierWord}
              </Button>
            </div>
          ) : null
        }
      />

      {tags.length > 0 && tiers.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {canEdit && (
            <span className="w-full text-xs text-slate-500">
              Tags outline a vehicle's card in the legend colour — edit a vehicle (pencil) to
              assign one, and use Legend to rename or recolour the tags.
            </span>
          )}
          {tags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold text-slate-200"
              style={{
                borderColor: `color-mix(in srgb, ${t.color} 55%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${t.color} 10%, transparent)`,
              }}
            >
              <span className="size-2.5 rounded-full" style={{ backgroundColor: t.color }} />
              {t.label}
            </span>
          ))}
        </div>
      )}

      {tiers.length === 0 ? (
        <Card className="p-10 text-center">
          <Car className="mx-auto mb-3 size-8 text-slate-500" />
          <div className="text-base font-semibold text-slate-200">No fleet structure yet</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Add a {tierWord} per rank or unit (Recruit, Trooper… or SRT, CIU), then add the
            vehicles each one may use.
          </p>
          {canEdit && (
            <Button className="mt-4" size="sm" onClick={addTier}>
              <Plus className="size-4" />
              Add the first {tierWord}
            </Button>
          )}
        </Card>
      ) : layout === "columns" ? (
        <Card className="overflow-x-auto p-4">
          <div className="flex items-start gap-3">
            {tiers.map((tier, idx) => (
              <div key={tier.id} className="w-40 shrink-0">
                {tierHeader(tier)}
                {vehicleGrid(tier)}
                {canEdit && tierControls(tier, idx)}
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="grid gap-3 p-4">
          {tiers.map((tier, idx) => (
            <div
              key={tier.id}
              className="flex flex-col gap-2 border-b border-white/5 pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-start"
            >
              <div className="w-full shrink-0 sm:w-44">
                {tierHeader(tier)}
                {canEdit && tierControls(tier, idx)}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {(tier.vehicles || []).map((v, vIdx) => (
                  <div key={v.id} className="w-36">
                    <VehicleCard
                      vehicle={v}
                      tag={tagById[v.tagId]}
                      canEdit={canEdit}
                      isFirst={vIdx === 0}
                      isLast={vIdx === (tier.vehicles || []).length - 1}
                      onMove={(dir) => moveVehicle(tier.id, v.id, dir)}
                      onEdit={() => setVehicleModal({ tierId: tier.id, vehicle: v })}
                      onDelete={() => setConfirm({ type: "vehicle", tierId: tier.id, vehicle: v })}
                    />
                  </div>
                ))}
                {(tier.vehicles || []).length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/10 px-4 py-3 text-center text-[11px] text-slate-600">
                    No vehicles
                  </div>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}

      {(cfg.notes || canEdit) && (
        <Card className="mt-4 p-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Notes
          </div>
          {canEdit ? (
            <TextArea
              rows={3}
              value={cfg.notes || ""}
              placeholder="e.g. Marked/Ghosted vehicles must display the operator's callsign…"
              onChange={(e) => commit({ notes: e.target.value })}
            />
          ) : (
            <p className="whitespace-pre-line text-sm leading-6 text-slate-300">{cfg.notes}</p>
          )}
        </Card>
      )}

      {vehicleModal && (
        <VehicleModal
          key={vehicleModal.vehicle.id}
          vehicle={vehicleModal.vehicle}
          tags={tags}
          onClose={() => setVehicleModal(null)}
          onSave={saveVehicle}
        />
      )}
      {tagsOpen && (
        <TagsModal
          tags={tags}
          onClose={() => setTagsOpen(false)}
          onChange={(next) => commit({ tags: next })}
        />
      )}
      {copyTarget && (
        <Modal
          open
          onClose={() => setCopyTarget(null)}
          title={`Copy vehicles into “${tiers.find((t) => t.id === copyTarget)?.name || ""}”`}
          className="max-w-md"
        >
          <p className="mb-3 text-sm text-slate-400">
            Pick which {tierWord} to copy from — its vehicles are added below the ones already
            here, so you adjust the differences instead of retyping everything.
          </p>
          <div className="grid gap-1.5">
            {tiers
              .filter((t) => t.id !== copyTarget)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => copyVehiclesFrom(t.id)}
                  disabled={(t.vehicles || []).length === 0}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="truncate">{t.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {(t.vehicles || []).length} vehicle(s)
                  </span>
                </button>
              ))}
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal
          open
          onClose={() => setConfirm(null)}
          title={confirm.type === "tier" ? `Delete ${tierWord}?` : "Delete vehicle?"}
          className="max-w-md"
        >
          <p className="text-sm text-slate-300">
            {confirm.type === "tier"
              ? `Delete "${confirm.tier?.name}" and its ${confirm.tier?.vehicles?.length || 0} vehicle(s)?`
              : `Delete "${confirm.vehicle?.name}"?`}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (confirm.type === "tier") {
                  setTiers(tiers.filter((t) => t.id !== confirm.tier.id));
                } else {
                  const tier = tiers.find((t) => t.id === confirm.tierId);
                  updateTier(confirm.tierId, {
                    vehicles: (tier?.vehicles || []).filter((v) => v.id !== confirm.vehicle.id),
                  });
                }
                setConfirm(null);
              }}
            >
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Ensure a fleet config always has the arrays the page reads. */
function normalizeFleet(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};
  return {
    tags: Array.isArray(cfg.tags) ? cfg.tags : [],
    tiers: Array.isArray(cfg.tiers)
      ? cfg.tiers.map((t) => ({
          id: String(t.id ?? uid("tier")),
          name: String(t.name ?? "Rank / Unit"),
          vehicles: Array.isArray(t.vehicles) ? t.vehicles : [],
        }))
      : [],
    notes: typeof cfg.notes === "string" ? cfg.notes : "",
    layout: cfg.layout === "rows" ? "rows" : "columns",
  };
}

/** A small square icon button used for the per-tier controls. */
function MiniIcon({ icon: Icon, label, onClick, disabled, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-7 place-items-center rounded-lg text-slate-400 ring-1 ring-inset ring-white/10 transition disabled:opacity-30",
        danger ? "hover:bg-rose-500/10 hover:text-rose-300" : "hover:bg-white/[0.06] hover:text-white",
      )}
    >
      <Icon size={14} />
    </button>
  );
}

/** One vehicle card, outlined in its tag colour, with hover edit controls. */
function VehicleCard({ vehicle, tag, canEdit, onEdit, onDelete, onMove, isFirst, isLast }) {
  const style = tag
    ? {
        borderColor: tag.color,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tag.color} 45%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${tag.color} 7%, var(--color-surface-2))`,
      }
    : undefined;
  return (
    <div
      style={style}
      title={tag?.label}
      className="group relative rounded-lg border border-white/15 bg-[var(--color-surface-2)] px-2 py-2 text-center"
    >
      <div className="text-[13px] font-bold leading-tight text-white">{vehicle.name}</div>
      {vehicle.code && (
        <div
          className="mx-auto mt-1 max-w-full truncate rounded-md bg-black/30 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-slate-200"
          title={vehicle.code}
        >
          {vehicle.code}
        </div>
      )}
      {canEdit && (
        <div className="absolute -right-1.5 -top-1.5 hidden items-center gap-0.5 rounded-lg border border-white/10 bg-[var(--color-surface-1)] p-0.5 shadow-lg group-hover:flex">
          <button onClick={() => onMove(-1)} disabled={isFirst} title="Move up" className="rounded p-0.5 text-slate-400 hover:text-white disabled:opacity-30">
            <ChevronUp size={12} />
          </button>
          <button onClick={() => onMove(1)} disabled={isLast} title="Move down" className="rounded p-0.5 text-slate-400 hover:text-white disabled:opacity-30">
            <ChevronDown size={12} />
          </button>
          <button onClick={onEdit} title="Edit vehicle" className="rounded p-0.5 text-slate-400 hover:text-white">
            <Pencil size={12} />
          </button>
          <button onClick={onDelete} title="Delete vehicle" className="rounded p-0.5 text-slate-400 hover:text-rose-300">
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

/** Add or edit one vehicle: display name, spawn code and legend tag. */
function VehicleModal({ vehicle, tags, onClose, onSave }) {
  const [draft, setDraft] = useState(vehicle);
  return (
    <Modal open onClose={onClose} title={vehicle.isNew ? "Add vehicle" : "Edit vehicle"} className="max-w-md">
      <div className="grid gap-4">
        <Field label="Vehicle name" htmlFor="veh-name" hint="e.g. 2021 Charger">
          <TextInput
            id="veh-name"
            value={draft.name || ""}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field label="Spawn code / callsign" htmlFor="veh-code" hint="The small code under the name, e.g. HP1E.">
          <TextInput
            id="veh-code"
            value={draft.code || ""}
            onChange={(e) => setDraft({ ...draft, code: e.target.value })}
          />
        </Field>
        <Field label="Tag" htmlFor="veh-tag" hint="Colours the card to match the legend.">
          <Select
            id="veh-tag"
            value={draft.tagId || ""}
            onChange={(value) => setDraft({ ...draft, tagId: value })}
            options={[{ value: "", label: "None" }, ...tags.map((t) => ({ value: t.id, label: t.label }))]}
          />
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => onSave(draft)}>
          Save
        </Button>
      </div>
    </Modal>
  );
}

/** Rename and recolour the legend tags, or add/remove them. */
function TagsModal({ tags, onClose, onChange }) {
  return (
    <Modal open onClose={onClose} title="Legend tags" className="max-w-md">
      <div className="grid gap-3">
        <p className="text-sm text-slate-400">
          Tags colour-code vehicles — e.g. Slicktop, Ghosted, Unmarked. They show as the legend
          at the top of the page.
        </p>
        {tags.map((t) => (
          <div key={t.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
            <TextInput
              value={t.label}
              onChange={(e) => onChange(tags.map((x) => (x.id === t.id ? { ...x, label: e.target.value } : x)))}
            />
            <input
              type="color"
              value={t.color}
              onChange={(e) => onChange(tags.map((x) => (x.id === t.id ? { ...x, color: e.target.value } : x)))}
              aria-label={`Colour for ${t.label}`}
              className="h-9 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent"
            />
            <button
              type="button"
              onClick={() => onChange(tags.filter((x) => x.id !== t.id))}
              aria-label={`Delete ${t.label}`}
              className="grid size-9 place-items-center rounded-lg text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-rose-500/10 hover:text-rose-300"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange([...tags, { id: uid("tag"), label: "New tag", color: "#3b82f6" }])}
        >
          <Plus className="size-4" />
          Add tag
        </Button>
      </div>
    </Modal>
  );
}
