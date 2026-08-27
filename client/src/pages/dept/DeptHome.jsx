import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import BlockRenderer from "../../components/dept/BlockRenderer";
import DeptBrandMark from "../../components/dept/DeptBrandMark";
import { useDeptConfig } from "../../context/useDeptConfig";

/**
 * Renders the hero title with the department name highlighted in the accent —
 * e.g. "Welcome to the <Florida Highway Patrol>" — matching the reference hub.
 * Falls back to plain text when the name does not appear in the title.
 */
function HeroTitle({ title, highlight }) {
  const idx = highlight ? title.indexOf(highlight) : -1;
  if (idx === -1) return title;
  return (
    <>
      {title.slice(0, idx)}
      <span className="dept-accent-text">{highlight}</span>
      {title.slice(idx + highlight.length)}
    </>
  );
}

/**
 * A department's landing page: a hero carrying its own branding, then whatever
 * content blocks the department has arranged. Everything on it comes from the
 * config, which is why the same component opens FHP's site and MPD's.
 */
export default function DeptHome({ page, config }) {
  const { capabilities } = useDeptConfig();
  const base = `/departments/${config.id}/hub`;
  const settings = page.config ?? {};
  const banner = settings.bannerUrl || config.branding.bannerUrl;
  const title = settings.heroTitle || `Welcome to ${config.branding.name}`;

  return (
    <>
      <Card className="relative overflow-hidden p-0">
        {/* The banner is a department's own artwork; a readability gradient sits
            over it — opaque on the left where the text is, clearing to the right
            — and the accent-tinted shell gradient stands in when there is none. */}
        {banner ? (
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${banner})` }}
          />
        ) : (
          <div className="hub-shell-gradient pointer-events-none absolute inset-0 opacity-70" />
        )}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: banner
              ? "linear-gradient(90deg, var(--color-bg) 0%, color-mix(in srgb, var(--color-bg) 78%, transparent) 48%, color-mix(in srgb, var(--color-bg) 20%, transparent) 100%)"
              : "linear-gradient(135deg, color-mix(in srgb, var(--dept-accent) 22%, transparent), transparent 55%)",
          }}
        />
        <div className="relative flex flex-wrap items-center gap-6 p-8 sm:p-12">
          <DeptBrandMark config={config} className="size-16 text-base" />
          <div className="min-w-0 flex-1">
            {settings.heroKicker && <p className="hub-kicker">{settings.heroKicker}</p>}
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              <HeroTitle title={title} highlight={config.branding.name} />
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
