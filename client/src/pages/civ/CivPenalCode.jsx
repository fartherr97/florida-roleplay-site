import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Section from "../../components/layout/Section";
import DataTable from "../../components/hub/DataTable";
import SearchHero from "../../components/ui/SearchHero";
import Select from "../../components/ui/Select";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import { useAuth } from "../../context/useAuth";
import { api } from "../../lib/api";
import { penalCode as seedPenalCode } from "../../data/civilianHubData";
import { cn } from "../../lib/cn";

/** The classes an editor can pick from, ordered least to most serious. */
const CLASS_CHOICES = [
  "Infraction",
  "Third Degree Misdemeanor",
  "Second Degree Misdemeanor",
  "First Degree Misdemeanor",
  "Third Degree Felony",
  "Second Degree Felony",
  "First Degree Felony",
  "Life Felony",
  "Capital Felony",
];
const BOND_CHOICES = ["Bond available", "No bail", "Citation", "Cash bail", "—"];

/** The category a class belongs to, used for the filter chips and colours. */
function classCategory(degree = "") {
  const d = degree.toLowerCase();
  if (d.includes("capital") || d.includes("life")) return "Capital/Life";
  if (d.includes("felony")) return "Felony";
  if (d.includes("misdemean")) return "Misdemeanor";
  if (d.includes("infraction")) return "Infraction";
  return "Other";
}

/** How serious a class is, so "most serious first" can sort by it. */
function severity(degree = "") {
  const d = degree.toLowerCase();
  let base = 0;
  if (d.includes("capital")) base = 40;
  else if (d.includes("life")) base = 30;
  else if (d.includes("felony")) base = 20;
  else if (d.includes("misdemean")) base = 10;
  if (d.includes("first")) base += 3;
  else if (d.includes("second")) base += 2;
  else if (d.includes("third")) base += 1;
  return base;
}

/** The Sonoran classes fold into three colours by their category word. */
function degreeTone(degree = "") {
  const d = degree.toLowerCase();
  if (d.includes("felony") || d.includes("capital") || d.includes("life")) return "rose";
  if (d.includes("misdemean")) return "amber";
  if (d.includes("infraction")) return "slate";
  return "slate";
}

/** Bail disposition, coloured so "No bail" reads at a glance. */
function bondClass(bond = "") {
  const b = bond.toLowerCase();
  if (b.includes("no bail")) return "text-rose-300";
  if (b.includes("bond")) return "text-emerald-300";
  if (b.includes("citation")) return "text-sky-300";
  if (b.includes("cash")) return "text-amber-300";
  return "text-slate-500";
}

const CLASSES = ["Infraction", "Misdemeanor", "Felony", "Capital/Life"];

const BAIL_OPTIONS = [
  { value: "all", label: "All bail types" },
  { value: "Bond available", label: "Bond available" },
  { value: "No bail", label: "No bail" },
  { value: "Citation", label: "Citation" },
  { value: "Cash bail", label: "Cash bail" },
];

const SORT_OPTIONS = [
  { value: "code", label: "Sort by code" },
  { value: "severity", label: "Most serious first" },
  { value: "title", label: "Charge A–Z" },
];

