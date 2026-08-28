import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus, UserPlus, Users } from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import DeptPageHeader from "../../components/dept/DeptPageHeader";
import { useDeptConfig } from "../../context/useDeptConfig";
import { useAuth } from "../../context/useAuth";
import { api } from "../../lib/api";

const KINDS = ["Training", "Patrol", "Meeting", "Operation", "Other"];
const KIND_COLOR = {
  Training: "#3b82f6",
  Patrol: "#22c55e",
  Meeting: "#f59e0b",
  Operation: "#ef4444",
  Other: "#64748b",
};
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayKey = () => {
  const t = new Date();
  return ymd(t.getFullYear(), t.getMonth(), t.getDate());
};
/** "2026-08-30" → "Aug 30", for the sidebar and detail lines. */
function prettyDate(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key || "");
  if (!m) return key;
  return `${MONTHS[Number(m[2]) - 1]?.slice(0, 3)} ${Number(m[3])}`;
}

function blankEvent(date = "") {
  return { id: `ev-${Date.now()}`, title: "", date, time: "", kind: "Training", host: "", details: "" };
}

/**
 * A department's schedule as a real month calendar, with an upcoming-events rail
 * beside it. Clicking an event opens its details, where any member can Attend —
 * the RSVP list shows every attendee with their Discord id. Editors add and
 * edit events; the events themselves save to the department's config, while
 * attendance lives in its own table so a click needs no edit rights.
 */
