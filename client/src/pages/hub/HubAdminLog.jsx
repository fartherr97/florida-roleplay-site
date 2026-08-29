import { useEffect, useMemo, useState } from "react";
import { Archive, Loader2, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import { useAuth } from "../../context/useAuth";
import { api } from "../../lib/api";
import { cn } from "../../lib/cn";
import {
  STAFF_LOG_TYPES,
  SNOWFLAKE,
  isTerminalType,
  logTypeColor,
  logTypeLabel,
} from "../../lib/staffLog";

const TYPE_OPTIONS = [
  { value: "all", label: "Every type" },
  ...STAFF_LOG_TYPES.map((t) => ({ value: t.id, label: t.label })),
];

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** A colour-coded badge for a log type. */
function TypePill({ type, muted }) {
  const color = logTypeColor(type);
  return (
    <span
      className={cn("inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-[11px] font-bold", muted && "opacity-50")}
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      {logTypeLabel(type)}
    </span>
  );
}

/**
 * The Staff Admin Log — the staff team's internal record kept ON its members.
 *
 * Resignations, LOAs, strikes and terminations, filed against a staff member by
 * name and Discord ID. This is NOT the disciplinary database — nothing here
 * reaches anyone's background check; it is the team's own ledger, open only to
 * Senior Admins and up. Search a member (including a former one) to read their
 * internal profile, and a termination archives what we knew about them so the
 * record survives their roster row being cleared.
 */
export default function HubAdminLog() {
  const { user } = useAuth();
  const [entries, setEntries] = useState(null);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [profileId, setProfileId] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    let active = true;
    api.staffLog().then((r) => active && setEntries(Array.isArray(r?.entries) ? r.entries : []));
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const list = entries ?? [];
    const by = (id) => list.filter((e) => e.type === id).length;
    return {
      total: list.length,
      loa: by("loa"),
      strike: by("strike"),
      resignation: by("resignation"),
      terminated: list.filter((e) => isTerminalType(e.type)).length,
    };
  }, [entries]);

  const visible = useMemo(() => {
    let list = entries ?? [];
    if (typeFilter !== "all") list = list.filter((e) => e.type === typeFilter);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (e) =>
          (e.targetName || "").toLowerCase().includes(needle) ||
          (e.targetDiscordId || "").includes(q.trim()) ||
          (e.note || "").toLowerCase().includes(needle) ||
          logTypeLabel(e.type).toLowerCase().includes(needle) ||
          (e.loggedByName || "").toLowerCase().includes(needle),
      );
    }
    return list;
  }, [entries, typeFilter, q]);

  async function fileEntry(draft) {
    const res = await api.fileStaffLog(draft);
    if (res?.ok && res.entry) {
      setEntries((cur) => [res.entry, ...(cur ?? [])]);
      setShowNew(false);
    }
    return res;
  }

  async function removeEntry(entry) {
    const res = await api.deleteStaffLog(entry.id);
    if (res?.ok) setEntries((cur) => (cur ?? []).filter((e) => e.id !== entry.id));
    setConfirmDel(null);
  }

  return (
    <div>
      <HubPageHeader
        icon="ClipboardList"
        eyebrow="Staff Hub"
        title="Admin Logs"
        subtitle="The staff team's own record — resignations, LOAs, strikes and terminations kept on staff members. Internal only; nothing here touches a background check."
        actions={
          <div className="flex items-center gap-3">
            <Badge tone="rose">Senior Admins+ · internal</Badge>
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus className="size-4" />
              Log entry
            </Button>
          </div>
        }
      />

      {/* Statistics */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatBox label="All entries" value={stats.total} />
        <StatBox label="Resignations" value={stats.resignation} color="#f97316" />
        <StatBox label="On LOA logs" value={stats.loa} color="#f59e0b" />
        <StatBox label="Strikes" value={stats.strike} color="#f43f5e" />
        <StatBox label="Terminated" value={stats.terminated} color="#ef4444" />
      </div>

      {/* Search + filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <TextInput
            value={q}
            placeholder="Search a member, Discord ID, type or note…"
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-44">
          <Select value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} />
        </div>
      </div>

      {entries === null ? (
        <Card className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Loading the log…
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500">
          {q || typeFilter !== "all" ? "Nothing matches." : "Nothing logged yet. Log the first entry above."}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5 font-semibold">Staff member</th>
                  <th className="px-4 py-2.5 font-semibold">Rank</th>
                  <th className="px-4 py-2.5 font-semibold">Note</th>
                  <th className="px-4 py-2.5 font-semibold">Logged by</th>
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => (
                  <tr key={e.id} className="border-t border-white/5 align-top transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <TypePill type={e.type} />
                      {e.archived && (
                        <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                          <Archive size={11} /> Archived
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setProfileId(e.targetDiscordId)}
                        className="text-left font-semibold leading-tight text-white hover:text-primary-300"
                        title="Open internal profile"
                      >
                        {e.targetName || "—"}
                      </button>
                      {e.targetDiscordId && (
                        <div className="mt-0.5 font-mono text-[11px] text-slate-500">{e.targetDiscordId}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-300">{e.targetRank || "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-200">
                      {e.note ? (
                        <span className="block max-w-md whitespace-pre-line">{e.note}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                      {(e.effectiveAt || e.expiresAt) && (
                        <span className="mt-1 block text-[11px] text-slate-500">
                          {e.effectiveAt && `From ${fmtDate(e.effectiveAt)}`}
                          {e.effectiveAt && e.expiresAt && " · "}
                          {e.expiresAt && `Until ${fmtDate(e.expiresAt)}`}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-300">{e.loggedByName || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-400">{fmtDate(e.createdAt)}</td>
                    <td className="px-2 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setConfirmDel(e)}
                        aria-label="Delete entry"
                        title="Delete entry"
                        className="grid size-7 place-items-center rounded-lg text-slate-500 ring-1 ring-inset ring-white/10 transition hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showNew && (
        <NewEntryModal user={user} onClose={() => setShowNew(false)} onFile={fileEntry} />
      )}
      {profileId && <ProfileModal discordId={profileId} onClose={() => setProfileId(null)} />}
      {confirmDel && (
        <Modal open onClose={() => setConfirmDel(null)} title="Delete this entry?" className="max-w-md">
          <p className="text-sm text-slate-300">
            Delete the “{logTypeLabel(confirmDel.type)}” entry about {confirmDel.targetName || "this member"}? This
            can't be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmDel(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={() => removeEntry(confirmDel)}>
              Delete entry
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <Card className="p-4" style={{ borderLeft: `3px solid ${color || "var(--color-primary)"}` }}>
      <div className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-0.5 text-3xl font-black tabular-nums" style={{ color: color || "var(--color-primary)" }}>
        {value}
      </div>
    </Card>
  );
}

/* ─── New entry ─────────────────────────────────────────────────────────────── */

function NewEntryModal({ user, onClose, onFile }) {
  const [draft, setDraft] = useState({
    type: "note",
    targetName: "",
    targetDiscordId: "",
    targetRank: "",
    note: "",
    effectiveAt: "",
    expiresAt: "",
  });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const terminal = isTerminalType(draft.type);
  const isLoa = draft.type === "loa";
  const valid = draft.type && draft.targetName.trim() && SNOWFLAKE.test(draft.targetDiscordId.trim());

  async function submit() {
    setBusy(true);
    setErrors({});
    const res = await onFile({
      ...draft,
      targetName: draft.targetName.trim(),
      targetDiscordId: draft.targetDiscordId.trim(),
      targetRank: draft.targetRank.trim(),
      effectiveAt: draft.effectiveAt || null,
      expiresAt: draft.expiresAt || null,
    });
    setBusy(false);
    if (res && !res.ok) setErrors(res.errors ?? { _: res.message ?? "Could not log it." });
  }

  return (
    <Modal open onClose={onClose} title="Log an entry" className="max-w-xl">
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Entry type">
            <Select
              value={draft.type}
              onChange={(v) => set({ type: v })}
              options={STAFF_LOG_TYPES.map((t) => ({ value: t.id, label: t.label }))}
            />
          </Field>
          <Field label="Rank at the time" hint="Optional.">
            <TextInput value={draft.targetRank} placeholder="Senior Moderator" onChange={(e) => set({ targetRank: e.target.value })} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Staff member" error={errors.targetName}>
            <TextInput value={draft.targetName} placeholder="J. Doe" onChange={(e) => set({ targetName: e.target.value })} />
          </Field>
          <Field label="Discord ID" required hint="Ties the entry to the right person." error={errors.targetDiscordId}>
            <TextInput
              value={draft.targetDiscordId}
              placeholder="000000000000000000"
              className="font-mono"
              onChange={(e) => set({ targetDiscordId: e.target.value.trim() })}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={isLoa ? "LOA starts" : "Effective date"} hint="Optional.">
            <TextInput type="date" value={draft.effectiveAt} onChange={(e) => set({ effectiveAt: e.target.value })} />
          </Field>
          {isLoa && (
            <Field label="LOA ends" hint="Optional.">
              <TextInput type="date" value={draft.expiresAt} onChange={(e) => set({ expiresAt: e.target.value })} />
            </Field>
          )}
        </div>

        <Field label="Note" hint="What happened — this is the record.">
          <TextArea rows={3} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
        </Field>

        {terminal && (
          <p className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200/90">
            Logging a {logTypeLabel(draft.type).toLowerCase()} archives this member — their name, rank and ID are
            snapshotted onto the record so it survives their roster row being cleared.
          </p>
        )}
        {errors._ && <p className="text-sm text-rose-300">{errors._}</p>}
        <p className="text-xs text-slate-500">
          Filing as {user?.displayName || user?.username || "you"}. Internal record only — this never reaches a
          background check.
        </p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={!valid || busy} onClick={submit}>
          {busy ? "Logging…" : "Log entry"}
        </Button>
      </div>
    </Modal>
  );
}

/* ─── Internal profile ──────────────────────────────────────────────────────── */

function ProfileModal({ discordId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.staffLogProfile(discordId).then((r) => {
      if (!active) return;
      setProfile(r?.profile ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [discordId]);

  return (
    <Modal open onClose={onClose} title="Internal profile" className="max-w-xl">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : !profile || profile.total === 0 ? (
        <div className="py-8 text-center">
          <UserRound className="mx-auto size-9 text-slate-600" strokeWidth={1.25} />
          <p className="mt-2 text-sm text-slate-400">Nothing on record for this member.</p>
          <p className="mt-1 font-mono text-xs text-slate-600">{discordId}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/5 text-sm font-bold text-slate-300">
              {(profile.name || "?").slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-base font-bold text-white">
                {profile.name || "Unknown"}
                {profile.archived && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold text-rose-300">
                    <Archive size={11} /> Archived
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                {profile.rank ? `${profile.rank} · ` : ""}
                <span className="font-mono">{profile.discordId}</span> · {profile.total} entr{profile.total === 1 ? "y" : "ies"}
              </p>
            </div>
          </div>

          {profile.archived && profile.snapshot && (
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/[0.07] p-3 text-xs text-slate-300">
              <p className="mb-1 font-bold uppercase tracking-[0.12em] text-rose-300/80">Archived at termination</p>
              <div className="grid gap-0.5">
                <span>Name: {profile.snapshot.name || "—"}</span>
                <span>Rank: {profile.snapshot.rank || "—"}</span>
                <span>Archived: {fmtDate(profile.snapshot.archivedAt)} by {profile.snapshot.by || "—"}</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {Object.entries(profile.counts).map(([type, n]) => (
              <span key={type} className="inline-flex items-center gap-1.5">
                <TypePill type={type} />
                <span className="text-xs font-bold text-slate-400">×{n}</span>
              </span>
            ))}
          </div>

          <ul className="space-y-1.5">
            {profile.entries.map((e) => (
              <li key={e.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <TypePill type={e.type} />
                  {e.targetRank && <span className="text-xs text-slate-400">{e.targetRank}</span>}
                  <span className="ml-auto text-[11px] text-slate-500">{fmtDate(e.createdAt)}</span>
                </div>
                {e.note && <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{e.note}</p>}
                <p className="mt-1 text-[11px] text-slate-500">Logged by {e.loggedByName || "—"}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="size-4" /> Close
        </Button>
      </div>
    </Modal>
  );
}
