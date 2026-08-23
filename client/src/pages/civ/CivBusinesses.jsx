import { useEffect, useMemo, useState } from "react";
import { MapPin, Phone, Search } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import { api } from "../../lib/api";
import { businesses as seedBusinesses } from "../../data/civilianHubData";

/** Player-owned businesses across the county. */
export default function CivBusinesses() {
  const [businesses, setBusinesses] = useState(seedBusinesses);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    let active = true;
    api.civBusinesses().then((next) => {
      if (active && next?.length) setBusinesses(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const options = useMemo(
    () => [
      { value: "all", label: "All categories" },
      ...[...new Set(businesses.map((b) => b.category))].sort().map((c) => ({
        value: c,
        label: c,
      })),
    ],
    [businesses],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return businesses.filter((business) => {
      if (category !== "all" && business.category !== category) return false;
      if (!needle) return true;
      return [business.name, business.owner, business.district, business.blurb]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [businesses, query, category]);

  return (
    <>
      <HubPageHeader
        icon="Store"
        eyebrow="Civilian Hub"
        title="Business Directory"
        subtitle="Every player-owned business trading in the county. To list yours, open a ticket with the business licence attached."
        actions={<Badge tone="brand">{filtered.length} listed</Badge>}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search businesses"
            aria-label="Search businesses"
            className="pl-11"
          />
        </div>
        <Select value={category} onChange={setCategory} options={options} className="sm:w-56" />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-400">No businesses match that search.</p>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((business) => (
            <Card key={business.id} hover className="flex flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 text-base font-bold text-white">{business.name}</h2>
                {business.hiring && <Badge tone="green" dot>Hiring</Badge>}
              </div>
              <Badge tone="slate" className="mt-3 self-start">
                {business.category}
              </Badge>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">
                {business.blurb}
              </p>
              <dl className="mt-5 space-y-2 border-t border-white/[0.06] pt-4 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="size-3.5 shrink-0 text-slate-500" />
                  <dt className="sr-only">District</dt>
                  <dd className="text-slate-400">{business.district}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="size-3.5 shrink-0 text-slate-500" />
                  <dt className="sr-only">Phone</dt>
                  <dd className="text-slate-400">{business.phone}</dd>
                </div>
              </dl>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                Owner · {business.owner}
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
