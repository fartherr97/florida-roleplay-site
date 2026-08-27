import { useEffect, useState } from "react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import DeptPageHeader from "../../components/dept/DeptPageHeader";
import { useDeptConfig } from "../../context/useDeptConfig";
import { chainFor } from "../../lib/deptRoster";
import { api } from "../../lib/api";

/**
 * The command tree.
 *
 * Deliberately derived rather than stored: the roster's categories are already
 * ordered command-first, so the chain is that order with each band's people
 * sorted by seniority. A separately maintained org chart would start drifting
 * from the roster the first time someone was promoted.
 */
export default function DeptChain({ page, config }) {
  const { id } = useDeptConfig();
  const [loaded, setLoaded] = useState({ id: null, subdivisions: [] });

  useEffect(() => {
    let active = true;
    api.deptRoster(id).then((result) => {
      if (active) setLoaded({ id, subdivisions: result?.subdivisions ?? [] });
    });
    return () => {
      active = false;
    };
  }, [id]);

  const main =
    loaded.id === id
      ? loaded.subdivisions.find((sub) => sub.main) ?? loaded.subdivisions[0]
      : null;
  const tiers = chainFor(main);

  return (
    <>
      <DeptPageHeader
        icon={page.icon}
        eyebrow={config.branding.shortName}
        title={page.label}
        subtitle="Who reports to whom, straight from the roster — it updates when ranks do."
      />

      {tiers.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-slate-400">
            Nobody is rostered in {config.branding.shortName} yet, so there is no chain to draw.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {tiers.map((tier, index) => (
            <div key={tier.id}>
              {index > 0 && (
                <div
                  className="mx-auto h-6 w-px"
                  style={{ backgroundColor: "color-mix(in srgb, var(--dept-accent) 40%, transparent)" }}
                  aria-hidden="true"
                />
              )}
              <Card className="overflow-hidden">
                <div
                  className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-3"
                  style={{ backgroundColor: `color-mix(in srgb, ${tier.color} 12%, transparent)` }}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: tier.color }}
                    aria-hidden="true"
                  />
                  <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-white">
                    {tier.name}
                  </h2>
                  <span className="ml-auto text-xs text-slate-400">{tier.members.length}</span>
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                  {tier.members.map((member) => (
                    <div
                      key={member.id}
                      className="hub-card-hover rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">
                            {member.characterName}
                          </div>
                          <div className="dept-accent-text mt-0.5 truncate text-xs font-semibold">
                            {member.rankFull || member.rank}
                          </div>
                        </div>
                        {member.callsign && (
                          <Badge tone="slate">{member.callsign}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
