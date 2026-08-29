import { useEffect, useMemo, useState } from "react";
import { Mail, Search } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { cn } from "../../lib/cn";

/**
 * The community email directory — every member's email on file, joined to the
 * roster for their department and rank, with the addresses they had before.
 *
 * Read-only and Directorship+ (gated by `emails.view`). Members add and change
 * their own address through the bot's `/email add`; this is where the whole
 * directory is read, searched and filtered by department.
 */
export default function EmailDirectory() {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("all");

  useEffect(() => {
    let active = true;
    api.emails().then((r) => active && setData(r)).catch(() => active && setData({ members: [], departments: [] }));
    return () => {
      active = false;
    };
  }, []);

  const departments = useMemo(() => data?.departments ?? [], [data]);
  const deptMap = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);

  const deptOptions = useMemo(
    () => [{ value: "all", label: "Every department" }, ...departments.map((d) => ({ value: d.id, label: d.label }))],
    [departments],
  );

  const members = useMemo(() => data?.members ?? [], [data]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((m) => {
      if (dept !== "all" && m.department !== dept) return false;
      if (!needle) return true;
      return [m.name, m.email, m.discordId, m.rank, ...(m.history ?? []).map((h) => h.email)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [members, query, dept]);

  const withHistory = useMemo(() => members.filter((m) => (m.history ?? []).length > 0).length, [members]);

  return (
    <Section>
      <PageHeader
        eyebrow="Management"
        title="Email Directory"
        subtitle="Every member's email on file, by department and rank. Members add or change their own with /email add in Discord; this is the record."
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatBox label="Emails on file" value={members.length} />
        <StatBox label="Updated once+" value={withHistory} />
        <StatBox label="Showing" value={filtered.length} />
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a member, email, rank or Discord ID"
            aria-label="Search the directory"
            className="pl-11"
          />
        </div>
        <div className="w-56">
          <Select value={dept} onChange={setDept} options={deptOptions} />
        </div>
      </div>

      {data === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-16 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Mail className="mx-auto mb-3 size-8 text-slate-600" strokeWidth={1.25} />
          <p className="text-sm text-slate-400">
            {members.length === 0
              ? "No emails on file yet. Members add theirs with /email add in Discord."
              : "Nothing matches those filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-semibold">Member</th>
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-4 py-3 font-semibold">Rank</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.discordId} className="border-t border-white/5 align-top transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <div className="font-semibold leading-tight text-white">{m.name || "Unknown"}</div>
                      <code className="mt-0.5 block font-mono text-[11px] text-slate-500">{m.discordId}</code>
                    </td>
                    <td className="px-4 py-3">
                      {m.department ? (
                        <Badge tone="brand">{deptMap.get(m.department)?.abbr ?? m.department}</Badge>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-300">{m.rank || "—"}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`mailto:${m.email}`}
                        className="text-sm font-medium text-primary-300 hover:text-primary-200 hover:underline"
                      >
                        {m.email}
                      </a>
                      {(m.history ?? []).length > 0 && (
                        <div className="mt-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Previous</p>
                          <ul className="mt-0.5 space-y-0.5">
                            {m.history.slice(0, 5).map((h, i) => (
                              <li key={i} className="text-xs text-slate-500 line-through">
                                {h.email}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{formatDateTime(m.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Section>
  );
}

function StatBox({ label, value }) {
  return (
    <Card className={cn("p-4")}>
      <div className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-0.5 text-3xl font-black tabular-nums text-white">{value}</div>
    </Card>
  );
}
