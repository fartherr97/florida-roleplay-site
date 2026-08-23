import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { jobs as seedJobs } from "../../data/civilianHubData";

const TYPE_TONES = {
  "Full time": "green",
  "Part time": "brand",
  Casual: "amber",
  Seasonal: "primary",
};

/** Open vacancies posted by player-owned businesses. */
export default function CivJobs() {
  const [jobs, setJobs] = useState(seedJobs);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");

  useEffect(() => {
    let active = true;
    api.civJobs().then((next) => {
      if (active && next?.length) setJobs(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const options = useMemo(
    () => [
      { value: "all", label: "All types" },
      ...[...new Set(jobs.map((j) => j.type))].sort().map((t) => ({ value: t, label: t })),
    ],
    [jobs],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (type !== "all" && job.type !== type) return false;
      if (!needle) return true;
      return [job.title, job.business, job.category, job.blurb]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [jobs, query, type]);

  return (
    <>
      <HubPageHeader
        icon="Briefcase"
        eyebrow="Civilian Hub"
        title="Job Board"
        subtitle="Vacancies posted by businesses around the county. Apply in character — call the number on the business listing."
        actions={<Badge tone="brand">{filtered.length} open</Badge>}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vacancies"
            aria-label="Search vacancies"
            className="pl-11"
          />
        </div>
        <Select value={type} onChange={setType} options={options} className="sm:w-52" />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-400">No vacancies match that search.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((job) => (
            <Card key={job.id} hover className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-white">{job.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{job.business}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Badge tone={TYPE_TONES[job.type] ?? "slate"}>{job.type}</Badge>
                  <Badge tone="slate">{job.category}</Badge>
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-slate-400">{job.blurb}</p>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.06] pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                <span className="text-primary-400">{job.pay}</span>
                <span>Posted {formatDate(job.postedAt)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
