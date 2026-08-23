import { Link } from "react-router-dom";
import { Check, Circle } from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import TabIntro from "./TabIntro";
import { cn } from "../../../lib/cn";

/**
 * The orientation tab. A department site has a lot of surface, and the order the
 * pieces are set up in matters — branding before pages, roster bands before
 * anyone looks at the roster — so this is a checklist that reads the config and
 * says what is actually still missing rather than a static tour.
 */
export default function StartHereTab({ config }) {
  const base = `/departments/${config.id}/hub`;

  const steps = [
    {
      id: "branding",
      label: "Set the department's branding",
      detail: "Name, tagline, accent colour and logo. The accent tints this whole site.",
      done: Boolean(config.branding.description && config.branding.tagline),
    },
    {
      id: "bands",
      label: "Put every rank in a band",
      detail:
        "The roster buckets people by their Discord role. A rank in no band shows under “Unassigned”.",
      done: (config.roster.subdivisions ?? []).every((sub) =>
        (sub.categories ?? []).some((category) => (category.roleKeys ?? []).length > 0),
      ),
    },
    {
      id: "pages",
      label: "Arrange the pages",
      detail: "Add the pages this department needs, drop the ones it does not, and group them.",
      done: config.pages.length > 3,
    },
    {
      id: "content",
      label: "Write the overview page",
      detail: "Content blocks on the home page — quick links, standing orders, a notice.",
      done: (config.pages.find((page) => page.type === "home")?.config?.blocks ?? []).length > 0,
    },
    {
      id: "access",
      label: "Grant access to command staff",
      detail: "Bind each capability to a Discord role, so access follows promotions.",
      done: (config.access ?? []).length > 1,
      to: `${base}/access`,
    },
  ];

  const done = steps.filter((step) => step.done).length;

  return (
    <>
      <TabIntro title="Setting this department up" badge={`${done} of ${steps.length}`}>
        Everything below is optional — the site works as soon as it exists. This is the order that
        saves the most backtracking.
      </TabIntro>

      <div className="space-y-3">
        {steps.map((step) => {
          const body = (
            <Card
              className={cn("flex items-start gap-4 p-5", step.to && "transition hover:bg-white/[0.04]")}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ring-1 ring-inset",
                  step.done ? "dept-accent-bg text-white ring-transparent" : "text-slate-600 ring-white/15",
                )}
              >
                {step.done ? <Check className="size-3.5" /> : <Circle className="size-2.5 fill-current" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">{step.label}</span>
                  {step.done && <Badge tone="green">Done</Badge>}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{step.detail}</p>
              </div>
            </Card>
          );
          return step.to ? (
            <Link key={step.id} to={step.to} className="block">
              {body}
            </Link>
          ) : (
            <div key={step.id}>{body}</div>
          );
        })}
      </div>

      <Card className="mt-6 p-5">
        <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-white">
          How this site relates to the rest of the community
        </h3>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-400">
          <li>
            <span className="font-semibold text-slate-200">Membership is not edited here.</span>{" "}
            Everyone on the roster got there by holding a Discord role that the community's role
            map assigns to {config.branding.shortName}. Promote someone in Discord and this site
            follows.
          </li>
          <li>
            <span className="font-semibold text-slate-200">Access is Discord roles too.</span> The
            Access page binds each capability to a role, so nobody has to be added and removed by
            hand when they change rank.
          </li>
          <li>
            <span className="font-semibold text-slate-200">Nothing here is destructive.</span> Every
            save keeps the version it replaced; the Audit page restores one.
          </li>
        </ul>
      </Card>
    </>
  );
}
