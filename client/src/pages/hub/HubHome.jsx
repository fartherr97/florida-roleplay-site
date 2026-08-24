import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Award } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import StatTile from "../../components/hub/StatTile";
import { api } from "../../lib/api";
import { portal as seedPortal, portalLinks as seedLinks } from "../../data/staffHubData";

/** Portal home — reminders, the featured staff member and the quick notes board. */
export default function HubHome() {
  const [data, setData] = useState({ ...seedPortal, links: seedLinks });

  useEffect(() => {
    let active = true;
    api.hubPortal().then((next) => {
      if (active && next) setData(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const reminders = data.reminders ?? [];
  const featured = data.featuredMember ?? {};

  return (
    <>
      <HubPageHeader
        icon="Home"
        title="Staff Portal"
        subtitle="Your central home for staff tools, resources and documentation."
      />

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="p-6">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Reminders
          </h2>
          {reminders.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No reminders set.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {reminders.map((reminder, index) => (
                <li
                  key={reminder}
                  className="rounded-xl bg-black/25 p-4 ring-1 ring-inset ring-white/[0.06] transition hover:bg-white/[0.04] hover:ring-primary-400/25"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-400/80">
                    Reminder {index + 1}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                    {reminder}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-400">
            <Award className="size-4" />
            Staff Member of the Month
          </h2>

          <div className="mt-4 rounded-xl bg-black/25 p-4 ring-1 ring-inset ring-white/[0.06]">
            <p className="text-lg font-bold text-white">
              {featured.name || "Not set"}
            </p>
            {featured.rank && (
              <div className="mt-2">
                <Badge tone="primary">{featured.rank}</Badge>
              </div>
            )}
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              {featured.note || "No note added."}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatTile label="Claims" value={featured.claims || "0"} />
            <StatTile label="Vest Hours" value={featured.vestHours || "0"} />
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Quick Notes
        </h2>
        <p className="mt-4 whitespace-pre-wrap rounded-xl bg-black/25 p-4 text-sm leading-relaxed text-slate-300 ring-1 ring-inset ring-white/[0.06]">
          {data.quickNotes || "No notes yet."}
        </p>
      </Card>

      {/* The two pages that are not tabs. The bar carries what a moderator opens
          in a shift and Site Administration carries what a director configures;
          these sit either side of that line, so they live here rather than
          becoming a twelfth tab nobody has room for. */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {SHORTCUTS.map((shortcut) => (
          <Card
            key={shortcut.to}
            as={Link}
            to={shortcut.to}
            hover
            className="group flex items-center gap-4 p-5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">{shortcut.label}</p>
              <p className="mt-1 text-sm text-slate-400">{shortcut.detail}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-400 transition-all group-hover:gap-2.5">
              Open
              <ArrowRight className="size-3.5" />
            </span>
          </Card>
        ))}
      </div>
    </>
  );
}

const SHORTCUTS = [
  {
    to: "/staff-hub/resources",
    label: "Staff Resources",
    detail: "Handbook, response templates, sanction guidelines and the shift sheet.",
  },
  {
    to: "/staff-hub/dashboard",
    label: "Staff Dashboard",
    detail: "This week's claim volume, response time and who is carrying the load.",
  },
  {
    to: "/staff-hub/trial-checklist",
    label: "Trial Mod Checklist",
    detail: "What a trial has to clear before anybody signs them off.",
  },
]
