import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import { api } from "../../lib/api";
import { roster as seedRoster } from "../../data/staffHubData";
import { STAFF_RANKS } from "../../data/mockData";
import { formatDate } from "../../lib/format";

const RANK_TONES = {
  trial_mod: "slate",
  mod: "brand",
  senior_mod: "green",
  junior_admin: "primary",
  admin: "primary",
  senior_admin: "amber",
  head_admin: "rose",
};

const RANK_OPTIONS = [
  { value: "all", label: "All ranks" },
  ...STAFF_RANKS.map((rank) => ({ value: rank.id, label: rank.label })),
];

/** The full staff roster — searchable, filterable by rank. */
export default function HubRoster() {
  const [members, setMembers] = useState(seedRoster);
  const [query, setQuery] = useState("");
  const [rank, setRank] = useState("all");

  useEffect(() => {
    let active = true;
    api.hubRoster().then((next) => {
      if (active && next?.length) setMembers(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((member) => {
      if (rank !== "all" && member.rankId !== rank) return false;
      if (!needle) return true;
      return (
        member.name.toLowerCase().includes(needle) ||
        member.handle.toLowerCase().includes(needle) ||
        member.team.toLowerCase().includes(needle)
      );
    });
  }, [members, query, rank]);

  return (
    <>
      <HubPageHeader
        icon="Users"
        title="Staff Roster"
        subtitle="Everyone on the team, their rank, and their activity since joining."
        actions={<Badge tone="brand">{filtered.length} shown</Badge>}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, handle or team"
            aria-label="Search the roster"
            className="pl-11"
          />
        </div>
        <Select
          value={rank}
          onChange={setRank}
          options={RANK_OPTIONS}
          className="sm:w-56"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-400">No staff match that search.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-5 py-3 font-bold">Member</th>
                  <th className="px-5 py-3 font-bold">Rank</th>
                  <th className="px-5 py-3 font-bold">Team</th>
                  <th className="px-5 py-3 font-bold">Joined</th>
                  <th className="px-5 py-3 text-right font-bold">Claims</th>
                  <th className="px-5 py-3 text-right font-bold">Vest hrs</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filtered.map((member) => (
                  <tr key={member.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-white">{member.name}</p>
                      <p className="text-xs text-slate-500">@{member.handle}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={RANK_TONES[member.rankId] ?? "slate"}>
                        {member.rank}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">{member.team}</td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {formatDate(member.joined)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-white">
                      {member.claims}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-white">
                      {member.vestHours}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge
                        tone={member.status === "Active" ? "green" : "amber"}
                        dot={member.status === "Active"}
                      >
                        {member.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
