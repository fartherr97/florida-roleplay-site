import { useEffect, useMemo, useState } from "react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import DataTable from "../../components/hub/DataTable";
import SearchHero from "../../components/ui/SearchHero";
import Select from "../../components/ui/Select";
import Badge from "../../components/ui/Badge";
import { api } from "../../lib/api";
import { penalCode as seedPenalCode } from "../../data/civilianHubData";
import { cn } from "../../lib/cn";

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
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState(seedPenalCode);
  const [classFilter, setClassFilter] = useState("all");
  const [bailFilter, setBailFilter] = useState("all");
  const [sort, setSort] = useState("code");

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
  }, [query]);

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
  ];

  const pills = [{ value: "all", label: "All" }, ...CLASSES.map((c) => ({ value: c, label: c === "Capital/Life" ? "Capital & Life" : `${c}s` }))];

  return (
    <>
      <HubPageHeader
        icon="Scale"
        eyebrow="Civilian Hub"
        title="Penal Code"
        subtitle="What each charge carries. Officers apply these as written; a judge can vary them at arraignment."
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
    </>
  );
}
