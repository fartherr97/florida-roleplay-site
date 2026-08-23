import { useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, Gavel, Plus, X } from "lucide-react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import Field from "../ui/Field";
import Select from "../ui/Select";
import { TextArea, TextInput } from "../ui/TextInput";
import HubPageHeader from "../hub/HubPageHeader";
import { useAuth } from "../../context/useAuth";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import {
  CHOICES,
  DEFAULT_VOTE_HOURS,
  countdown,
  myBallot,
  statusMeta,
} from "../../lib/promotionBoard";
import { cn } from "../../lib/cn";

/**
 * The promotion board.
 *
 * Nothing here recomputes who may see a result. The API already stripped the
 * ballots and the tally from every vote the caller may not watch live, and sent
 * `resultsVisible` alongside — so this renders what it was given rather than
 * forming a second opinion that could disagree with the data it has.
 */
export default function PromotionBoard() {
  const { user, hasPermission } = useAuth();
  const [loaded, setLoaded] = useState({ key: null, votes: [], rules: [] });
  const [roles, setRoles] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [nominating, setNominating] = useState(false);
  const [filter, setFilter] = useState("open");
  const [notice, setNotice] = useState("");

  const canVote = hasPermission("promotions.vote");
  const canNominate = hasPermission("promotions.nominate");
  const canManage = hasPermission("promotions.manage");

  useEffect(() => {
    let active = true;
    Promise.all([api.promotions(), api.rosterRoleMap()]).then(([board, roleMap]) => {
      if (!active) return;
      setLoaded({ key: reloadKey, votes: board?.votes ?? [], rules: board?.rules ?? [] });
      setRoles(roleMap?.roles ?? []);
    });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const loading = loaded.key !== reloadKey;
  const votes = loading ? [] : loaded.votes;

  // A countdown that never moves reads as broken, so tick the whole board once a
  // minute — the resolution the countdown is rendered at.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  const rankLabel = useMemo(() => {
    const map = Object.fromEntries(roles.map((role) => [role.key, role.rankFull || role.rank]));
    return (key) => map[key] ?? key ?? "—";
  }, [roles]);

  const shown = useMemo(() => {
    const all = loading ? [] : loaded.votes;
    if (filter === "all") return all;
    if (filter === "open") return all.filter((vote) => vote.status === "pending");
    return all.filter((vote) => vote.status !== "pending");
  }, [filter, loading, loaded.votes]);

  const openCount = votes.filter((vote) => vote.status === "pending").length;

  const act = async (fn) => {
    const result = await fn();
    setNotice(result?.message ?? "");
    setReloadKey((key) => key + 1);
  };

  return (
    <>
      <HubPageHeader
        icon="Award"
        eyebrow="Staff Hub"
        title="Promotion Board"
        subtitle="Nominations and the vote behind them. Results stay hidden until a nomination is published, so ballots are cast on the merits rather than on how it is already going."
        actions={
          canNominate && (
            <Button size="sm" onClick={() => setNominating(true)}>
              <Plus className="size-4" />
              Nominate
            </Button>
          )
        }
      />

      {notice && (
        <p className="mb-5 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-inset ring-amber-400/25">
          {notice}
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl bg-white/[0.03] p-1 ring-1 ring-inset ring-white/[0.06]">
          {[
            { id: "open", label: `Open${openCount ? ` · ${openCount}` : ""}` },
            { id: "closed", label: "Concluded" },
            { id: "all", label: "All" },
          ].map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setFilter(entry.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                entry.id === filter ? "bg-primary-500 text-white" : "text-slate-400 hover:text-white",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {!canVote && (
          <p className="text-xs text-slate-500">
            You can read the board but not vote on it.
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((n) => (
            <div key={n} className="h-56 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <Card className="p-10 text-center">
          <Gavel className="mx-auto size-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">
            {filter === "open"
              ? "No nominations are open right now."
              : "Nothing here yet."}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {shown.map((vote) => (
            <VoteCard
              key={vote.id}
              vote={vote}
              user={user}
              rankLabel={rankLabel}
              canVote={canVote}
              canManage={canManage}
              onBallot={(choice, reason) => act(() => api.castBallot(vote.id, choice, reason))}
              onPublish={() => act(() => api.publishVote(vote.id))}
              onWithdraw={() => act(() => api.withdrawVote(vote.id))}
            />
          ))}
        </div>
      )}

      {canManage && !loading && (
        <VisibilityRules
          rules={loaded.rules}
          roles={roles}
          onSaved={(message) => {
            setNotice(message ?? "");
            setReloadKey((key) => key + 1);
          }}
        />
      )}

      {nominating && (
        <NominateDialog
          roles={roles}
          onClose={() => setNominating(false)}
          onSaved={(message) => {
            setNominating(false);
            setNotice(message ?? "");
            setReloadKey((key) => key + 1);
          }}
        />
      )}
    </>
  );
}

function VoteCard({ vote, user, rankLabel, canVote, canManage, onBallot, onPublish, onWithdraw }) {
  const meta = statusMeta(vote.status);
  const mine = myBallot(vote, user);
  const open = vote.status === "pending";
  const [reason, setReason] = useState(mine?.reason ?? "");
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-white">{vote.name}</h2>
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {rankLabel(vote.currentRoleKey)}
            <span className="mx-2 text-slate-600">→</span>
            <span className="font-semibold text-primary-400">{rankLabel(vote.proposedRoleKey)}</span>
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">{vote.reason}</p>
          <p className="mt-3 text-xs text-slate-500">
            Nominated by {vote.createdBy?.name ?? "Unknown"} · {formatDateTime(vote.createdAt)}
          </p>
        </div>

        <div className="shrink-0 text-right">
          {open ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Closes in
              </p>
              <p className="mt-1 text-lg font-extrabold tracking-tight text-white">
                {countdown(vote.closesAt)}
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500">Closed {formatDateTime(vote.closesAt)}</p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            {vote.turnout} vote{vote.turnout === 1 ? "" : "s"} cast
          </p>
        </div>
      </div>

      {/* The tally, when the caller may see it. */}
      {vote.resultsVisible && vote.tally ? (
        <div className="mt-5 border-t border-white/[0.06] pt-5">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-extrabold tracking-tight text-white">
              {vote.tally.approval}%
            </span>
            <span className="text-xs text-slate-500">
              approval of {vote.tally.decisive} decisive vote
              {vote.tally.decisive === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/[0.05]">
            {CHOICES.map((choice) => {
              const count = vote.tally[choice.id];
              const percent = vote.tally.total > 0 ? (count / vote.tally.total) * 100 : 0;
              return (
                <div
                  key={choice.id}
                  style={{ width: `${percent}%`, backgroundColor: choice.color }}
                  title={`${choice.label}: ${count}`}
                />
              );
            })}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1">
            {CHOICES.map((choice) => (
              <span key={choice.id} className="flex items-center gap-1.5 text-xs">
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: choice.color }}
                  aria-hidden="true"
                />
                <span className="text-slate-400">{choice.label}</span>
                <span className="font-bold text-white">{vote.tally[choice.id]}</span>
              </span>
            ))}
          </div>

          {vote.ballots.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-white"
              >
                {expanded ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                {expanded ? "Hide ballots" : `Show ${vote.ballots.length} ballots`}
              </button>
              {expanded && (
                <ul className="mt-3 space-y-1.5">
                  {vote.ballots.map((ballot) => {
                    const choice = CHOICES.find((entry) => entry.id === ballot.choice);
                    return (
                      <li
                        key={`${vote.id}-${ballot.voter?.discordId ?? ballot.voter?.name}`}
                        className="flex flex-wrap items-baseline gap-2 rounded-xl bg-white/[0.02] px-3 py-2 text-sm ring-1 ring-inset ring-white/[0.06]"
                      >
                        <span className="font-semibold text-white">
                          {ballot.voter?.name ?? "Unknown"}
                        </span>
                        <Badge tone={choice?.tone ?? "slate"}>{choice?.label ?? ballot.choice}</Badge>
                        {ballot.reason && (
                          <span className="min-w-0 flex-1 text-xs text-slate-400">
                            {ballot.reason}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      ) : (
        <p className="mt-5 flex items-center gap-2 border-t border-white/[0.06] pt-5 text-xs text-slate-500">
          <EyeOff className="size-3.5" />
          Results stay hidden until this nomination is published.
        </p>
      )}

      {/* Voting. */}
      {open && canVote && (
        <div className="mt-5 border-t border-white/[0.06] pt-5">
          <div className="flex flex-wrap items-center gap-2">
            {CHOICES.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => onBallot(choice.id, reason)}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-bold ring-1 ring-inset transition",
                  mine?.choice === choice.id
                    ? "text-white ring-transparent"
                    : "bg-white/[0.02] text-slate-300 ring-white/[0.06] hover:bg-white/[0.06]",
                )}
                style={
                  mine?.choice === choice.id ? { backgroundColor: choice.color } : undefined
                }
              >
                {mine?.choice === choice.id && <Check className="mr-1.5 inline size-4" />}
                {choice.label}
              </button>
            ))}
            {mine && (
              <span className="text-xs text-slate-500">
                You voted {CHOICES.find((c) => c.id === mine.choice)?.label.toLowerCase()}. You can
                change it until this closes.
              </span>
            )}
          </div>
          <TextInput
            className="mt-3 h-10"
            value={reason}
            placeholder="Optional — a line of reasoning, shown with your ballot"
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      )}

      {canManage && vote.status !== "cancelled" && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.06] pt-5">
          {!vote.published && !open && (
            <Button size="sm" onClick={onPublish}>
              Publish result
            </Button>
          )}
          {!vote.published && (
            <Button variant="ghost" size="sm" onClick={onWithdraw}>
              <X className="size-4" />
              Withdraw
            </Button>
          )}
          {open && (
            <p className="self-center text-xs text-slate-500">
              Publishing is available once the window closes.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function NominateDialog({ roles, onClose, onSaved }) {
  const [values, setValues] = useState({
    name: "",
    discordId: "",
    currentRoleKey: "",
    proposedRoleKey: "",
    reason: "",
    hours: DEFAULT_VOTE_HOURS,
  });
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  const options = useMemo(
    () =>
      [...roles]
        .sort((a, b) => (b.order ?? 0) - (a.order ?? 0))
        .map((role) => ({ value: role.key, label: `${role.rankFull || role.rank} — ${role.department}` })),
    [roles],
  );

  const set = (changes) => setValues((current) => ({ ...current, ...changes }));

  const submit = async (event) => {
    event.preventDefault();
    setErrors([]);
    setSaving(true);
    try {
      const result = await api.nominate(values);
      onSaved(result?.message);
    } catch (err) {
      setErrors(err?.errors ?? [err?.message ?? "That nomination was rejected."]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Open a nomination">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nominee" htmlFor="n-name" required>
          <TextInput id="n-name" value={values.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field
          label="Discord ID"
          htmlFor="n-discord"
          hint="Optional, but it is what ties the vote to the right person."
        >
          <TextInput
            id="n-discord"
            value={values.discordId}
            onChange={(e) => set({ discordId: e.target.value })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current rank" htmlFor="n-current">
            <Select
              id="n-current"
              value={values.currentRoleKey}
              onChange={(value) => set({ currentRoleKey: value })}
              options={options}
              placeholder="Choose a rank"
            />
          </Field>
          <Field label="Proposed rank" htmlFor="n-proposed" required>
            <Select
              id="n-proposed"
              value={values.proposedRoleKey}
              onChange={(value) => set({ proposedRoleKey: value })}
              options={options}
              placeholder="Choose a rank"
            />
          </Field>
        </div>

        <Field
          label="Reasoning"
          htmlFor="n-reason"
          required
          hint="People are voting on this — a sentence at minimum."
        >
          <TextArea
            id="n-reason"
            rows={4}
            value={values.reason}
            onChange={(e) => set({ reason: e.target.value })}
          />
        </Field>

        <Field label="Voting window" htmlFor="n-hours" hint="Hours. 1 to 336.">
          <TextInput
            id="n-hours"
            type="number"
            min={1}
            max={336}
            value={values.hours}
            onChange={(e) => set({ hours: Number(e.target.value) })}
            className="max-w-32"
          />
        </Field>

        {errors.length > 0 && (
          <ul className="space-y-1 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-400/25">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Opening…" : "Open the vote"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Who may watch a result before it is published. */
function VisibilityRules({ rules, roles, onSaved }) {
  const [draft, setDraft] = useState(rules ?? []);
  const [saving, setSaving] = useState(false);

  const options = useMemo(
    () =>
      [...roles]
        .sort((a, b) => (b.order ?? 0) - (a.order ?? 0))
        .map((role) => ({ value: role.key, label: role.rankFull || role.rank })),
    [roles],
  );

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.savePromotionRules(draft);
      onSaved(result?.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-6 p-6">
      <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-white">
        Live result visibility
      </h2>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-400">
        By default nobody sees a tally until the nomination is published — that is what stops
        ballots piling onto whichever way a vote is already going. A rule here lets a role watch
        live, up to a rank ceiling, so oversight does not have to mean seeing the vote on your own
        peers.
      </p>

      <div className="mt-4 space-y-2">
        {draft.map((rule, index) => (
          <div
            key={`${rule.roleKey}-${index}`}
            className="flex flex-wrap items-end gap-3 rounded-xl bg-white/[0.02] p-3 ring-1 ring-inset ring-white/[0.06]"
          >
            <Field label="Role" htmlFor={`r-${index}`} className="min-w-44 flex-1">
              <Select
                id={`r-${index}`}
                value={rule.roleKey}
                onChange={(value) =>
                  setDraft(draft.map((entry, i) => (i === index ? { ...entry, roleKey: value } : entry)))
                }
                options={options}
              />
            </Field>
            <Field
              label="May watch up to"
              htmlFor={`m-${index}`}
              className="min-w-44 flex-1"
              hint="Blank means every rank."
            >
              <Select
                id={`m-${index}`}
                value={rule.maxRoleKey}
                onChange={(value) =>
                  setDraft(
                    draft.map((entry, i) => (i === index ? { ...entry, maxRoleKey: value } : entry)),
                  )
                }
                options={[{ value: "", label: "Every rank" }, ...options]}
              />
            </Field>
            <button
              type="button"
              onClick={() => setDraft(draft.filter((_, i) => i !== index))}
              aria-label="Remove rule"
              className="mb-2 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDraft([...draft, { roleKey: options[0]?.value ?? "", maxRoleKey: "" }])}
        >
          <Plus className="size-4" />
          Add a rule
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save rules"}
        </Button>
      </div>
    </Card>
  );
}
