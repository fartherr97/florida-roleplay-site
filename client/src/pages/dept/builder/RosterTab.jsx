import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Field from "../../../components/ui/Field";
import Select from "../../../components/ui/Select";
import { TextInput } from "../../../components/ui/TextInput";
import TabIntro from "./TabIntro";
import { useDeptConfig } from "../../../context/useDeptConfig";
import { api } from "../../../lib/api";

/**
 * How this department's roster is arranged.
 *
 * The only thing that decides who appears on a roster is which Discord role
 * someone holds, so this tab is entirely about mapping roles onto bands. A rank
 * that no band claims still shows — under "Unassigned" — which is what keeps a
 * newly mapped rank visible instead of silently missing.
 */
export default function RosterTab({ config }) {
  const { mutate } = useDeptConfig();
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    let active = true;
    api.rosterRoleMap().then((result) => {
      if (active) setRoles(result?.roles ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  const deptRoles = useMemo(
    () =>
      roles
        .filter((role) => role.department === config.id)
        .sort((a, b) => (b.order ?? 0) - (a.order ?? 0)),
    [config.id, roles],
  );

  const setRoster = (changes) =>
    mutate((current) => ({ ...current, roster: { ...current.roster, ...changes } }));

  const subdivisions = config.roster.subdivisions;

  const updateSub = (subId, changes) =>
    setRoster({
      subdivisions: subdivisions.map((sub) => (sub.id === subId ? { ...sub, ...changes } : sub)),
    });

  const updateCategory = (subId, catId, changes) => {
    const sub = subdivisions.find((entry) => entry.id === subId);
    updateSub(subId, {
      categories: sub.categories.map((cat) => (cat.id === catId ? { ...cat, ...changes } : cat)),
    });
  };

  /** Which band, if any, already claims a role — a role belongs to exactly one. */
  const bandOf = (subId, roleKey) =>
    subdivisions
      .find((sub) => sub.id === subId)
      ?.categories.find((cat) => (cat.roleKeys ?? []).includes(roleKey));

  /**
   * Reorder a band within its unit. The category order is the roster's display
   * order (command-first) and, through it, the Chain of Command order — so
   * moving a band here moves it on both.
   */
  const moveCategory = (subId, catId, dir) => {
    const sub = subdivisions.find((entry) => entry.id === subId);
    const cats = [...sub.categories];
    const i = cats.findIndex((cat) => cat.id === catId);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= cats.length) return;
    [cats[i], cats[j]] = [cats[j], cats[i]];
    updateSub(subId, { categories: cats });
  };

  const toggleRole = (subId, catId, roleKey) => {
    const sub = subdivisions.find((entry) => entry.id === subId);
    updateSub(subId, {
      categories: sub.categories.map((cat) => {
        const has = (cat.roleKeys ?? []).includes(roleKey);
        if (cat.id === catId) {
          return {
            ...cat,
            roleKeys: has
              ? cat.roleKeys.filter((key) => key !== roleKey)
              : [...(cat.roleKeys ?? []), roleKey],
          };
        }
        // Moving a role into a band takes it out of whichever band held it.
        return has ? { ...cat, roleKeys: cat.roleKeys.filter((key) => key !== roleKey) } : cat;
      }),
    });
  };

  return (
    <>
      <TabIntro title="Roster layout">
        Membership comes from the community roster — the Discord bot puts people there. What you
        set here is how they are grouped and what the table shows.
      </TabIntro>

      {subdivisions.map((sub) => (
        <Card key={sub.id} className="mb-5 p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Field label="Unit name" htmlFor={`sub-${sub.id}`} className="min-w-48 flex-1">
              <TextInput
                id={`sub-${sub.id}`}
                value={sub.name}
                onChange={(e) => updateSub(sub.id, { name: e.target.value })}
              />
            </Field>
            {sub.main ? (
              <Badge tone="brand">Main roster</Badge>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete the "${sub.name}" unit? Its bands go with it.`)) {
                    setRoster({
                      subdivisions: subdivisions.filter((entry) => entry.id !== sub.id),
                    });
                  }
                }}
                aria-label={`Delete ${sub.name}`}
                title="Delete this unit"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>

          {!sub.main && (
            <p className="mb-3 text-xs text-slate-500">
              This unit shows only the ranks its bands claim — members appear here on top of
              their spot on the main roster.
            </p>
          )}

          <div className="space-y-3">
            {sub.categories.map((category, catIndex) => (
              <div
                key={category.id}
                className="rounded-2xl bg-white/[0.02] p-4 ring-1 ring-inset ring-white/[0.06]"
              >
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <input
                    type="color"
                    value={category.color}
                    onChange={(e) => updateCategory(sub.id, category.id, { color: e.target.value })}
                    aria-label={`Colour for ${category.name}`}
                    className="size-8 shrink-0 cursor-pointer rounded-lg bg-transparent"
                  />
                  <TextInput
                    value={category.name}
                    onChange={(e) => updateCategory(sub.id, category.id, { name: e.target.value })}
                    className="max-w-56"
                  />
                  {category.insigniaUrl ? (
                    <img
                      src={category.insigniaUrl}
                      alt=""
                      className="size-7 shrink-0 rounded object-contain ring-1 ring-inset ring-white/10"
                    />
                  ) : null}
                  <TextInput
                    value={category.insigniaUrl ?? ""}
                    onChange={(e) =>
                      updateCategory(sub.id, category.id, { insigniaUrl: e.target.value })
                    }
                    placeholder="Insignia image URL (optional)"
                    className="max-w-64 flex-1"
                  />
                  <span className="text-xs text-slate-500">
                    {(category.roleKeys ?? []).length} ranks
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      disabled={catIndex === 0}
                      onClick={() => moveCategory(sub.id, category.id, -1)}
                      aria-label={`Move ${category.name} up`}
                      title="Move band up"
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      disabled={catIndex === sub.categories.length - 1}
                      onClick={() => moveCategory(sub.id, category.id, 1)}
                      aria-label={`Move ${category.name} down`}
                      title="Move band down"
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronDown className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateSub(sub.id, {
                          categories: sub.categories.filter((cat) => cat.id !== category.id),
                        })
                      }
                      aria-label={`Remove ${category.name}`}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {deptRoles.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No Discord roles are mapped to {config.branding.shortName} yet. Map them on
                      the community's role mapping page first.
                    </p>
                  ) : (
                    deptRoles.map((role) => {
                      const owner = bandOf(sub.id, role.key);
                      const mine = owner?.id === category.id;
                      const elsewhere = owner && !mine;
                      return (
                        <button
                          key={role.key}
                          type="button"
                          onClick={() => toggleRole(sub.id, category.id, role.key)}
                          title={
                            elsewhere ? `Currently in "${owner.name}" — click to move it here` : undefined
                          }
                          className={
                            mine
                              ? "dept-accent-tile rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset"
                              : elsewhere
                                ? "rounded-full bg-white/[0.02] px-3 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-inset ring-white/[0.06] transition hover:text-slate-300"
                                : "rounded-full bg-white/[0.02] px-3 py-1.5 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.06] transition hover:bg-white/[0.06]"
                          }
                        >
                          {role.rankFull || role.rank}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() =>
              updateSub(sub.id, {
                categories: [
                  ...sub.categories,
                  {
                    id: `cat-${Date.now()}`,
                    name: "New band",
                    color: "#64748b",
                    roleKeys: [],
                    members: [],
                  },
                ],
              })
            }
          >
            <Plus className="size-4" />
            Add a band
          </Button>
        </Card>
      ))}

      <div className="mb-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setRoster({
              subdivisions: [
                ...subdivisions,
                {
                  id: `sub-${Date.now()}`,
                  name: "New unit",
                  main: false,
                  roleKeys: [],
                  categories: [],
                },
              ],
            })
          }
        >
          <Plus className="size-4" />
          Add a unit
        </Button>
        <p className="mt-1 text-xs text-slate-500">
          A unit is its own roster view — a subdivision like SWAT or a detective bureau. Add
          bands to it and assign the ranks that belong there.
        </p>
      </div>

      <MemberFields config={config} onChange={setRoster} />
      <RosterStats config={config} onChange={setRoster} />
    </>
  );
}

/** The columns the roster table shows beyond rank and name. */
function MemberFields({ config, onChange }) {
  const fields = config.roster.memberFields;

  const update = (id, changes) =>
    onChange({
      memberFields: fields.map((field) => (field.id === id ? { ...field, ...changes } : field)),
    });

  return (
    <Card className="mb-5 p-5">
      <h3 className="mb-1 text-sm font-bold uppercase tracking-[0.14em] text-white">Columns</h3>
      <p className="mb-4 text-sm text-slate-400">
        Shown after rank and name. The <code className="text-slate-300">status</code> column is the
        member's community-wide activity status, so editing it here changes it everywhere.
      </p>

      <div className="space-y-2">
        {fields.map((field) => (
          <div
            key={field.id}
            className="rounded-xl bg-white/[0.02] p-3 ring-1 ring-inset ring-white/[0.06]"
          >
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Label" htmlFor={`f-${field.id}`} className="min-w-40 flex-1">
                <TextInput
                  id={`f-${field.id}`}
                  value={field.label}
                  onChange={(e) => update(field.id, { label: e.target.value })}
                />
              </Field>
              <Field label="Type" htmlFor={`ft-${field.id}`} className="w-40">
                <Select
                  id={`ft-${field.id}`}
                  value={field.type}
                  onChange={(next) => update(field.id, { type: next })}
                  options={["text", "date", "checkbox", "cert", "select"]}
                />
              </Field>
              <button
                type="button"
                onClick={() =>
                  onChange({ memberFields: fields.filter((entry) => entry.id !== field.id) })
                }
                aria-label={`Remove ${field.label}`}
                className="mb-2 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
              >
                <X className="size-4" />
              </button>
            </div>

            {field.type === "select" && (
              <SelectOptions field={field} onChange={(changes) => update(field.id, changes)} />
            )}
          </div>
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="mt-3"
        onClick={() =>
          onChange({
            memberFields: [
              ...fields,
              { id: `field-${Date.now()}`, label: "New column", type: "text" },
            ],
          })
        }
      >
        <Plus className="size-4" />
        Add a column
      </Button>
    </Card>
  );
}

/** The values (and, for a pill, their colours) a select column can take. */
function SelectOptions({ field, onChange }) {
  const options = Array.isArray(field.options) ? field.options : [];
  const colors = field.optionColors ?? {};

  const setOption = (index, value) => {
    const prev = options[index];
    const next = options.slice();
    next[index] = value;
    // Carry the colour with the renamed value so recolouring survives an edit.
    const nextColors = { ...colors };
    if (prev in nextColors) {
      nextColors[value] = nextColors[prev];
      if (prev !== value) delete nextColors[prev];
    }
    onChange({ options: next, optionColors: nextColors });
  };

  const remove = (index) => {
    const value = options[index];
    const nextColors = { ...colors };
    delete nextColors[value];
    onChange({ options: options.filter((_, i) => i !== index), optionColors: nextColors });
  };

  return (
    <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
          Options
        </span>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={!!field.pill}
            onChange={(e) => onChange({ pill: e.target.checked })}
            className="size-3.5"
          />
          Show as a coloured pill
        </label>
      </div>
      <div className="space-y-1.5">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            {field.pill && (
              <input
                type="color"
                value={colors[option] || "#64748b"}
                onChange={(e) => onChange({ optionColors: { ...colors, [option]: e.target.value } })}
                aria-label={`Colour for ${option || "option"}`}
                className="size-7 shrink-0 cursor-pointer rounded bg-transparent"
              />
            )}
            <TextInput
              value={option}
              onChange={(e) => setOption(index, e.target.value)}
              placeholder="Option value"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label="Remove option"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        {options.length === 0 && (
          <p className="text-xs text-slate-500">No options yet — add the values this column can hold.</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2"
        onClick={() => onChange({ options: [...options, ""] })}
      >
        <Plus className="size-4" />
        Add option
      </Button>
    </div>
  );
}

/** The metrics row above the roster. */
function RosterStats({ config, onChange }) {
  const stats = config.roster.stats;
  const categories = config.roster.subdivisions.flatMap((sub) => sub.categories);

  const update = (id, changes) =>
    onChange({
      stats: {
        ...stats,
        items: stats.items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
      },
    });

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-white">Metrics</h3>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            checked={stats.show}
            onChange={(e) => onChange({ stats: { ...stats, show: e.target.checked } })}
            className="size-4 rounded border-white/20 bg-transparent"
          />
          Show above the roster
        </label>
      </div>

      <div className="space-y-2">
        {stats.items.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-end gap-3 rounded-xl bg-white/[0.02] p-3 ring-1 ring-inset ring-white/[0.06]"
          >
            <Field label="Label" htmlFor={`s-${item.id}`} className="min-w-40 flex-1">
              <TextInput
                id={`s-${item.id}`}
                value={item.label}
                onChange={(e) => update(item.id, { label: e.target.value })}
              />
            </Field>
            <Field label="Counts" htmlFor={`sm-${item.id}`} className="w-44">
              <Select
                id={`sm-${item.id}`}
                value={item.mode}
                onChange={(next) => update(item.id, { mode: next })}
                options={[
                  { value: "total", label: "Everyone" },
                  { value: "status", label: "One status" },
                  { value: "category", label: "One band" },
                ]}
              />
            </Field>
            {item.mode === "status" && (
              <Field label="Status" htmlFor={`sv-${item.id}`} className="w-40">
                <Select
                  id={`sv-${item.id}`}
                  value={item.statusValue ?? ""}
                  onChange={(next) => update(item.id, { statusValue: next })}
                  options={["Active", "Semi-Active", "LOA", "Inactive", "Suspended"]}
                />
              </Field>
            )}
            {item.mode === "category" && (
              <Field label="Band" htmlFor={`sc-${item.id}`} className="w-44">
                <Select
                  id={`sc-${item.id}`}
                  value={item.categoryId ?? ""}
                  onChange={(next) => update(item.id, { categoryId: next })}
                  options={categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  }))}
                />
              </Field>
            )}
            <button
              type="button"
              onClick={() =>
                onChange({
                  stats: { ...stats, items: stats.items.filter((entry) => entry.id !== item.id) },
                })
              }
              aria-label={`Remove ${item.label}`}
              className="mb-2 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="mt-3"
        onClick={() =>
          onChange({
            stats: {
              ...stats,
              items: [
                ...stats.items,
                { id: `st-${Date.now()}`, label: "New metric", mode: "total" },
              ],
            },
          })
        }
      >
        <Plus className="size-4" />
        Add a metric
      </Button>
    </Card>
  );
}
