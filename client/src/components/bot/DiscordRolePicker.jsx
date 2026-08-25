import { useState } from "react";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";
import BotError from "./BotError";
import Loading from "./Loading";
import Empty from "./Empty";
import { useBotResource } from "../../lib/useBotResource";
import { cn } from "../../lib/cn";

/**
 * Discord role picker, backed by GET /guilds/:guildId/discord-roles.
 *
 * Never make anyone paste a snowflake — this shows the guild's real roles,
 * highest-first in the order the API returns them, each with its colour. A role
 * the bot cannot assign (it outranks the bot, or another integration owns it)
 * is shown greyed with the reason rather than hidden, so it never just looks
 * missing. When the API reports `botHighestPosition: 0` it could not work out
 * assignability at all and everything comes back non-assignable, which is a
 * different message from "nothing is assignable".
 *
 * `guildId` is the platform guild id from GET /guilds, not the Discord
 * snowflake. `value` is the selected role's Discord id; `onChange` receives the
 * whole role object so the caller has its name to store alongside the id.
 */
export default function DiscordRolePicker({ guildId, value, onChange, disabled = false }) {
  // Requesting `?refresh=true` is a distinct path, so it drives useBotResource
  // rather than a second fetch — the hook already handles keying and aborts.
  const [refresh, setRefresh] = useState(false);
  const base = guildId ? `/guilds/${guildId}/discord-roles` : "";
  const path = refresh && base ? `${base}?refresh=true` : base;
  const res = useBotResource(path, { skip: !guildId });

  if (!guildId) {
    return <Empty title="Pick a server first">Choose a server to load its Discord roles.</Empty>;
  }
  if (res.error) return <BotError error={res.error} onRetry={res.reload} />;
  if (res.loading) return <Loading />;

  const roles = res.data?.roles ?? [];
  const undetermined = res.data?.botHighestPosition === 0;

  if (roles.length === 0) {
    return <Empty title="No roles">This server reported no roles the bot can see.</Empty>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {roles.length} role{roles.length === 1 ? "" : "s"}
          {res.data?.cachedAt && " · cached"}
        </p>
        <button
          type="button"
          onClick={() => {
            setRefresh(true);
            res.reload();
          }}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
        >
          <RefreshCw className="size-3.5" />
          Refresh from Discord
        </button>
      </div>

      {undetermined && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200 ring-1 ring-inset ring-amber-400/25">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          The bot couldn't determine which roles it can assign (it may be missing
          a role or permission), so every role is shown as unavailable.
        </p>
      )}

      <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl bg-black/20 p-1.5 ring-1 ring-inset ring-white/[0.06]">
        {roles.map((role) => {
          const selected = value && String(value) === String(role.id);
          const usable = role.assignable && !disabled;
          return (
            <button
              key={role.id}
              type="button"
              disabled={!usable}
              onClick={() => usable && onChange?.(role)}
              title={role.assignable ? undefined : reasonFor(undetermined)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition",
                selected
                  ? "bg-primary-500/15 ring-1 ring-inset ring-primary-400/30"
                  : usable
                    ? "hover:bg-white/[0.06]"
                    : "cursor-not-allowed opacity-45",
              )}
            >
              <span
                className="size-3 shrink-0 rounded-full ring-1 ring-inset ring-white/20"
                style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#64748b" }}
              />
              <span className="min-w-0 flex-1 truncate text-slate-200">{role.name}</span>
              {!role.assignable && (
                <span className="shrink-0 text-[11px] text-slate-500">unavailable</span>
              )}
              {selected && <Check className="size-4 shrink-0 text-primary-300" />}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Greyed-out roles can't be bound: the bot's own role must sit above them in
        Server Settings → Roles, or another integration owns the role.
      </p>
    </div>
  );
}

function reasonFor(undetermined) {
  return undetermined
    ? "The bot couldn't determine assignability."
    : "The bot's role must sit above this one in Server Settings → Roles.";
}
