import DeptPageHeader from "../../components/dept/DeptPageHeader";
import RecordTable from "../../components/dept/RecordTable";
import { useDeptConfig } from "../../context/useDeptConfig";

/** The vehicles a department operates and who they are assigned to. */
const FIELDS = [
  { id: "vehicle", label: "Vehicle", type: "text", title: true },
  { id: "imageUrl", label: "Reference image", type: "url", image: true, hint: "A link to a photo of the unit." },
  { id: "callsign", label: "Unit", type: "text" },
  { id: "plate", label: "Plate", type: "text" },
  {
    id: "status",
    label: "Status",
    type: "select",
    options: ["In service", "Assigned", "Maintenance", "Out of service"],
    tones: {
      "In service": "green",
      Assigned: "brand",
      Maintenance: "amber",
      "Out of service": "rose",
    },
  },
  { id: "assignedTo", label: "Assigned to", type: "text" },
  { id: "notes", label: "Notes", type: "textarea" },
];

export default function DeptFleet({ page, config }) {
  const { can } = useDeptConfig();
  return (
    <>
      <DeptPageHeader
        icon={page.icon}
        eyebrow={config.branding.shortName}
        title={page.label}
        subtitle="Every marked and unmarked unit the department runs, and its current state."
      />
      <RecordTable
        page={page}
        collection="vehicles"
        fields={FIELDS}
        canEdit={can("editStructure")}
        singular="vehicle"
        layout="cards"
        empty="No vehicles on the fleet list yet."
      />
    </>
  );
}
