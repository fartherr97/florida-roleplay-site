import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Megaphone } from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import BlockRenderer from "../../components/dept/BlockRenderer";
import DeptBrandMark from "../../components/dept/DeptBrandMark";
import { useDeptConfig } from "../../context/useDeptConfig";
import { safeUrl } from "../../lib/safeUrl";

/**
 * A department's public welcome page — the reference hub's front door. A hero
 * over a rotating photo gallery, a scrolling announcements ticker, and whatever
 * content blocks the department arranges beneath. Everything is config, so the
 * same component is FHP's landing and MPD's.
 */
export default function DeptWelcome({ page, config }) {
  const { capabilities } = useDeptConfig();
  const base = `/departments/${config.id}/hub`;
  const settings = page.config ?? {};

  const gallery = (Array.isArray(settings.gallery) ? settings.gallery : []).filter((g) =>
    safeUrl(g?.url),
  );
  const announcements = (Array.isArray(settings.announcements) ? settings.announcements : []).filter(
    (a) => typeof a === "string" && a.trim(),
  );

  // The gallery cross-fades between photos on a timer; the Ken-Burns zoom is
  // restarted each swap by keying the <img> on the active index.
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (gallery.length < 2) return undefined;
    const id = setInterval(() => setActive((i) => (i + 1) % gallery.length), 6000);
    return () => clearInterval(id);
  }, [gallery.length]);

  const photo = gallery[active % gallery.length];
  const title = settings.heroTitle || `Welcome to ${config.branding.name}`;

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden p-0">
        {/* Rotating gallery, or the accent shell gradient when none is set. */}
        {photo ? (
          <img
            key={active}
            src={safeUrl(photo.url)}
            alt={photo.caption || ""}
            className="ken-burns absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="hub-shell-gradient absolute inset-0" />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(6,12,24,0.55) 0%, rgba(6,12,24,0.7) 55%, color-mix(in srgb, var(--dept-accent) 26%, rgba(6,12,24,0.85)) 100%)",
          }}
        />
        <div className="relative flex min-h-[22rem] flex-col justify-end gap-4 p-8 sm:p-12">
          <DeptBrandMark config={config} className="size-16 text-base" />
          <div>
            {settings.heroKicker && <p className="hub-kicker">{settings.heroKicker}</p>}
            <h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              {title}
            </h1>
            {(settings.heroSubtitle || config.branding.description) && (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-200 sm:text-base">
                {settings.heroSubtitle || config.branding.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button as={Link} to={`${base}/roster`} size="sm">
              View the roster
              <ArrowRight className="size-4" />
            </Button>
            {capabilities.has("manage") && (
              <Button as={Link} to={`${base}/builder`} variant="secondary" size="sm">
                Edit this site
              </Button>
            )}
          </div>
          {photo?.caption && (
            <span className="pointer-events-none absolute bottom-3 right-4 text-[11px] text-slate-300/80">
              {photo.caption}
            </span>
          )}
        </div>
      </Card>

      {announcements.length > 0 && (
        <Card className="ticker-mask flex items-center gap-3 overflow-hidden p-0">
          <span className="dept-accent-tile grid size-10 shrink-0 place-items-center sm:size-12">
            <Megaphone className="size-5" />
          </span>
          <div className="relative min-w-0 flex-1 overflow-hidden py-3">
            <div className="ticker-track" style={{ "--ticker-duration": `${Math.max(20, announcements.length * 12)}s` }}>
              {[0, 1].map((half) => (
                <div key={half} className="ticker-half" aria-hidden={half === 1}>
                  {announcements.map((text, i) => (
                    <span key={i} className="mx-6 text-sm font-medium text-slate-200">
                      {text}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {gallery.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2">
          {gallery.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1}`}
              className={
                i === active % gallery.length
                  ? "dept-accent-bg h-1.5 w-6 rounded-full"
                  : "h-1.5 w-2.5 rounded-full bg-white/20 transition hover:bg-white/40"
              }
            />
          ))}
        </div>
      )}

      {settings.blocks?.length > 0 && <BlockRenderer blocks={settings.blocks} base={base} />}
    </div>
  );
}
