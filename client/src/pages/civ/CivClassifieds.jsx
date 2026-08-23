import { useEffect, useMemo, useState } from "react";
import { Phone, Search } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { classifieds as seedClassifieds } from "../../data/civilianHubData";

const CATEGORY_TONES = {
  Vehicles: "brand",
  Property: "green",
  Goods: "primary",
  Wanted: "amber",
};

/** The in-character classifieds board. */
export default function CivClassifieds() {
  const [listings, setListings] = useState(seedClassifieds);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    let active = true;
    api.civClassifieds().then((next) => {
      if (active && next?.length) setListings(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const options = useMemo(
    () => [
      { value: "all", label: "All categories" },
      ...[...new Set(listings.map((l) => l.category))].sort().map((c) => ({
        value: c,
        label: c,
      })),
    ],
    [listings],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return listings.filter((listing) => {
      if (category !== "all" && listing.category !== category) return false;
      if (!needle) return true;
      return [listing.title, listing.seller, listing.blurb]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [listings, query, category]);

  return (
    <>
      <HubPageHeader
        icon="Tag"
        eyebrow="Civilian Hub"
        title="Classifieds"
        subtitle="Buy, sell and trade in character. Post from your phone in game — listings expire after fourteen days."
        actions={<Badge tone="brand">{filtered.length} listings</Badge>}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search listings"
            aria-label="Search listings"
            className="pl-11"
          />
        </div>
        <Select value={category} onChange={setCategory} options={options} className="sm:w-52" />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-400">No listings match that search.</p>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((listing) => (
            <Card key={listing.id} hover className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <Badge tone={CATEGORY_TONES[listing.category] ?? "slate"}>
                  {listing.category}
                </Badge>
                <span className="shrink-0 text-sm font-bold text-primary-400">
                  {listing.price}
                </span>
              </div>

              <h2 className="mt-4 text-sm font-bold text-white">{listing.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
                {listing.blurb}
              </p>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  <Phone className="size-3.5 shrink-0" />
                  <span className="truncate">{listing.phone}</span>
                </span>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                  {formatDate(listing.postedAt)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
