import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import Field from "../../../components/ui/Field";
import Select from "../../../components/ui/Select";
import { TextInput } from "../../../components/ui/TextInput";
import BotError from "../../../components/bot/BotError";
import Loading from "../../../components/bot/Loading";
import Empty from "../../../components/bot/Empty";
import Paginator from "../../../components/bot/Paginator";
import { useBotResource } from "../../../lib/useBotResource";
import { api, query } from "../../../lib/botApi";
import { cn } from "../../../lib/cn";

/**
 * Who holds which capability.
 *
 * Both halves of this screen are built from `GET /permissions/capabilities`
 * rather than a list in the frontend: the catalogue carries each capability's
 * category, description, allowed scopes, danger flag and minimum authority
 * level, and hard-coding any of that means it drifts the moment the bot adds a
 * capability. The grant form's scope options come from the catalogue too, so a
 * capability that only makes sense globally cannot be offered per-guild.
 */
export default function BotPermissions() {
  const [page, setPage] = useState(1);
  const catalogue = useBotResource("/permissions/capabilities");
  const assignments = useBotResource(`/permissions${query({ page, pageSize: 25 })}`);
  const [granting, setGranting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const capabilities = useMemo(() => {
    const list = catalogue.data?.items ?? catalogue.data?.capabilities ?? catalogue.data;
    return Array.isArray(list) ? list : [];
  }, [catalogue.data]);

  const byKey = useMemo(
    () => Object.fromEntries(capabilities.map((c) => [c.key, c])),
    [capabilities],
  );

  const revoke = async (assignmentId) => {
    setActionError(null);
    try {
      await api(`/permissions/${encodeURIComponent(assignmentId)}`, { method: "DELETE" });
      assignments.reload();
    } catch (err) {
      setActionError(err);
    }
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-400">
          Capabilities are granted to people, optionally scoped. The API checks every
          call itself — this screen decides what is offered, not what is allowed.
        </p>
        <Button
          size="sm"
          className="ml-auto"
          disabled={capabilities.length === 0}
          onClick={() => setGranting(true)}
        >
          <Plus className="size-4" />
          Grant
        </Button>
      </div>

      {actionError && <BotError error={actionError} className="mb-5" />}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
          Assignments
        </h2>
        {assignments.error ? (
          <BotError error={assignments.error} onRetry={assignments.reload} />
        ) : assignments.loading ? (
          <Loading rows={3} />
        ) : (assignments.data?.items ?? []).length === 0 ? (
          <Empty title="Nothing granted yet">
            Everyone is working from whatever their access tier gives them.
          </Empty>
        ) : (
          <>
            <Card className="divide-y divide-white/[0.06]">
              {assignments.data.items.map((entry) => {
                const definition = byKey[entry.capability];
                return (
                  <div
                    key={entry.id ?? entry.assignmentId}
                    className="flex flex-wrap items-center gap-3 px-5 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="text-sm font-semibold text-white">
                          {entry.capability}
                        </code>
                        {definition?.dangerous && (
                          <Badge tone="rose">
                            <AlertTriangle className="size-3" />
                            Dangerous
                          </Badge>
                        )}
                        {entry.scopeType && entry.scopeType !== "GLOBAL" && (
                          <Badge tone="slate">
                            {entry.scopeType.toLowerCase()}
                            {entry.scopeId ? ` · ${entry.scopeId}` : ""}
                          </Badge>
                        )}
                      </div>
                      {definition?.description && (
                        <p className="mt-1 text-sm text-slate-400">{definition.description}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-500">
                        {entry.subjectName ??
                          entry.discordUserId ??
                          entry.subjectId ??
                          "Unknown holder"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => revoke(entry.id ?? entry.assignmentId)}
                      aria-label={`Revoke ${entry.capability}`}
                      className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                );
              })}
            </Card>
            <Paginator
              pagination={assignments.data.pagination}
              onPage={setPage}
              className="mt-4"
            />
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
          Capability catalogue
        </h2>
        {catalogue.error ? (
          <BotError error={catalogue.error} onRetry={catalogue.reload} />
        ) : catalogue.loading ? (
          <Loading rows={3} />
        ) : (
          <Catalogue capabilities={capabilities} />
        )}
      </section>

      {granting && (
        <GrantDialog
          capabilities={capabilities}
          onClose={() => setGranting(false)}
          onGranted={() => {
            setGranting(false);
            assignments.reload();
          }}
        />
      )}
    </>
  );
}

/** Grouped by the catalogue's own `category`, in the order it returned them. */
function Catalogue({ capabilities }) {
  const groups = useMemo(() => {
    const map = new Map();
    capabilities.forEach((capability) => {
      const key = capability.category ?? "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(capability);
    });
    return [...map.entries()];
  }, [capabilities]);

  if (groups.length === 0) {
    return <Empty title="The catalogue is empty">The bot reported no capabilities.</Empty>;
  }

  return (
    <div className="space-y-4">
      {groups.map(([category, entries]) => (
        <Card key={category} className="overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              {category}
            </h3>
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {entries.map((capability) => (
              <li key={capability.key} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <code
                    className={cn(
                      "text-sm font-semibold",
                      capability.dangerous ? "text-rose-300" : "text-white",
                    )}
                  >
                    {capability.key}
                  </code>
                  {capability.dangerous && (
                    <Badge tone="rose">
                      <AlertTriangle className="size-3" />
                      Dangerous
                    </Badge>
                  )}
                  {typeof capability.minLevel === "number" && (
                    <Badge tone="slate">Level {capability.minLevel}+</Badge>
                  )}
                </div>
                {capability.description && (
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                    {capability.description}
                  </p>
                )}
                {(capability.scopes ?? capability.allowedScopes ?? []).length > 0 && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Scopes: {(capability.scopes ?? capability.allowedScopes).join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function GrantDialog({ capabilities, onClose, onGranted }) {
  const [values, setValues] = useState({
    capability: capabilities[0]?.key ?? "",
    discordUserId: "",
    scopeType: "",
    scopeId: "",
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const chosen = capabilities.find((c) => c.key === values.capability);
  // Scope options come from the catalogue, so a capability that is global-only
  // never offers a per-guild scope that the API would then reject.
  const scopes = chosen?.scopes ?? chosen?.allowedScopes ?? [];
  const needsScopeId = values.scopeType && values.scopeType !== "GLOBAL";

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api("/permissions", {
        method: "POST",
        body: {
          capability: values.capability,
          discordUserId: values.discordUserId.trim(),
          scopeType: values.scopeType || undefined,
          scopeId: needsScopeId ? values.scopeId.trim() : undefined,
        },
      });
      onGranted();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Grant a capability">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Capability" htmlFor="g-cap" required>
          <Select
            id="g-cap"
            value={values.capability}
            onChange={(value) => setValues((v) => ({ ...v, capability: value, scopeType: "" }))}
            options={capabilities.map((c) => ({
              value: c.key,
              label: c.dangerous ? `${c.key} — dangerous` : c.key,
            }))}
          />
        </Field>

        {chosen?.description && (
          <p className="text-sm leading-relaxed text-slate-400">{chosen.description}</p>
        )}

        {chosen?.dangerous && (
          <p className="flex items-start gap-2 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/25">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            The bot marks this capability dangerous. Grant it deliberately.
          </p>
        )}

        <Field label="Discord user ID" htmlFor="g-user" required>
          <TextInput
            id="g-user"
            value={values.discordUserId}
            onChange={(e) => setValues((v) => ({ ...v, discordUserId: e.target.value }))}
          />
        </Field>

        {scopes.length > 0 && (
          <Field label="Scope" htmlFor="g-scope">
            <Select
              id="g-scope"
              value={values.scopeType}
              onChange={(value) => setValues((v) => ({ ...v, scopeType: value }))}
              options={scopes.map((scope) => ({ value: scope, label: scope }))}
              placeholder="Choose a scope"
            />
          </Field>
        )}

        {needsScopeId && (
          <Field label="Scope ID" htmlFor="g-scope-id" required>
            <TextInput
              id="g-scope-id"
              value={values.scopeId}
              onChange={(e) => setValues((v) => ({ ...v, scopeId: e.target.value }))}
            />
          </Field>
        )}

        {error && <BotError error={error} />}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Granting…" : "Grant"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