export default function DeptCalendar({ page, config }) {
  const { id, can, savePage } = useDeptConfig();
  const { user } = useAuth();
  const canEdit = can("manageCalendar");
  const events = useMemo(
    () => (Array.isArray(page.config?.events) ? page.config.events : []),
    [page.config],
  );

  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [error, setError] = useState("");
  const [attendance, setAttendance] = useState({});

  useEffect(() => {
    let active = true;
    api.deptEventAttendance(id).then((data) => active && setAttendance(data?.attendance ?? {}));
    return () => {
      active = false;
    };
  }, [id]);

  const write = async (nextEvents) => {
    setError("");
    try {
      await savePage(page.id, { ...(page.config ?? {}), events: nextEvents });
    } catch (err) {
      setError(err?.errors?.join(" ") || err?.message || "That change was rejected.");
    }
  };
  const submit = (event) => {
    const exists = events.some((e) => e.id === event.id);
    write(exists ? events.map((e) => (e.id === event.id ? event : e)) : [...events, event]);
    setEditing(null);
  };
  const remove = (event) => {
    write(events.filter((e) => e.id !== event.id));
    setConfirming(null);
    setEditing(null);
    setViewing(null);
  };

  const toggleAttend = async (event) => {
    if (!user?.id) return;
    const going = (attendance[event.id] ?? []).some((a) => a.discordId === user.id);
    const result = await api.attendEvent(id, event.id, !going);
    if (result?.attendees) setAttendance((prev) => ({ ...prev, [event.id]: result.attendees }));
  };

  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      if (!e.date) continue;
      (map.get(e.date) ?? map.set(e.date, []).get(e.date)).push(e);
    }
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const start = new Date(view.year, view.month, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { date: d, key: ymd(d.getFullYear(), d.getMonth(), d.getDate()), inMonth: d.getMonth() === view.month };
    });
  }, [view]);

  const upcoming = useMemo(() => {
    const t = todayKey();
    return [...events]
      .filter((e) => e.date && e.date >= t)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 8);
  }, [events]);

  const step = (delta) =>
    setView((v) => {
      const m = v.month + delta;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  const today = todayKey();

  return (
    <>
      <DeptPageHeader
        icon={page.icon}
        eyebrow={config.branding.shortName}
        title={page.label}
        subtitle="Trainings, patrols and operations on the department's schedule."
        actions={
          canEdit && (
            <Button size="sm" onClick={() => setEditing(blankEvent())}>
              <Plus className="size-4" />
              Add event
            </Button>
          )
        }
      />

      {error && (
        <p className="mb-5 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-400/25">
          {error}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
            <h2 className="text-base font-bold text-white">
              {MONTHS[view.month]} {view.year}
            </h2>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView({ year: now.getFullYear(), month: now.getMonth() })}
              >
                Today
              </Button>
              <IconBtn label="Previous month" onClick={() => step(-1)}>
                <ChevronLeft className="size-4" />
              </IconBtn>
              <IconBtn label="Next month" onClick={() => step(1)}>
                <ChevronRight className="size-4" />
              </IconBtn>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-white/[0.06] text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              const dayEvents = byDay.get(cell.key) ?? [];
              const isToday = cell.key === today;
              return (
                <div
                  key={cell.key}
                  onClick={canEdit ? () => setEditing(blankEvent(cell.key)) : undefined}
                  className={[
                    "min-h-[92px] border-b border-r border-white/[0.05] p-1.5 transition",
                    i % 7 === 0 ? "border-l" : "",
                    cell.inMonth ? "" : "bg-black/20 opacity-55",
                    canEdit ? "cursor-pointer hover:bg-white/[0.02]" : "",
                  ].join(" ")}
                >
                  <div className="mb-1 flex justify-end">
                    <span
                      className={
                        isToday
                          ? "dept-accent-bg grid size-6 place-items-center rounded-full text-xs font-bold text-white"
                          : "px-1 text-xs font-semibold text-slate-400"
                      }
                    >
                      {cell.date.getDate()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewing(event);
                        }}
                        className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-semibold text-white"
                        style={{ backgroundColor: `color-mix(in srgb, ${KIND_COLOR[event.kind] || "#64748b"} 30%, transparent)` }}
                        title={`${event.title}${event.time ? ` · ${event.time}` : ""}`}
                      >
                        {event.time ? `${event.time} ` : ""}
                        {event.title || "Event"}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="px-1 text-[10px] text-slate-500">+{dayEvents.length - 3} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <aside>
          <Card className="p-4">
            <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              <CalendarDays className="size-4" />
              Upcoming events
            </h2>
            {upcoming.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">Nothing scheduled ahead.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((event) => {
                  const count = (attendance[event.id] ?? []).length;
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => setViewing(event)}
                        className="hub-card-hover flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left"
                      >
                        <span
                          className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg text-white"
                          style={{ backgroundColor: `color-mix(in srgb, ${KIND_COLOR[event.kind] || "#64748b"} 28%, transparent)` }}
                        >
                          <span className="text-[9px] font-bold uppercase leading-none">
                            {prettyDate(event.date).split(" ")[0]}
                          </span>
                          <span className="text-sm font-black leading-tight">
                            {prettyDate(event.date).split(" ")[1]}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white">
                            {event.title || "Event"}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {event.time || event.kind}
                            {count > 0 ? ` · ${count} attending` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      {viewing && (
        <EventDetail
          event={viewing}
          canEdit={canEdit}
          attendees={attendance[viewing.id] ?? []}
          attending={(attendance[viewing.id] ?? []).some((a) => a.discordId === user?.id)}
          signedIn={!!user?.id}
          onToggleAttend={() => toggleAttend(viewing)}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
          onClose={() => setViewing(null)}
        />
      )}

      {editing && (
        <EventEditor
          key={editing.id}
          event={editing}
          onClose={() => setEditing(null)}
          onSubmit={submit}
          onDelete={() => setConfirming(editing)}
        />
      )}

      {confirming && (
        <Modal open onClose={() => setConfirming(null)} title="Delete this event?">
          <p className="text-sm text-slate-400">
            “{confirming.title || "This event"}” and its attendee list will be removed.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={() => remove(confirming)}>
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function IconBtn({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-8 place-items-center rounded-lg text-slate-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-white"
    >
      {children}
    </button>
  );
}

/** The event detail: info, the Attend toggle, and the attendee list. */
function EventDetail({ event, canEdit, attendees, attending, signedIn, onToggleAttend, onEdit, onClose }) {
  const color = KIND_COLOR[event.kind] || "#64748b";
  return (
    <Modal open onClose={onClose} title={event.title || "Event"} className="max-w-lg">
      <dl className="space-y-3 text-sm">
        <Row label="When">
          {prettyDate(event.date)}
          {event.time ? ` · ${event.time}` : ""}
        </Row>
        <Row label="Type">
          <span
            className="rounded-md px-2 py-0.5 text-xs font-bold"
            style={{ backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`, color }}
          >
            {event.kind}
          </span>
        </Row>
        {event.host && <Row label="Host">{event.host}</Row>}
        {event.details && (
          <Row label="Details">
            <span className="whitespace-pre-line">{event.details}</span>
          </Row>
        )}
      </dl>

      <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            <Users className="size-4" />
            Attendees ({attendees.length})
          </h3>
          {signedIn && (
            <Button
              size="sm"
              variant={attending ? "secondary" : "primary"}
              onClick={onToggleAttend}
            >
              {attending ? (
                <>
                  <Check className="size-4" />
                  Attending
                </>
              ) : (
                <>
                  <UserPlus className="size-4" />
                  Attend
                </>
              )}
            </Button>
          )}
        </div>

        {attendees.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No one has said they're attending yet.</p>
        ) : (
          <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
            {attendees.map((a) => (
              <li
                key={a.discordId}
                className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2"
              >
                <span className="truncate text-sm font-semibold text-white">{a.name}</span>
                <code className="shrink-0 font-mono text-[11px] text-slate-500">{a.discordId}</code>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit && (
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Edit event
          </Button>
        </div>
      )}
    </Modal>
  );
}

/** Add/edit dialog for one event (editors only). */
function EventEditor({ event, onClose, onSubmit, onDelete }) {
  const [draft, setDraft] = useState(event);
  const set = (changes) => setDraft((c) => ({ ...c, ...changes }));

  return (
    <Modal open onClose={onClose} title={event.title ? `Edit "${event.title}"` : "Add event"}>
      <div className="space-y-4">
        <Field label="Event" htmlFor="ev-title">
          <TextInput id="ev-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="ev-date">
            <TextInput id="ev-date" type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label="Time" htmlFor="ev-time" hint="Local time, e.g. 8:00 PM EST.">
            <TextInput id="ev-time" value={draft.time} onChange={(e) => set({ time: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="ev-kind">
            <Select id="ev-kind" value={draft.kind} onChange={(next) => set({ kind: next })} options={KINDS} />
          </Field>
          <Field label="Host" htmlFor="ev-host">
            <TextInput id="ev-host" value={draft.host} onChange={(e) => set({ host: e.target.value })} />
          </Field>
        </div>
        <Field label="Details" htmlFor="ev-details">
          <TextArea id="ev-details" rows={3} value={draft.details} onChange={(e) => set({ details: e.target.value })} />
        </Field>
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        {event.title ? (
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-rose-300 hover:text-rose-200">
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={!draft.title.trim() || !draft.date} onClick={() => onSubmit(draft)}>
            Save event
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex gap-3">
      <dt className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-slate-300">{children}</dd>
    </div>
  );
}
