import { useEffect, useMemo, useState } from "react";
import { Clock, MapPin, Users } from "lucide-react";
import Section from "../components/layout/Section";
import PageHeader from "../components/layout/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { api } from "../lib/api";
import { events as seedEvents } from "../data/mockData";
import { dateParts } from "../lib/format";

/** Date chip rendered to the left of each event row. */
function DateChip({ date, past }) {
  const { month, day } = dateParts(date);
  return (
    <div
      className={`grid size-14 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${
        past
          ? "bg-white/[0.03] text-slate-500 ring-white/10"
          : "bg-primary-500/15 text-primary-300 ring-primary-400/25"
      }`}
    >
      <div className="text-center leading-none">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em]">{month}</p>
        <p className="mt-1 text-lg font-extrabold">{day}</p>
      </div>
    </div>
  );
}

function EventList({ items, past }) {
  return (
    <div className="space-y-4">
      {items.map((event) => (
        <Card key={event.id} hover className="flex gap-5 p-5">
          <DateChip date={event.date} past={past} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-base font-bold text-white">{event.title}</h3>
              <Badge tone={past ? "slate" : "green"} dot={!past}>
                {event.status}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {event.description}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" />
                {event.time}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {event.location}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" />
                {event.attendance} {past ? "attended" : "going"}
              </span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Upcoming and past community events. */
export default function Events() {
  const [events, setEvents] = useState(seedEvents);

  useEffect(() => {
    let active = true;
    api.events().then((data) => {
      if (active && data?.length) setEvents(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const { upcoming, past } = useMemo(
    () => ({
      upcoming: events.filter((e) => e.status !== "Past"),
      past: events.filter((e) => e.status === "Past"),
    }),
    [events],
  );

  return (
    <Section>
      <PageHeader
        eyebrow="Community"
        title="Events"
        subtitle="Car meets, multi-agency drills and season launches. Everything below runs on the main server unless stated otherwise."
      />

      {upcoming.length > 0 && (
        <div className="mb-12">
          <div className="mb-5 flex items-center gap-3">
            <Badge tone="primary">Upcoming</Badge>
            <span className="h-px flex-1 bg-white/[0.06]" />
          </div>
          <EventList items={upcoming} past={false} />
        </div>
      )}

      {past.length > 0 && (
        <div>
          <div className="mb-5 flex items-center gap-3">
            <Badge tone="slate">Past</Badge>
            <span className="h-px flex-1 bg-white/[0.06]" />
          </div>
          <EventList items={past} past />
        </div>
      )}
    </Section>
  );
}
