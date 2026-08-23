import DeptPageHeader from "../../components/dept/DeptPageHeader";
import RecordTable from "../../components/dept/RecordTable";
import { useDeptConfig } from "../../context/useDeptConfig";

/**
 * Uniform kits. `code` is the in-game clothing code members paste, which is why
 * it is a plain text field rather than something clever — it has to survive
 * being copied verbatim.
 */
const FIELDS = [
  { id: "name", label: "Kit", type: "text" },
  { id: "rank", label: "Worn by", type: "text", hint: "Which ranks or assignments wear this." },
  { id: "code", label: "Clothing code", type: "text" },
  { id: "imageUrl", label: "Reference image", type: "url", hint: "A link to a screenshot." },
  { id: "notes", label: "Notes", type: "textarea" },
];

export default function DeptUniforms({ page, config }) {
  const { can } = useDeptConfig();
  return (
    <>
      <DeptPageHeader
        icon={page.icon}
        eyebrow={config.branding.shortName}
        title={page.label}
        subtitle="Approved kits, who wears them and the codes to set them."
      />
      <RecordTable
        page={page}
        collection="kits"
        fields={FIELDS}
        canEdit={can("editStructure")}
        singular="kit"
        empty="No uniform kits recorded yet."
      />
    </>
  );
}
