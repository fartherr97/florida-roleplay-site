import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { TextInput } from "../../components/ui/TextInput";
import ExamStatusBadge from "../../components/hub/ExamStatusBadge";
import { api, buildMembers } from "../../lib/api";
import { EXAMS, attempts as seedAttempts } from "../../data/staffHubData";
import { formatDate } from "../../lib/format";

/** Exam history for one member, grouped by exam. */
function MemberModal({ member, onClose }) {
  if (!member) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={member.name}
      subtitle={member.discordId ? `Discord ID ${member.discordId}` : undefined}
      className="max-w-2xl"
    >
      <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
        {EXAMS.map((exam) => {
          const list = member.attemptsByExam?.[exam.key] ?? [];
          return (
            <Card key={exam.key} className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5">
                <h3 className="text-sm font-bold text-white">{exam.label}</h3>
                <Badge tone="slate">{list.length} attempts</Badge>
              </div>
              {list.length === 0 ? (
                <p className="px-5 py-5 text-sm text-slate-500">
                  No attempts recorded.
                </p>
              ) : (
                <ul className="divide-y divide-white/[0.06]">
                  {list.map((attempt) => (
                    <li
                      key={attempt.attemptId}
                      className="flex items-center gap-3 px-5 py-3.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">
                          {attempt.score}
                        </p>
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                          {formatDate(attempt.submittedAt)}
                          {attempt.override && " · overridden"}
                        </p>
                      </div>
                      <ExamStatusBadge status={attempt.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </Modal>
  );
}

/** Searchable index of everyone who has sat a staff exam. */
export default function HubExamMembers() {
  const [members, setMembers] = useState(() => buildMembers(seedAttempts));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api.hubExamMembers(query).then((next) => {
        if (active && next) setMembers(next);
      });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <>
      <HubPageHeader
        icon="UserSearch"
        title="Members"
        subtitle="Everyone who has sat a staff exam, with their full attempt history."
        actions={<Badge tone="primary">Jr. Admin+</Badge>}
      />

      <div className="relative mb-6 max-w-lg">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <TextInput
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or Discord ID"
          aria-label="Search exam members"
          className="pl-11"
        />
      </div>

      {members.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-400">No members match that search.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((member) => (
            <Card
              key={member.memberKey}
              as="button"
              type="button"
              hover
              onClick={() => setSelected(member)}
              className="p-5 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">
                    {member.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {member.discordId || "No Discord ID"}
                  </p>
                </div>
                {member.highestPass && (
                  <Badge tone="green">{member.highestPass}</Badge>
                )}
              </div>
              <p className="mt-4 border-t border-white/[0.06] pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {member.totalAttempts} attempt
                {member.totalAttempts === 1 ? "" : "s"} · last{" "}
                {formatDate(member.latestAt)}
              </p>
            </Card>
          ))}
        </div>
      )}

      <MemberModal member={selected} onClose={() => setSelected(null)} />
    </>
  );
}
