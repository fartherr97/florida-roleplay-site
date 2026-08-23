import Card from "../../../components/ui/Card";
import Field from "../../../components/ui/Field";
import { TextArea, TextInput } from "../../../components/ui/TextInput";
import DeptBrandMark from "../../../components/dept/DeptBrandMark";
import { useDeptConfig } from "../../../context/useDeptConfig";
import { ACCENT_PRESETS, accentOf, themeVars } from "../../../lib/departmentConfig";
import TabIntro from "./TabIntro";
import { cn } from "../../../lib/cn";

/** Identity: what the department is called and what colour it runs in. */
export default function BrandingTab({ config }) {
  const { mutate } = useDeptConfig();
  const branding = config.branding;
  const accent = accentOf(branding);

  const set = (changes) =>
    mutate((current) => ({ ...current, branding: { ...current.branding, ...changes } }));

  return (
    <>
      <TabIntro title="Branding">
        The accent tints every page of this department's site — nav, headings, buttons and roster
        bands — so it is the fastest way to make a new department feel like its own place.
      </TabIntro>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <Field label="Full name" htmlFor="b-name">
            <TextInput
              id="b-name"
              value={branding.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </Field>
          <Field label="Short name" htmlFor="b-short" hint="Shown in the top bar and roster tabs.">
            <TextInput
              id="b-short"
              value={branding.shortName}
              onChange={(e) => set({ shortName: e.target.value })}
            />
          </Field>
          <Field label="Tagline" htmlFor="b-tagline">
            <TextInput
              id="b-tagline"
              value={branding.tagline}
              onChange={(e) => set({ tagline: e.target.value })}
            />
          </Field>
          <Field label="Description" htmlFor="b-desc" hint="Shown on the departments directory.">
            <TextArea
              id="b-desc"
              rows={3}
              value={branding.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Accent
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => set({ accent: preset.id })}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl p-3 ring-1 ring-inset transition",
                    preset.id === branding.accent
                      ? "bg-white/[0.06] ring-white/25"
                      : "bg-white/[0.02] ring-white/[0.06] hover:bg-white/[0.05]",
                  )}
                >
                  <span
                    className="size-6 rounded-full"
                    style={{ backgroundColor: preset.color }}
                    aria-hidden="true"
                  />
                  <span className="text-[11px] font-semibold text-slate-300">{preset.label}</span>
                </button>
              ))}
            </div>
            <Field className="mt-4" label="Or a hex colour" htmlFor="b-accent" hint="#rrggbb.">
              <TextInput
                id="b-accent"
                value={branding.accent}
                onChange={(e) => set({ accent: e.target.value })}
              />
            </Field>
          </Card>

          <Card className="space-y-4 p-5">
            <Field label="Logo URL" htmlFor="b-logo" hint="Leave empty for a generated monogram.">
              <TextInput
                id="b-logo"
                value={branding.logoUrl}
                onChange={(e) => set({ logoUrl: e.target.value })}
              />
            </Field>
            <Field label="Banner URL" htmlFor="b-banner" hint="Sits behind the overview hero.">
              <TextInput
                id="b-banner"
                value={branding.bannerUrl}
                onChange={(e) => set({ bannerUrl: e.target.value })}
              />
            </Field>
          </Card>

          {/* The preview carries its own theme vars, so it shows the colour being
              chosen rather than the one currently saved and applied. */}
          <Card className="p-5" style={themeVars(branding)}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Preview
            </p>
            <div className="flex items-center gap-3">
              <DeptBrandMark config={config} className="size-11" />
              <div className="min-w-0">
                <div className="truncate text-[15px] font-extrabold text-white">
                  {branding.shortName || "Department"}
                </div>
                <div className="dept-accent-text truncate text-[10px] font-bold uppercase tracking-[0.16em]">
                  {branding.tagline || "Internal Operations"}
                </div>
              </div>
              <span className="dept-accent-bg ml-auto rounded-lg px-3 py-1.5 text-xs font-bold text-white">
                {accent.label}
              </span>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
