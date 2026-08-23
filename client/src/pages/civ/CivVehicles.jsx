import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import DataTable from "../../components/hub/DataTable";
import Badge from "../../components/ui/Badge";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { vehicles as seedVehicles } from "../../data/civilianHubData";

const STATUS_TONES = { Stored: "green", Out: "brand", Impounded: "rose" };
const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "Stored", label: "Stored" },
  { value: "Out", label: "Out" },
  { value: "Impounded", label: "Impounded" },
];

/** Registered vehicles — plate, registration, insurance and current location. */
export default function CivVehicles() {
  const [vehicles, setVehicles] = useState(seedVehicles);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    let active = true;
    api.civVehicles().then((next) => {
      if (active && next?.length) setVehicles(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return vehicles.filter((vehicle) => {
      if (status !== "all" && vehicle.status !== status) return false;
      if (!needle) return true;
      return [vehicle.plate, vehicle.make, vehicle.model, vehicle.owner]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [vehicles, query, status]);

  const columns = [
    {
      key: "vehicle",
      label: "Vehicle",
      render: (v) => (
        <>
          <p className="font-semibold text-white">
            {v.year} {v.make} {v.model}
          </p>
          <p className="text-xs text-slate-500">{v.colour}</p>
        </>
      ),
    },
    {
      key: "plate",
      label: "Plate",
      render: (v) => (
        <code className="rounded-lg bg-black/30 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-inset ring-white/10">
          {v.plate}
        </code>
      ),
    },
    { key: "owner", label: "Owner", render: (v) => <span className="text-slate-400">{v.owner}</span> },
    { key: "garage", label: "Location", render: (v) => <span className="text-slate-400">{v.garage}</span> },
    {
      key: "registered",
      label: "Registered until",
      render: (v) => <span className="text-slate-400">{formatDate(v.registeredUntil)}</span>,
    },
    {
      key: "insured",
      label: "Insurance",
      render: (v) => (
        <Badge tone={v.insured ? "green" : "amber"} dot={!v.insured}>
          {v.insured ? "Insured" : "None"}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (v) => (
        <Badge tone={STATUS_TONES[v.status] ?? "slate"} dot>
          {v.status}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <HubPageHeader
        icon="Car"
        eyebrow="Civilian Hub"
        title="Vehicles"
        subtitle="Everything registered to your characters. An impounded vehicle is released at the nearest police department for the recovery fee."
        actions={<Badge tone="brand">{rows.length} shown</Badge>}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by plate, make, model or owner"
            aria-label="Search vehicles"
            className="pl-11"
          />
        </div>
        <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} className="sm:w-52" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(v) => v.id}
        empty="No vehicles match that search."
      />
    </>
  );
}
