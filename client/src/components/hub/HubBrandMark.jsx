import { SITE } from "../../data/mockData";
import { cn } from "../../lib/cn";

/**
 * The emblem the portal landing pages lead with — the logo alone, drifting.
 *
 * The wrapper and the image animate separately on purpose. Both `fade-up` (the
 * entrance the landing page applies from outside) and `float` (the idle loop)
 * animate `transform`, so putting them on one element would let whichever
 * class comes later in the stylesheet silently win. The wrapper takes the
 * entrance, the image takes the loop, and the two compose.
 *
 * The shadow is `drop-shadow` rather than a box shadow: the emblem is a circular
 * badge on transparency, and a box shadow would cast a rectangle around it.
 */
export default function HubBrandMark({ className }) {
  return (
    <div className={cn("grid place-items-center", className)}>
      <img
        src={SITE.logoUrl}
        alt=""
        aria-hidden="true"
        className="animate-float size-40 object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.55)] sm:size-52"
      />
    </div>
  );
}