/** Searchable, filterable penal code — charges, class, bail, jail, fines and points. */
export default function CivPenalCode() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("civilian.penal.manage");

  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState(seedPenalCode);
  const [classFilter, setClassFilter] = useState("all");
  const [bailFilter, setBailFilter] = useState("all");
  const [sort, setSort] = useState("code");
  // null = closed; "new" = add form; a charge object = editing it.
  const [editing, setEditing] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api.civPenalCode(query).then((next) => {
        if (active && next) setEntries(next);
      });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, reloadKey]);

  const removeCharge = async (charge) => {
    await api.deletePenalCharge(charge.id);
    setReloadKey((k) => k + 1);
  };

  // Counts per class over the fetched set, so the chips show how many of each.
  const counts = useMemo(() => {
    const c = { all: entries.length, Infraction: 0, Misdemeanor: 0, Felony: 0, "Capital/Life": 0 };
    for (const e of entries) {
      const k = classCategory(e.degree);
      if (k in c) c[k] += 1;
    }
    return c;
  }, [entries]);

  const rows = useMemo(() => {
    let list = entries;
    if (classFilter !== "all") list = list.filter((e) => classCategory(e.degree) === classFilter);
    if (bailFilter !== "all") {
      list = list.filter((e) => (e.bond || "").toLowerCase() === bailFilter.toLowerCase());
    }
    const sorted = [...list];
    if (sort === "severity") {
      sorted.sort((a, b) => severity(b.degree) - severity(a.degree) || a.code.localeCompare(b.code, undefined, { numeric: true }));
    } else if (sort === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      sorted.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    }
    return sorted;
  }, [entries, classFilter, bailFilter, sort]);

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (e) => (
        <code className="rounded-lg bg-black/30 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-inset ring-white/10">
          {e.code}
        </code>
      ),
    },
    {
      key: "title",
      label: "Charge",
      render: (e) => (
        <>
          <p className="font-semibold text-white">{e.title}</p>
          {e.notes && <p className="mt-0.5 text-xs text-slate-500">{e.notes}</p>}
        </>
      ),
    },
    {
      key: "degree",
      label: "Class",
      render: (e) => <Badge tone={degreeTone(e.degree)}>{e.degree}</Badge>,
    },
    {
      key: "bond",
      label: "Bail",
      render: (e) => <span className={`text-sm font-medium ${bondClass(e.bond)}`}>{e.bond || "—"}</span>,
    },
    {
      key: "jail",
      label: "Jail",
      align: "right",
      render: (e) => <span className="whitespace-nowrap text-slate-300">{e.jail || "—"}</span>,
    },
    {
      key: "fine",
      label: "Fine",
      align: "right",
      render: (e) => (
        <span className={e.fine ? "font-semibold text-white" : "text-slate-600"}>{e.fine || "—"}</span>
      ),
    },
    {
      key: "points",
      label: "Points",
      align: "right",
      render: (e) => (
        <span className={e.points > 0 ? "font-bold text-amber-400" : "text-slate-600"}>
          {e.points || "—"}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "",
            align: "right",
            render: (e) => (
              <span className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(e)}
                  aria-label={`Edit ${e.title}`}
                  className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeCharge(e)}
                  aria-label={`Delete ${e.title}`}
                  className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                >
                  <Trash2 className="size-4" />
                </button>
              </span>
            ),
          },
        ]
      : []),
  ];

  const pills = [{ value: "all", label: "All" }, ...CLASSES.map((c) => ({ value: c, label: c === "Capital/Life" ? "Capital & Life" : `${c}s` }))];

  return (
    <Section>
      <HubPageHeader
        icon="Scale"
        eyebrow="Florida Roleplay"
        title="Penal Code"
        subtitle="What each charge carries. Officers apply these as written; a judge can vary them at arraignment."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" />
              Add charge
            </Button>
          ) : undefined
        }
      />

      <SearchHero
        title="Search the penal code"
        subtitle="By charge, code or keyword — try 'firearm', '316.193' or 'reckless'."
        value={query}
        onChange={setQuery}
        placeholder="Search charges"
      />

      {/* Filter by class, bail disposition and sort. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {pills.map((pill) => {
          const active = classFilter === pill.value;
          const count = counts[pill.value] ?? 0;
          return (
            <button
              key={pill.value}
              type="button"
              onClick={() => setClassFilter(pill.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition",
                active
                  ? "bg-primary-500/15 text-white ring-primary-400/40"
                  : "bg-black/20 text-slate-400 ring-white/[0.06] hover:text-white",
              )}
            >
              {pill.label}
              <span className={cn("tabular-nums", active ? "text-primary-200" : "text-slate-600")}>{count}</span>
            </button>
          );
        })}

        <div className="ml-auto flex flex-wrap gap-2">
          <Select value={bailFilter} onChange={setBailFilter} options={BAIL_OPTIONS} className="min-w-40" />
          <Select value={sort} onChange={setSort} options={SORT_OPTIONS} className="min-w-44" />
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Showing {rows.length} of {entries.length} charge{entries.length === 1 ? "" : "s"}
        {classFilter !== "all" || bailFilter !== "all" ? " · filtered" : ""}
      </p>

      <div className="mt-3">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(e) => e.id ?? e.code}
          empty={query || classFilter !== "all" || bailFilter !== "all" ? "No charges match those filters." : "No charges on record."}
        />
      </div>

      {editing && (
        <ChargeEditor
          key={editing === "new" ? "new" : editing.id}
          charge={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </Section>
  );
}

/** Add or edit a charge. The charge id keys the edit; a new charge has none. */
function ChargeEditor({ charge, onClose, onSaved }) {
  const isEdit = Boolean(charge);
  const [values, setValues] = useState({
    code: charge?.code ?? "",
    title: charge?.title ?? "",
    degree: charge?.degree ?? "Second Degree Misdemeanor",
    bond: charge?.bond || "Bond available",
    fine: charge?.fine ?? "",
    jail: charge?.jail ?? "",
    points: charge?.points ?? 0,
    notes: charge?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (patch) => setValues((v) => ({ ...v, ...patch }));

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!values.code.trim() || values.title.trim().length < 2 || !values.degree.trim()) {
      setError("A code, a charge title and a class are required.");
      return;
    }
    setSaving(true);
    const payload = { ...values, points: Number(values.points) || 0 };
    const result = isEdit
      ? await api.updatePenalCharge(charge.id, payload)
      : await api.createPenalCharge(payload);
    setSaving(false);
    if (result?.ok) onSaved();
    else setError(result?.message ?? result?.errors?.[0] ?? "That was not saved.");
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit charge" : "Add charge"} className="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <Field label="Code" htmlFor="p-code" required>
            <TextInput id="p-code" value={values.code} onChange={(e) => set({ code: e.target.value })} placeholder="316.193" />
          </Field>
          <Field label="Charge" htmlFor="p-title" required>
            <TextInput id="p-title" value={values.title} onChange={(e) => set({ title: e.target.value })} placeholder="Driving under the influence" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Class" htmlFor="p-degree" required>
            <Select
              value={values.degree}
              onChange={(degree) => set({ degree })}
              options={CLASS_CHOICES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="Bail" htmlFor="p-bond">
            <Select
              value={values.bond}
              onChange={(bond) => set({ bond })}
              options={BOND_CHOICES.map((b) => ({ value: b, label: b }))}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Jail" htmlFor="p-jail" hint="e.g. 400, or 5 Years">
            <TextInput id="p-jail" value={values.jail} onChange={(e) => set({ jail: e.target.value })} />
          </Field>
          <Field label="Fine" htmlFor="p-fine" hint="e.g. $500">
            <TextInput id="p-fine" value={values.fine} onChange={(e) => set({ fine: e.target.value })} />
          </Field>
          <Field label="Points" htmlFor="p-points">
            <TextInput id="p-points" type="number" value={values.points} onChange={(e) => set({ points: e.target.value })} className="max-w-24" />
          </Field>
        </div>

        <Field label="Notes" htmlFor="p-notes" hint="Optional — shown under the charge.">
          <TextArea id="p-notes" rows={2} value={values.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>

        {error && <p className="text-sm text-rose-300">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save" : "Add charge"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
