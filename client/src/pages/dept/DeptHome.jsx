import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import BlockRenderer from "../../components/dept/BlockRenderer";
import DeptBrandMark from "../../components/dept/DeptBrandMark";
import { useDeptConfig } from "../../context/useDeptConfig";

/**
 * A department's landing page: a hero carrying its own branding, then whatever
 * content blocks the department has arranged. Everything on it comes from the
 * config, which is why the same component opens FHP's site and HCFR's.
 */
export default function DeptHome({ page, config }) {
  const { capabilities } = useDeptConfig();
  const base = `/departments/${config.id}/hub`;
  const settings = page.config ?? {};

  return (
    <>
      <Card className="relative overflow-hidden p-0">
        {/* The banner is a department's own artwork; the gradient underneath is
            what a department with none still looks deliberate against. */}
        {settings.bannerUrl || config.branding.bannerUrl ? (
          <img
            src={settings.bannerUrl || config.branding.bannerUrl}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-30"
          />
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--dept-accent) 22%, transparent), transparent 55%)",
          }}
        />
        <div className="relative flex flex-wrap items-center gap-6 p-8 sm:p-10">
          <DeptBrandMark config={config} className="size-16 text-base" />
          <div className="min-w-0 flex-1">
            <p className="dept-accent-text text-[11px] font-bold uppercase tracking-[0.18em]">
              {settings.heroKicker || config.branding.name}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              {settings.heroTitle || `${config.branding.shortName} Operations`}
            </h1>
            {(settings.heroSubtitle || config.branding.description) && (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
                {settings.heroSubtitle || config.branding.description}
              </p>
            )}
          </div>
          {capabilities.has("manage") && (
            <Button as={Link} to={`${base}/builder`} variant="secondary" size="sm">
              Edit this site
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </Card>

      {settings.blocks?.length > 0 && (
        <div className="mt-6">
          <BlockRenderer blocks={settings.blocks} base={base} />
        </div>
      )}

      {!settings.blocks?.length && (
        <Card className="mt-6 p-8 text-center">
          <Badge tone="slate">Nothing here yet</Badge>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
            {capabilities.has("manage")
              ? "Open the Builder Portal to add content blocks to this page — text, callouts, link cards and more."
              : "This department hasn't added anything to its overview page yet. The pages in the top bar are all live."}
          </p>
        </Card>
      )}
    </>
  );
}
