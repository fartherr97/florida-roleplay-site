import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, EyeOff, Plus } from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import Field from "../../../components/ui/Field";
import { TextArea, TextInput } from "../../../components/ui/TextInput";
import BotError from "../../../components/bot/BotError";
import Loading from "../../../components/bot/Loading";
import Empty from "../../../components/bot/Empty";
import { useBotResource } from "../../../lib/useBotResource";
import { api } from "../../../lib/botApi";
import { formatDate, plural } from "../../../lib/format";

/**
 * Every roster the bot maintains, published or not.
 *
 * This reads `/rosters/manage` rather than the cached public endpoint because
 * it is the only view that has to show unpublished ones. The public roster view
 * inside a roster's own page uses `/rosters`, which is cached and needs no
 * session.
 */
export default function BotRosters() {
  const { data, error, loading, reload } = useBotResource("/rosters/manage");
  const [creating, setCreating] = useState(false);

  const rosters = data?.items ?? data?.rosters ?? (Array.isArray(data) ? data : []);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-400">
          Rosters are computed from Discord roles. People join one by being given the
          role — there is nothing here to add them by hand.
        </p>
        <Button size="sm" className="ml-auto" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New roster
        </Button>
      </div>

      {error ? (
        <BotError error={error} onRetry={reload} />
      ) : loading ? (
        <Loading rows={3} />
      ) : rosters.length === 0 ? (
        <Empty title="No rosters yet">
          A roster binds Discord roles to ranks and publishes the result. Create one to
          get started.
        </Empty>
      ) : (
        <div className="space-y-3">
          {rosters.map((roster) => (
            <Card
              key={roster.slug}
              as={Link}
              to={`/management/bot/rosters/${encodeURIComponent(roster.slug)}`}
              hover
              className="group flex flex-wrap items-center gap-4 p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-white">{roster.name}</h2>
                  <code className="text-xs text-slate-500">/{roster.slug}</code>
                  {roster.publishedAt === null || roster.published === false ? (
                    <Badge tone="slate">
                      <EyeOff className="size-3" />
                      Unpublished
                    </Badge>
                  ) : null}
                </div>
                {roster.description && (
                  <p className="mt-1.5 text-sm text-slate-400">{roster.description}</p>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  {plural(roster.ranks?.length ?? 0, "rank")}
                  {roster.updatedAt && ` · updated ${formatDate(roster.updatedAt)}`}
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-slate-600 transition group-hover:text-slate-400" />
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <CreateRoster
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </>
  );
}

function CreateRoster({ onClose, onCreated }) {
  const [values, setValues] = useState({
    slug: "",
    name: "",
    description: "",
    discordGuildId: "",
    position: 0,
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (changes) => setValues((current) => ({ ...current, ...changes }));

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api("/rosters/manage", {
        method: "POST",
        body: {
          slug: values.slug.trim(),
          name: values.name.trim(),
          // The API treats an absent optional field differently from an empty
          // string, so send undefined rather than "".
          description: values.description.trim() || undefined,
          discordGuildId: values.discordGuildId.trim(),
          position: Number(values.position) || 0,
        },
      });
      onCreated();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New roster">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" htmlFor="r-name" required>
          <TextInput id="r-name" value={values.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Slug" htmlFor="r-slug" required hint="Used in the roster's address.">
          <TextInput id="r-slug" value={values.slug} onChange={(e) => set({ slug: e.target.value })} />
        </Field>
        <Field label="Discord server ID" htmlFor="r-guild" required>
          <TextInput
            id="r-guild"
            value={values.discordGuildId}
            onChange={(e) => set({ discordGuildId: e.target.value })}
          />
        </Field>
        <Field label="Description" htmlFor="r-desc">
          <TextArea
            id="r-desc"
            rows={2}
            value={values.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </Field>
        <Field label="Position" htmlFor="r-pos" hint="Lower sorts first.">
          <TextInput
            id="r-pos"
            type="number"
            value={values.position}
            onChange={(e) => set({ position: e.target.value })}
            className="max-w-28"
          />
        </Field>

        {error && <BotError error={error} />}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
