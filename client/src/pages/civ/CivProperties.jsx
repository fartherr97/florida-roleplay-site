import { useEffect, useState } from "react";
import { Key, MapPin } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import StatTile from "../../components/hub/StatTile";
import { api } from "../../lib/api";
import { money } from "../../lib/money";
import { formatDate } from "../../lib/format";
import { properties as seedProperties } from "../../data/civilianHubData";

/** Owned and rented property, with the garage capacity each carries. */
export default function CivProperties() {
  const [properties, setProperties] = useState(seedProperties);

  useEffect(() => {
    let active = true;
    api.civProperties().then((next) => {
      if (active && next?.length) setProperties(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const totalValue = properties
    .filter((p) => p.status === "Owned")
    .reduce((sum, p) => sum + p.value, 0);
  const slots = properties.reduce((sum, p) => sum + p.garageSlots, 0);

  return (
    <>
      <HubPageHeader
        icon="House"
        eyebrow="Civilian Hub"
        title="Properties"
        subtitle="Residential and storage property held by your characters. Listings and viewings are handled by Sunshine Realty."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Properties" value={properties.length} />
        <StatTile label="Owned value" value={money(totalValue)} tone="green" />
        <StatTile label="Garage slots" value={slots} tone="brand" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {properties.map((property) => (
          <Card key={property.id} hover className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-white">{property.address}</h2>
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-400">
                  <MapPin className="size-3.5" />
                  {property.district}
                </p>
              </div>
              <Badge tone={property.status === "Owned" ? "green" : "amber"} dot>
                {property.status}
              </Badge>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <StatTile label={property.type} value={money(property.value)} />
              <StatTile
                label="Garage slots"
                value={property.garageSlots || "—"}
                tone="brand"
              />
            </div>

            <p className="mt-4 inline-flex items-center gap-1.5 border-t border-white/[0.06] pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
              <Key className="size-3.5" />
              Held by {property.owner} since {formatDate(property.purchasedAt)}
            </p>
          </Card>
        ))}
      </div>
    </>
  );
}
