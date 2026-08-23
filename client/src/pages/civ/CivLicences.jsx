import { useEffect, useState } from "react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import DataTable from "../../components/hub/DataTable";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { licences as seedLicences } from "../../data/civilianHubData";

const TONES = { Valid: "green", Expiring: "amber", Suspended: "rose", Revoked: "rose" };

/** Licences and permits, with points and expiry. */
export default function CivLicences() {
  const [licences, setLicences] = useState(seedLicences);

  useEffect(() => {
    let active = true;
    api.civLicences().then((next) => {
      if (active && next?.length) setLicences(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const columns = [
    {
      key: "type",
      label: "Licence",
      render: (l) => (
        <>
          <p className="font-semibold text-white">{l.type}</p>
          <p className="text-xs text-slate-500">{l.number}</p>
        </>
      ),
    },
    { key: "holder", label: "Holder", render: (l) => <span className="text-slate-400">{l.holder}</span> },
    { key: "issued", label: "Issued", render: (l) => <span className="text-slate-400">{formatDate(l.issuedAt)}</span> },
    { key: "expires", label: "Expires", render: (l) => <span className="text-slate-400">{formatDate(l.expiresAt)}</span> },
    {
      key: "points",
      label: "Points",
      align: "right",
      render: (l) => (
        <span
          className={
            l.points >= 6 ? "font-bold text-rose-400" : l.points > 0 ? "font-bold text-amber-400" : "text-slate-500"
          }
        >
          {l.points}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (l) => (
        <Badge tone={TONES[l.status] ?? "slate"} dot>
          {l.status}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <HubPageHeader
        icon="BadgeCheck"
        eyebrow="Civilian Hub"
        title="Licences"
        subtitle="Every licence and permit held by your characters. Twelve points in a rolling year suspends a driver licence."
      />

      <DataTable
        columns={columns}
        rows={licences}
        rowKey={(l) => l.id}
        empty="No licences on record."
      />

      <Card className="mt-6 p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          Renewals
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Driver and commercial licences renew at the DMV. Firearms permits are
          renewed at any police department and require a clean record for the
          preceding thirty days. A suspended licence cannot be renewed until the
          suspension is lifted by a court.
        </p>
      </Card>
    </>
  );
}
