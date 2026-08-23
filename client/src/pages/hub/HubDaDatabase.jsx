import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import { api } from "../../lib/api";
import { disciplinaryActions as seedActions } from "../../data/staffHubData";
import { formatDate } from "../../lib/format";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "Active", label: "Active" },
  { value: "Expired", label: "Expired" },
  { value: "Closed", label: "Closed" },
  { value: "Final", label: "Final" },
];

const STATUS_TONES = {
  Active: "amber",
  Expired: "slate",
  Closed: "green",
  Final: "rose",
};

/** Disciplinary record for the staff team. Administrator+ only. */
export default function HubDaDatabase() {
  const [records, setRecords] = useState(seedActions);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    let active = true;
    api.hubDisciplinary().then((next) => {
      if (active && next?.length) setRecords(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter((record) => {
      if (status !== "all" && record.status !== status) return false;
      if (!needle) return true;
      return (
        record.staffName.toLowerCase().includes(needle) ||
        record.id.toLowerCase().includes(needle) ||
        record.type.toLowerCase().includes(needle) ||
        record.summary.toLowerCase().includes(needle)
      );
    });
  }, [records, query, status]);

  return (
    <>
      <HubPageHeader
        icon="Gavel"
        title="Staff DA Database"
        subtitle="Disciplinary actions issued against staff. Handle this record with the same discretion you would a member's."
        actions={<Badge tone="rose">Administrator+</Badge>}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, reference or type"
            aria-label="Search disciplinary records"
            className="pl-11"
          />
        </div>
        <Select
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
          className="sm:w-52"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-400">No records match that search.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((record) => (
            <Card key={record.id} hover className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <code className="rounded-lg bg-black/30 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-inset ring-white/10">
                  {record.id}
                </code>
                <Badge tone={record.tone}>{record.type}</Badge>
                <Badge tone={STATUS_TONES[record.status] ?? "slate"} dot>
                  {record.status}
                </Badge>
                <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  {formatDate(record.issuedAt)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-sm font-bold text-white">{record.staffName}</p>
                <p className="text-xs text-slate-500">{record.rank}</p>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {record.summary}
              </p>

              <p className="mt-4 border-t border-white/[0.06] pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                Issued by {record.issuedBy}
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
