import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, TriangleAlert } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import StatTile from "../../components/hub/StatTile";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { api } from "../../lib/api";
import { money } from "../../lib/money";
import { formatDate } from "../../lib/format";
import {
  characters as seedCharacters,
  licences as seedLicences,
  properties as seedProperties,
  vehicles as seedVehicles,
} from "../../data/civilianHubData";

const SHORTCUTS = [
  { to: "/civilian-hub/vehicles", label: "Vehicles", blurb: "Registration, insurance and where each one is parked." },
  { to: "/civilian-hub/properties", label: "Properties", blurb: "What you own or rent, and the garage slots it carries." },
  { to: "/civilian-hub/jobs", label: "Job Board", blurb: "Who is hiring across the county right now." },
  { to: "/civilian-hub/penal-code", label: "Penal Code", blurb: "Charges, fines and licence points, searchable." },
];

/** Civilian overview — the character summary and anything needing attention. */
export default function CivHome() {
  const [characters, setCharacters] = useState(seedCharacters);
  const [vehicles, setVehicles] = useState(seedVehicles);
  const [properties, setProperties] = useState(seedProperties);
  const [licences, setLicences] = useState(seedLicences);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.civCharacters(),
      api.civVehicles(),
      api.civProperties(),
      api.civLicences(),
    ]).then(([c, v, p, l]) => {
      if (!active) return;
      if (c?.length) setCharacters(c);
      if (v?.length) setVehicles(v);
      if (p?.length) setProperties(p);
      if (l?.length) setLicences(l);
    });
    return () => {
      active = false;
    };
  }, []);

  const primary = characters.find((c) => c.primary) ?? characters[0];
  const needsAttention = licences.filter((l) => l.status !== "Valid");
  const impounded = vehicles.filter((v) => v.status === "Impounded");
  const uninsured = vehicles.filter((v) => !v.insured);

  return (
    <>
      <HubPageHeader
        icon="Home"
        eyebrow="Civilian Hub"
        title="Overview"
        subtitle="Everything your character owns, at a glance — plus anything that needs dealing with."
      />

      {primary && (
        <Card className="mb-6 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Primary character
              </p>
              <h2 className="mt-1.5 text-xl font-bold text-white">{primary.name}</h2>
              <p className="mt-1 text-sm text-slate-400">{primary.occupation}</p>
            </div>
            <Badge tone="green" dot>
              {primary.status}
            </Badge>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Bank" value={money(primary.bank)} tone="green" />
            <StatTile label="Cash" value={money(primary.cash)} />
            <StatTile label="Vehicles" value={vehicles.length} tone="brand" />
            <StatTile label="Properties" value={properties.length} tone="primary" />
          </div>
        </Card>
      )}

      {(needsAttention.length > 0 || impounded.length > 0 || uninsured.length > 0) && (
        <Card className="mb-6 p-6">
          <h2 className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400">
            <TriangleAlert className="size-4" />
            Needs attention
          </h2>
          <ul className="mt-4 space-y-2.5">
            {needsAttention.map((licence) => (
              <li
                key={licence.id}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-black/25 p-3.5 ring-1 ring-inset ring-white/[0.06]"
              >
                <Badge tone={licence.status === "Suspended" ? "rose" : "amber"} dot>
                  {licence.status}
                </Badge>
                <span className="min-w-0 flex-1 text-sm text-slate-300">
                  {licence.type} — {licence.holder}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  {licence.status === "Suspended" ? "Review required" : `Expires ${formatDate(licence.expiresAt)}`}
                </span>
              </li>
            ))}
            {impounded.map((vehicle) => (
              <li
                key={vehicle.id}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-black/25 p-3.5 ring-1 ring-inset ring-white/[0.06]"
              >
                <Badge tone="rose" dot>
                  Impounded
                </Badge>
                <span className="min-w-0 flex-1 text-sm text-slate-300">
                  {vehicle.year} {vehicle.make} {vehicle.model} — {vehicle.plate}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  {vehicle.garage}
                </span>
              </li>
            ))}
            {uninsured.map((vehicle) => (
              <li
                key={`u-${vehicle.id}`}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-black/25 p-3.5 ring-1 ring-inset ring-white/[0.06]"
              >
                <Badge tone="amber" dot>
                  Uninsured
                </Badge>
                <span className="min-w-0 flex-1 text-sm text-slate-300">
                  {vehicle.year} {vehicle.make} {vehicle.model} — {vehicle.plate}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Not covered
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SHORTCUTS.map((shortcut) => (
          <Card
            key={shortcut.to}
            as={Link}
            to={shortcut.to}
            hover
            className="group flex flex-col p-5"
          >
            <p className="text-sm font-bold text-white">{shortcut.label}</p>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
              {shortcut.blurb}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary-400 transition-all group-hover:gap-2.5">
              Open
              <ArrowRight className="size-3.5" />
            </span>
          </Card>
        ))}
      </div>
    </>
  );
}
