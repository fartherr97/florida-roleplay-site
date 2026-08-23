import { useEffect, useState } from "react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import DataTable from "../../components/hub/DataTable";
import SearchHero from "../../components/ui/SearchHero";
import Badge from "../../components/ui/Badge";
import { api } from "../../lib/api";
import { penalCode as seedPenalCode } from "../../data/civilianHubData";

const DEGREE_TONES = { Felony: "rose", Misdemeanour: "amber", Infraction: "slate" };

/** Searchable penal code — charges, fines, jail time and licence points. */
export default function CivPenalCode() {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState(seedPenalCode);

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
          <p className="mt-0.5 text-xs text-slate-500">{e.notes}</p>
        </>
      ),
    },
    {
      key: "degree",
      label: "Degree",
      render: (e) => <Badge tone={DEGREE_TONES[e.degree] ?? "slate"}>{e.degree}</Badge>,
    },
    { key: "fine", label: "Fine", align: "right", render: (e) => <span className="font-semibold text-white">{e.fine}</span> },
    { key: "jail", label: "Jail", align: "right", render: (e) => <span className="text-slate-400">{e.jail}</span> },
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
        subtitle="By charge, code or keyword — try 'firearm', 'P-207' or 'reckless'."
        value={query}
        onChange={setQuery}
        placeholder="Search charges"
      />

      <div className="mt-6">
        <DataTable
          columns={columns}
          rows={entries}
          rowKey={(e) => e.code}
          empty={`No charges match “${query}”.`}
        />
      </div>
    </>
  );
}
