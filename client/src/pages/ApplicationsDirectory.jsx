import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Lock,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Section from "../components/layout/Section";
import PageHeader from "../components/layout/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Field from "../components/ui/Field";
import Select from "../components/ui/Select";
import Modal from "../components/ui/Modal";
import { TextInput, TextArea } from "../components/ui/TextInput";
import { useAuth } from "../context/useAuth";
import { api } from "../lib/api";

/**
 * The public Applications page — a directory of every department and where its
 * recruitment currently stands.
 *
 * Anyone can read it and hit Apply Now (which sends them to the department's
 * external application link). Department Heads, Directorship and Ownership set
 * each department's status — Open, Closed, or Open Interviews with a close date
 * — via applications.manage. Ownership adds and removes departments and edits
 * the crest and Apply Now links via applications.admin.
 */

const STATUS_META = {
  open: { tone: "green", icon: CheckCircle2, glow: "#22c55e" },
  interviews: { tone: "amber", icon: Clock, glow: "#f59e0b" },
  closed: { tone: "rose", icon: Lock, glow: "#ef4444" },
};

/** "November 4, 2026" for a YYYY-MM-DD string, in a timezone-stable way. */
function formatUntil(value) {
  if (!value) return "";
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

const EMPTY_DRAFT = { name: "", shortName: "", accent: "", blurb: "", logoUrl: "", backdropUrl: "", applyUrl: "" };

export default function ApplicationsDirectory() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("applications.manage");
  const canAdmin = hasPermission("applications.admin");

  const [departments, setDepartments] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // The department being edited/created in the modal: null (closed), an id, or
  // the sentinel "new".
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.recruitment().then((res) => {
      if (!active) return;
      setDepartments(res?.departments ?? []);
      setStatuses(res?.statuses ?? []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  const flashTimer = useRef(null);
  const flash = useCallback((msg) => {
    setNotice(msg);
    setError("");
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setNotice(""), 3200);
  }, []);

  const statusOptions = useMemo(
    () => statuses.map((s) => ({ value: s.id, label: s.label })),
    [statuses],
  );
  const statusLabel = useCallback(
    (id) => statuses.find((s) => s.id === id)?.label ?? id,
    [statuses],
  );

  const openCount = useMemo(
    () => departments.filter((d) => d.status !== "closed").length,
    [departments],
  );

  /* ------------------------------------------------ manage: status + date */

  async function saveStatus(dept, next) {
    const payload = {
      status: next.status ?? dept.status,
      interviewsUntil: next.interviewsUntil ?? dept.interviewsUntil ?? "",
    };
    // Only Open Interviews carries a date.
    if (payload.status !== "interviews") payload.interviewsUntil = "";
    const res = await api.setRecruitmentStatus(dept.id, payload).catch((e) => ({
      ok: false,
      message: e?.message || "Couldn't update that department.",
    }));
    if (res?.ok) {
      flash(`${dept.shortName || dept.name} set to ${statusLabel(payload.status)}.`);
      refresh();
    } else {
      setError(res?.message || "Couldn't update that department.");
    }
  }

  /* --------------------------------------------- admin: add / edit / remove */

  function openNew() {
    setDraft(EMPTY_DRAFT);
    setEditing("new");
  }
  function openEdit(dept) {
    setDraft({
      name: dept.name,
      shortName: dept.shortName,
      accent: dept.accent,
      blurb: dept.blurb,
      logoUrl: dept.logoUrl,
      backdropUrl: dept.backdropUrl,
      applyUrl: dept.applyUrl,
    });
    setEditing(dept.id);
  }

  async function saveDraft() {
    if (!draft.name.trim()) {
      setError("Give the department a name.");
      return;
    }
    setSaving(true);
    const res =
      editing === "new"
        ? await api.createRecruitmentDept(draft).catch((e) => ({ ok: false, message: e?.message }))
        : await api.updateRecruitmentDept(editing, draft).catch((e) => ({ ok: false, message: e?.message }));
    setSaving(false);
    if (res?.ok) {
      flash(editing === "new" ? "Department added." : "Department updated.");
      setEditing(null);
      refresh();
    } else {
      setError(res?.message || "Couldn't save that department.");
    }
  }

  async function removeDept(dept) {
    if (!window.confirm(`Remove ${dept.name} from the Applications page?`)) return;
    const res = await api.deleteRecruitmentDept(dept.id).catch((e) => ({ ok: false, message: e?.message }));
    if (res?.ok) {
      flash(`${dept.shortName || dept.name} removed.`);
      refresh();
    } else {
      setError(res?.message || "Couldn't remove that department.");
    }
  }

  return (
    <Section innerClassName="max-w-6xl">
      <PageHeader
        eyebrow="Join the community"
        title="Applications"
        subtitle={
          openCount > 0
            ? `${openCount} ${openCount === 1 ? "department is" : "departments are"} recruiting right now. Pick one and apply — most positions require a whitelist first.`
            : "Every department and where its recruitment stands. Check back soon — hiring opens up regularly."
        }
        backTo="/"
        actions={
          canAdmin && (
            <Button size="sm" variant="secondary" onClick={openNew}>
              <Plus className="size-4" />
              Add department
            </Button>
          )
        }
      />

      {notice && (
        <p className="mb-5 rounded-xl bg-green-500/10 px-4 py-3 text-sm font-medium text-green-300 ring-1 ring-inset ring-green-400/25">
          {notice}
        </p>
      )}
      {error && (
        <p className="mb-5 rounded-xl bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-300 ring-1 ring-inset ring-rose-400/25">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading departments…</p>
      ) : departments.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-slate-400">
            No departments are listed yet.
            {canAdmin && " Use “Add department” to create the first one."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => (
            <DepartmentCard
              key={dept.id}
              dept={dept}
              meta={STATUS_META[dept.status] ?? STATUS_META.closed}
              statusLabel={statusLabel(dept.status)}
              statusOptions={statusOptions}
              canManage={canManage}
              canAdmin={canAdmin}
              onSaveStatus={saveStatus}
              onEdit={openEdit}
              onRemove={removeDept}
            />
          ))}
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add department" : "Edit department"}
        subtitle="Shown on the public Applications page. The Apply Now link is where applicants are sent."
        className="max-w-lg"
      >
        <div className="space-y-4">
          <Field label="Department name" required>
            <TextInput
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Florida Highway Patrol"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Short name" hint="Card badge, e.g. FHP.">
              <TextInput
                value={draft.shortName}
                onChange={(e) => setDraft((d) => ({ ...d, shortName: e.target.value }))}
                placeholder="FHP"
              />
            </Field>
            <Field label="Accent color" hint="Any CSS color.">
              <TextInput
                value={draft.accent}
                onChange={(e) => setDraft((d) => ({ ...d, accent: e.target.value }))}
                placeholder="#d2b48c"
              />
            </Field>
          </div>
          <Field label="Logo / crest URL" hint="A full image URL. Leave blank to show the short-name badge instead.">
            <TextInput
              value={draft.logoUrl}
              onChange={(e) => setDraft((d) => ({ ...d, logoUrl: e.target.value }))}
              placeholder="https://www.flrp.us/images/…png"
            />
          </Field>
          <Field
            label="Background image URL"
            hint="An in-game screenshot works well — shown faded behind the card. Leave blank for none."
          >
            <TextInput
              value={draft.backdropUrl}
              onChange={(e) => setDraft((d) => ({ ...d, backdropUrl: e.target.value }))}
              placeholder="https://www.flrp.us/images/…jpg"
            />
          </Field>
          <Field label="Blurb" hint="A short line describing the department.">
            <TextArea
              rows={3}
              value={draft.blurb}
              onChange={(e) => setDraft((d) => ({ ...d, blurb: e.target.value }))}
              placeholder="State troopers covering the interstates across South Florida."
            />
          </Field>
          <Field
            label="Apply Now link"
            hint="A full http:// or https:// URL. Leave blank to hide the button."
          >
            <TextInput
              value={draft.applyUrl}
              onChange={(e) => setDraft((d) => ({ ...d, applyUrl: e.target.value }))}
              placeholder="https://flrp.sonoransoftware.com"
            />
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveDraft} disabled={saving}>
              {saving ? "Saving…" : editing === "new" ? "Add department" : "Save changes"}
            </Button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

/* ------------------------------------------------------------------ card */

function DepartmentCard({
  dept,
  meta,
  statusLabel,
  statusOptions,
  canManage,
  canAdmin,
  onSaveStatus,
  onEdit,
  onRemove,
}) {
  const status = dept.status;
  const open = status !== "closed";
  const applyable = open && Boolean(dept.applyUrl);
  const accent = dept.accent || "#f2800d";
  const StatusIcon = meta.icon;

  return (
    <Card
      className={`group relative flex flex-col overflow-hidden p-6 transition-colors ${
        open ? "" : "opacity-[0.92]"
      }`}
    >
      {/* Department screenshot, faded far back so it sets the mood without
          fighting the text. A scrim over it keeps everything readable. */}
      {dept.backdropUrl && (
        <>
          <img
            src={dept.backdropUrl}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="pointer-events-none absolute inset-0 size-full object-cover opacity-[0.22] transition-opacity duration-500 group-hover:opacity-30"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, color-mix(in srgb, var(--color-surface-1) 62%, transparent) 0%, color-mix(in srgb, var(--color-surface-1) 82%, transparent) 55%, color-mix(in srgb, var(--color-surface-1) 94%, transparent) 100%)",
            }}
          />
        </>
      )}

      {/* Accent wash bleeding down from the top edge, deepening on hover. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(115% 100% at 50% 0%, color-mix(in srgb, ${accent} 20%, transparent), transparent 72%)`,
        }}
      />
      {/* Thin accent hairline along the very top. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <span
          className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl ring-1 ring-inset transition-transform duration-500 group-hover:-translate-y-0.5"
          style={{
            backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
            "--tw-ring-color": `color-mix(in srgb, ${accent} 34%, transparent)`,
          }}
        >
          {dept.logoUrl ? (
            <img
              src={dept.logoUrl}
              alt={`${dept.shortName || dept.name} crest`}
              className="size-11 object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)]"
              loading="lazy"
            />
          ) : (
            <span className="text-base font-black uppercase tracking-wide" style={{ color: accent }}>
              {(dept.shortName || dept.name).slice(0, 3)}
            </span>
          )}
        </span>

        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ring-1 ring-inset"
          style={{
            color: meta.glow,
            backgroundColor: `color-mix(in srgb, ${meta.glow} 12%, transparent)`,
            "--tw-ring-color": `color-mix(in srgb, ${meta.glow} 30%, transparent)`,
          }}
        >
          <StatusIcon className="size-3.5" />
          {statusLabel}
        </span>
      </div>

      <h2 className="relative mt-5 text-lg font-black tracking-tight text-white">{dept.name}</h2>
      {dept.shortName && (
        <p className="relative mt-0.5 text-xs font-bold uppercase tracking-[0.16em]" style={{ color: accent }}>
          {dept.shortName}
        </p>
      )}
      {dept.blurb && (
        <p className="relative mt-3 flex-1 text-sm leading-relaxed text-slate-400">{dept.blurb}</p>
      )}

      {status === "interviews" && dept.interviewsUntil && (
        <p className="relative mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300 ring-1 ring-inset ring-amber-400/20">
          <CalendarClock className="size-3.5" />
          Interviews until {formatUntil(dept.interviewsUntil)}
        </p>
      )}

      <div className="relative mt-6">
        {applyable ? (
          <Button as="a" href={dept.applyUrl} target="_blank" rel="noreferrer" size="md" block>
            Apply Now
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        ) : (
          <div className="flex h-11 items-center justify-center rounded-xl bg-white/[0.03] text-xs font-semibold text-slate-500 ring-1 ring-inset ring-white/[0.06]">
            {open ? "Apply link coming soon" : "Not accepting applications"}
          </div>
        )}
      </div>

      {canManage && (
        <ManageControls dept={dept} statusOptions={statusOptions} onSave={onSaveStatus} />
      )}

      {canAdmin && (
        <div className="relative mt-3 flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(dept)}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onRemove(dept)} className="text-rose-300">
            <Trash2 className="size-3.5" />
            Remove
          </Button>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------------------- manage: status + until date */

function ManageControls({ dept, statusOptions, onSave }) {
  const [status, setStatus] = useState(dept.status);
  const [until, setUntil] = useState(dept.interviewsUntil ?? "");

  // Keep local state honest after a refresh replaces the dept object.
  useEffect(() => {
    setStatus(dept.status);
    setUntil(dept.interviewsUntil ?? "");
  }, [dept.status, dept.interviewsUntil]);

  const dirty = status !== dept.status || (until || "") !== (dept.interviewsUntil ?? "");

  return (
    <div className="relative mt-4 space-y-3 rounded-xl bg-black/20 p-3 ring-1 ring-inset ring-white/[0.06]">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
        Recruitment status
      </p>
      <Select value={status} onChange={setStatus} options={statusOptions} />
      {status === "interviews" && (
        <Field label="Interviews open until" className="!space-y-1.5">
          <TextInput type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </Field>
      )}
      <Button
        size="sm"
        block
        variant="secondary"
        disabled={!dirty}
        onClick={() => onSave(dept, { status, interviewsUntil: until })}
      >
        Save status
      </Button>
    </div>
  );
}
