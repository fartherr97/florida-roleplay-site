import { createElement } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import { iconFor } from "../../lib/icons";

/**
 * Civilian overview. The community's shared civilian resources — the business
 * directory, the penal code, guides and assessments. (Per-character personal
 * records were removed.)
 */
const SHORTCUTS = [
  {
    to: "/civilian-hub/businesses",
    label: "Business Directory",
    icon: "Store",
    blurb: "Player-run businesses across the city, and who is hiring.",
  },
  {
    to: "/civilian-hub/penal-code",
    label: "Penal Code",
    icon: "Scale",
    blurb: "Charges, fines and licence points, searchable.",
  },
  {
    to: "/civilian-hub/guides",
    label: "Civilian Guides",
    icon: "BookOpen",
    blurb: "How things work in the city — the essentials for getting started.",
  },
  {
    to: "/civilian-hub/forms",
    label: "Forms & Assessments",
    icon: "ClipboardList",
    blurb: "Certification tests and the forms open to you.",
  },
];

export default function CivHome() {
  return (
    <>
      <HubPageHeader
        icon="Home"
        eyebrow="Civilian Hub"
        title="Overview"
        subtitle="Community resources for civilians — the directory, the penal code, guides and assessments."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {SHORTCUTS.map((shortcut) => (
          <Card key={shortcut.to} as={Link} to={shortcut.to} hover className="group flex flex-col p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-white/[0.04] text-slate-300 ring-1 ring-inset ring-white/[0.06]">
              {createElement(iconFor(shortcut.icon), { className: "size-5" })}
            </span>
            <p className="mt-4 text-sm font-bold text-white">{shortcut.label}</p>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{shortcut.blurb}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary-400 transition-all group-hover:gap-2.5">
              Open
              <ArrowRight className="size-3.5" />
            </span>
          </Card>
        ))}
      </div>
    </>
  );
}
