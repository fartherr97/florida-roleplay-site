import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import Section from "../components/layout/Section";
import PageHeader from "../components/layout/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { api } from "../lib/api";
import { patchNotes as seedNotes } from "../data/mockData";
import { formatDate } from "../lib/format";

/** Reverse-chronological changelog. */
export default function PatchNotes() {
  const [notes, setNotes] = useState(seedNotes);

  useEffect(() => {
    let active = true;
    api.patchNotes().then((data) => {
      if (active && data?.length) setNotes(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Section>
      <PageHeader
        eyebrow="Changelog"
        title="Patch Notes"
        subtitle="Every change that ships to the live server, newest first."
      />

      <div className="space-y-5">
        {notes.map((note) => (
          <Card key={note.id} hover className="p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-primary-500/15 text-primary-400 ring-1 ring-inset ring-primary-400/20">
                <Newspaper className="size-4" />
              </span>
              <Badge tone="brand">{note.version}</Badge>
              <Badge tone={note.tone ?? "slate"}>{note.tag}</Badge>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {formatDate(note.releasedAt)}
              </span>
            </div>

            <h2 className="mt-4 text-base font-bold text-white">{note.title}</h2>

            <ul className="mt-4 space-y-2.5">
              {note.changes.map((change) => (
                <li key={change} className="flex items-start gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary-500" />
                  <span className="text-sm leading-relaxed text-slate-400">
                    {change}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </Section>
  );
}
