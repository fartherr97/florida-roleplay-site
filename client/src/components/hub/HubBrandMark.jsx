import { SITE } from "../../data/mockData";
import { cn } from "../../lib/cn";

/**
 * The bordered logo plate the portal landing pages lead with — a hairline square
 * holding the emblem, with the community's short name in the top-left corner.
 */
export default function HubBrandMark({ className }) {
  return (
    <div
      className={cn(
        "relative grid size-40 place-items-center rounded-2xl border border-white/12 bg-white/[0.02] sm:size-52",
        className,
      )}
    >
      <span className="absolute left-3 top-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
        {SITE.shortName}
      </span>
      <img
        src={SITE.logoUrl}
        alt=""
        aria-hidden="true"
        className="size-16 object-contain sm:size-20"
      />
    </div>
  );
}
