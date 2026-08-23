import { UserCog } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { departments, staff } from "../../data/mockData";
import { toneTile } from "../../lib/tones";

/**
 * Department command overview. Gated behind the management and department head
 * roles by RequireRole.
 */
export default function DepartmentHeads() {
  const heads = staff.filter((member) => member.group === "Emergency Services");

  return (
    <Section>
      <PageHeader
        eyebrow="Management"
        title="Department Heads"
        subtitle="Command staff for each agency, with current roster size and hiring state."
      />

      <div className="space-y-4">
        {departments.map((department) => {
          const head = heads.find((member) => member.department === department.abbr);
          return (
            <Card
              key={department.id}
              hover
              className="flex flex-wrap items-center gap-5 p-5"
            >
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${toneTile(department.tone)}`}
              >
                <UserCog className="size-5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">{department.abbr}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {department.name}
                </p>
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Command
                </p>
                <p className="mt-1 truncate text-sm text-slate-300">
                  {head ? head.name : "Vacant"}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Roster
                </p>
                <p className="mt-1 text-sm font-bold text-white">{department.roster}</p>
              </div>

              <Badge tone={department.hiring ? "green" : "slate"} dot={department.hiring}>
                {department.hiring ? "Hiring" : "Closed"}
              </Badge>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
