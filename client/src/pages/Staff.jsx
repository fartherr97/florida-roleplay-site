import { useEffect, useMemo, useState } from "react";
import Section from "../components/layout/Section";
import PageHeader from "../components/layout/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { api } from "../lib/api";
import { staff as seedStaff } from "../data/mockData";

const GROUP_ORDER = ["Management", "Staff", "Emergency Services"];

/** Avatar with a presence dot — placeholder initials until Discord avatars land. */
function Avatar({ member }) {
  const initials = member.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return (
    <span className="relative">
      <span className="grid size-12 place-items-center rounded-full bg-white/[0.05] text-sm font-bold text-slate-300 ring-1 ring-inset ring-white/10">
        {initials}
      </span>
      {member.online && (
        <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-[#0a0e1a]" />
      )}
    </span>
  );
}

/** Staff roster, grouped by Management / Staff / Emergency Services leadership. */
export default function Staff() {
  const [members, setMembers] = useState(seedStaff);

  useEffect(() => {
    let active = true;
    api.staff().then((data) => {
      if (active && data?.length) setMembers(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({
        group,
        members: members.filter((m) => m.group === group),
      })).filter((entry) => entry.members.length > 0),
    [members],
  );

  return (
    <Section>
      <PageHeader
        eyebrow="The team"
        title="Staff"
        subtitle="The people who keep the server running — moderation, support, development and department command."
      />

      <div className="space-y-10">
        {grouped.map((entry) => (
          <div key={entry.group}>
            <div className="mb-5 flex items-center gap-3">
              <Badge tone={entry.group === "Management" ? "rose" : "primary"}>
                {entry.group}
              </Badge>
              <span className="h-px flex-1 bg-white/[0.06]" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {entry.members.map((member) => (
                <Card key={member.id} hover className="flex items-center gap-4 p-5">
                  <Avatar member={member} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">
                      {member.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      @{member.handle}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <Badge tone={member.tone}>{member.role}</Badge>
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                        {member.department}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
