import { Link } from "react-router-dom";
import { Activity, ArrowRight, ShieldAlert, Users } from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import BotError from "../../../components/bot/BotError";
import Loading from "../../../components/bot/Loading";
import { useBotResource } from "../../../lib/useBotResource";
import { useBotAuth } from "../../../context/useBotAuth";
import { severityTone } from "../../../lib/botStatus";

/**
 * The dashboard's front page: what needs attention, and what this account can
 * reach.
 *
 * Sync issues lead because they are the only thing here that represents work
 * outstanding — the bot reporting something it could not do. Everything else is
 * configuration that is fine until somebody changes it.
 */
export default function BotOverview() {
  const { capabilities } = useBotAuth();
  const health = useBotResource("/system/health");
  const issues = useBotResource("/sync/issues?pageSize=5");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile
          to="/management/bot/sync"
          icon={<ShieldAlert className="size-5" />}
          label="Open sync issues"
          value={issues.loading ? "—" : (issues.data?.pagination?.total ?? 0)}
          tone={issues.data?.pagination?.total ? "amber" : "green"}
        />
        <Tile
          to="/management/bot/rosters"
          icon={<Users className="size-5" />}
          label="Rosters"
          value=""
          hint="Published staff lists"
        />
        <Tile
          to="/management/bot/audit"
          icon={<Activity className="size-5" />}
          label="Audit log"
          value=""
          hint="Every change, with request IDs"
        />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
          Needs attention
        </h2>
        {issues.error ? (
          <BotError error={issues.error} onRetry={issues.reload} />
        ) : issues.loading ? (
          <Loading rows={2} />
        ) : (issues.data?.items ?? []).length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-slate-400">
              Nothing outstanding — the bot has applied everything it was asked to.
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-white/[0.06]">
            {issues.data.items.map((issue) => (
              <div key={issue.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                <Badge tone={severityTone(issue.severity)}>{issue.severity}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-300">{issue.message}</p>
                  <p className="mt-1 text-xs text-slate-500">{issue.type}</p>
                </div>
              </div>
            ))}
            <Link
              to="/management/bot/sync"
              className="flex items-center gap-1.5 px-5 py-3 text-xs font-semibold text-primary-400 transition hover:gap-2.5"
            >
              All sync issues
              <ArrowRight className="size-3.5" />
            </Link>
          </Card>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
            Bot health
          </h2>
          {health.error ? (
            <BotError error={health.error} onRetry={health.reload} />
          ) : health.loading ? (
            <Loading rows={1} />
          ) : (
            <Card className="p-5">
              <dl className="space-y-3">
                {Object.entries(health.data ?? {}).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {healthLabel(key)}
                    </dt>
                    <dd className="mt-1 text-sm text-slate-300">{healthValue(value)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
            What you can do
          </h2>
          <Card className="p-5">
            {capabilities.length === 0 ? (
              <p className="text-sm text-slate-400">
                You hold no capabilities, so most of this dashboard will be read-only.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {capabilities.map((entry) => (
                  <li
                    key={`${entry.capability}-${entry.scopeType}-${entry.scopeId ?? "global"}`}
                  >
                    <Badge tone="slate">
                      {entry.capability}
                      {entry.scopeType && entry.scopeType !== "GLOBAL" && (
                        <span className="ml-1 opacity-70">· {entry.scopeType.toLowerCase()}</span>
                      )}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              This list decides what the dashboard offers you. It is not what decides
              whether an action succeeds — the API checks every call itself.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}


/** "checkedInMs" -> "Checked In Ms". */
function healthLabel(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/** A single leaf value, compact. */
function healthLeaf(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value !== "object") return String(value);
  return JSON.stringify(value);
}

/**
 * Renders a health field. The bot returns nested objects (database, redis,
 * counts, queues…); rather than dumping JSON, each object becomes a row of
 * `key value` chips so the card reads at a glance.
 */
function healthValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.length ? value.map(healthLeaf).join(", ") : "none";
  const entries = Object.entries(value);
  if (entries.length === 0) return "none";
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-slate-400">
      {entries.map(([k, v]) => (
        <span key={k}>
          <span className="text-slate-500">{k}</span> {healthLeaf(v)}
        </span>
      ))}
    </div>
  );
}

function Tile({ to, icon, label, value, hint, tone = "slate" }) {
  const tones = {
    green: "text-emerald-400",
    amber: "text-amber-400",
    slate: "text-primary-400",
  };
  return (
    <Card as={Link} to={to} hover className="group flex items-center gap-4 p-5">
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] ${tones[tone]}`}>
        {icon}
      </span>
      <div className="min-w-0">
        {value !== "" && (
          <div className="text-2xl font-extrabold tracking-tight text-white">{value}</div>
        )}
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </div>
        {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
      </div>
      <ArrowRight className="ml-auto size-4 shrink-0 text-slate-600 transition group-hover:text-slate-400" />
    </Card>
  );
}
