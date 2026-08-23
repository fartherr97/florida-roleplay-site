import Card from "../../components/ui/Card";
import DeptPageHeader from "../../components/dept/DeptPageHeader";
import RecordTable from "../../components/dept/RecordTable";
import { useDeptConfig } from "../../context/useDeptConfig";

/**
 * Rank actions and discipline. The page type itself requires `manageLog` to
 * open — this is personnel material, so it is not simply hidden from the nav
 * for people who cannot write to it.
 */
const FIELDS = [
  { id: "date", label: "Date", type: "date" },
  { id: "member", label: "Member", type: "text" },
  {
    id: "action",
    label: "Action",
    type: "select",
    options: ["Promotion", "Demotion", "Commendation", "Written warning", "Suspension", "Removal"],
    tones: {
      Promotion: "green",
      Commendation: "brand",
      Demotion: "amber",
      "Written warning": "amber",
      Suspension: "rose",
      Removal: "rose",
    },
  },
  { id: "issuedBy", label: "Issued by", type: "text" },
  { id: "detail", label: "Detail", type: "textarea" },
];

/** Newest first. */
const byDateDesc = (a, b) => String(b.date || "").localeCompare(String(a.date || ""));

export default function DeptAdminLog({ page, config }) {
  const { can } = useDeptConfig();
  return (
    <>
      <DeptPageHeader
        icon={page.icon}
        eyebrow={config.branding.shortName}
        title={page.label}
        subtitle="Promotions, commendations and discipline, kept in one place."
      />
      <Card className="mb-5 p-4">
        <p className="text-xs leading-relaxed text-slate-400">
          Entries here are the department's own record. They do not change anyone's Discord
          roles — a promotion takes effect when the role is granted, and the roster follows it.
        </p>
      </Card>
      <RecordTable
        page={page}
        collection="entries"
        fields={FIELDS}
        canEdit={can("manageLog")}
        singular="entry"
        empty="No entries filed yet."
        sort={byDateDesc}
      />
    </>
  );
}
