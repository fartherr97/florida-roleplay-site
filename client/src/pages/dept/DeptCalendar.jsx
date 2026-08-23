import DeptPageHeader from "../../components/dept/DeptPageHeader";
import RecordTable from "../../components/dept/RecordTable";
import { useDeptConfig } from "../../context/useDeptConfig";

const FIELDS = [
  { id: "title", label: "Event", type: "text" },
  { id: "date", label: "Date", type: "date" },
  { id: "time", label: "Time", type: "text", hint: "Local time, e.g. 8:00 PM EST." },
  {
    id: "kind",
    label: "Type",
    type: "select",
    options: ["Training", "Patrol", "Meeting", "Operation", "Other"],
    tones: { Training: "brand", Patrol: "green", Meeting: "amber", Operation: "rose" },
  },
  { id: "host", label: "Host", type: "text" },
  { id: "details", label: "Details", type: "textarea" },
];

/** Soonest first; entries with no date sink to the bottom rather than sorting oddly. */
const byDate = (a, b) => String(a.date || "9999").localeCompare(String(b.date || "9999"));

export default function DeptCalendar({ page, config }) {
  const { can } = useDeptConfig();
  return (
    <>
      <DeptPageHeader
        icon={page.icon}
        eyebrow={config.branding.shortName}
        title={page.label}
        subtitle="Trainings, patrols and operations on the department's schedule."
      />
      <RecordTable
        page={page}
        collection="events"
        fields={FIELDS}
        canEdit={can("manageCalendar")}
        singular="event"
        empty="Nothing on the calendar yet."
        sort={byDate}
      />
    </>
  );
}
