import { useMemo } from "react";
import Card from "../../components/ui/Card";
import DeptPageHeader from "../../components/dept/DeptPageHeader";
import RecordTable from "../../components/dept/RecordTable";
import { useDeptConfig } from "../../context/useDeptConfig";

const FIELDS = [
  { id: "member", label: "Member", type: "text" },
  { id: "period", label: "Period", type: "text", hint: "e.g. August 2026, or Week 34." },
  { id: "hours", label: "Hours", type: "number" },
  { id: "notes", label: "Notes", type: "textarea" },
];

const byHours = (a, b) => Number(b.hours || 0) - Number(a.hours || 0);

export default function DeptHours({ page, config }) {
  const { can } = useDeptConfig();
  const entries = useMemo(() => page.config?.entries ?? [], [page.config]);

  const totals = useMemo(() => {
    const hours = entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
    const people = new Set(entries.map((entry) => entry.member)).size;
    return {
      hours,
      people,
      average: people > 0 ? Math.round((hours / people) * 10) / 10 : 0,
    };
  }, [entries]);

  return (
    <>
      <DeptPageHeader
        icon={page.icon}
        eyebrow={config.branding.shortName}
        title={page.label}
        subtitle="Patrol time logged for the current activity period."
      />

      {entries.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Hours logged", value: totals.hours },
            { label: "Members", value: totals.people },
            { label: "Average", value: totals.average },
          ].map((stat) => (
            <Card key={stat.label} className="p-5">
              <div className="dept-accent-text text-2xl font-extrabold tracking-tight">
                {stat.value}
              </div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {stat.label}
              </div>
            </Card>
          ))}
        </div>
      )}

      <RecordTable
        page={page}
        collection="entries"
        fields={FIELDS}
        canEdit={can("editRoster")}
        singular="entry"
        empty="No hours logged for this period yet."
        sort={byHours}
      />
    </>
  );
}
