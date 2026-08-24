import { useState } from "react";
import { Plus, X } from "lucide-react";
import Button from "../ui/Button";
import { TextInput } from "../ui/TextInput";
import { cn } from "../../lib/cn";
import { ROLE_MAP } from "../../data/rosterData";

/** Discord role id → the rank it is mapped to on this site, when it is mapped. */
const KNOWN = Object.fromEntries(
  ROLE_MAP.filter((role) => role.roleId).map((role) => [String(role.roleId), role.rankFull || role.rank]),
);

/**
 * A list of Discord role snowflakes.
 *
 * These are raw ids rather than the site's role keys on purpose: the bot
 * enforces them inside Discord, where a key means nothing. Where an id happens
 * to be one the Discord Role Mapping page already knows, the rank name is shown
 * beside it — that is the difference between reviewing a list of eighteen-digit
 * numbers and reviewing a list of ranks.
 */
export default function RoleIdInput({ label, hint, value = [], onChange, disabled = false }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  function add() {
    // Paste a whole block of ids and they all land — copying several out of
    // Discord at once is the normal case, not the exception.
    const candidates = draft.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean);
    if (!candidates.length) return;

    const bad = candidates.filter((v) => !/^\d{17,20}$/.test(v));
    if (bad.length) {
      setError(`Not a Discord role id: ${bad.slice(0, 2).join(", ")}${bad.length > 2 ? "…" : ""}`);
      return;
    }
    const next = [...new Set([...value, ...candidates])];
    setError("");
    setDraft("");
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      {hint && <p className="text-xs leading-relaxed text-slate-500">{hint}</p>}

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((id) => (
            <li
              key={id}
              className="flex items-center gap-2 rounded-xl bg-black/30 py-1.5 pl-3 pr-1.5 text-xs ring-1 ring-inset ring-white/[0.08]"
            >
              <span className="tabular-nums text-slate-300">{id}</span>
              {KNOWN[id] && <span className="text-brand-300">{KNOWN[id]}</span>}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((v) => v !== id))}
                aria-label={`Remove role ${id}`}
                className="grid size-5 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.08] hover:text-rose-300"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <TextInput
          value={draft}
          disabled={disabled}
          inputMode="numeric"
          placeholder="Paste one or more role IDs"
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className={cn("font-mono text-xs", error && "ring-rose-400/60")}
        />
        <Button type="button" variant="secondary" onClick={add} disabled={disabled || !draft.trim()}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
