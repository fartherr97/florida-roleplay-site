import Card from "../../components/ui/Card";
import BlockRenderer from "../../components/dept/BlockRenderer";
import DeptPageHeader from "../../components/dept/DeptPageHeader";

/**
 * A page of content blocks — SOPs, resources, guides, anything a department
 * writes rather than tracks. Also the fallback renderer for a page whose type
 * this build does not know, so an older config never renders a blank screen.
 */
export default function DeptContent({ page, config }) {
  const base = `/departments/${config.id}/hub`;
  const settings = page.config ?? {};
  const blocks = settings.blocks ?? [];

  return (
    <>
      <DeptPageHeader
        icon={page.icon}
        eyebrow={config.branding.shortName}
        title={settings.heroTitle || page.label}
        subtitle={settings.heroSubtitle}
      />
      {blocks.length > 0 ? (
        <BlockRenderer blocks={blocks} base={base} />
      ) : (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-400">
            This page is empty. Someone with the Builder Portal can add content blocks to it.
          </p>
        </Card>
      )}
    </>
  );
}
