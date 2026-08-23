import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, Upload } from "lucide-react";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Field from "../../../components/ui/Field";
import { TextArea } from "../../../components/ui/TextInput";
import TabIntro from "./TabIntro";
import { useDeptConfig } from "../../../context/useDeptConfig";
import { normalizeConfig, validateConfig } from "../../../lib/departmentConfig";

/**
 * Backups and the raw document.
 *
 * Export/import is deliberately plain JSON in a textarea rather than a file
 * download: it works in every browser, it can be pasted into a Discord ticket
 * when something goes wrong, and it makes it obvious that the config is just
 * data. Version history on the Audit page is the everyday undo; this is for
 * moving a setup between departments or keeping a copy outside the database.
 */
export default function AdvancedTab({ config }) {
  const { mutate } = useDeptConfig();
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState(null);

  const serialized = JSON.stringify(config, null, 2);

  const load = () => {
    let parsed;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setStatus({ tone: "error", message: "That is not valid JSON." });
      return;
    }
    // The id always comes from the route, never the payload — importing a config
    // saved from another department should reshape this one, not overwrite that
    // one. The server enforces the same thing.
    const next = normalizeConfig({ ...parsed, id: config.id }, config.id);
    const errors = validateConfig(next);
    if (errors.length > 0) {
      setStatus({ tone: "error", message: errors.join(" ") });
      return;
    }
    mutate(() => next, { immediate: true });
    setStatus({ tone: "ok", message: "Imported. The site is now running that config." });
    setDraft("");
  };

  return (
    <>
      <TabIntro title="Backup and restore">
        The whole site is the document below. Copy it somewhere safe before a big change, and paste
        it back to undo one.
      </TabIntro>

      {status && (
        <p
          className={
            status.tone === "error"
              ? "mb-5 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-400/25"
              : "mb-5 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 ring-1 ring-inset ring-emerald-400/25"
          }
        >
          {status.message}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="flex flex-col p-5">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-white">
            <Download className="size-4" />
            Export
          </h3>
          <p className="mb-3 text-sm text-slate-400">
            This department's current configuration.
          </p>
          <TextArea readOnly rows={14} value={serialized} className="flex-1 font-mono text-xs" />
          <Button
            variant="secondary"
            size="sm"
            className="mt-3 self-start"
            onClick={() => navigator.clipboard?.writeText(serialized)}
          >
            Copy to clipboard
          </Button>
        </Card>

        <Card className="flex flex-col p-5">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-white">
            <Upload className="size-4" />
            Import
          </h3>
          <p className="mb-3 text-sm text-slate-400">
            Paste an exported config. It is validated before anything is saved, and the version it
            replaces stays in history.
          </p>
          <Field label="Configuration JSON" htmlFor="import-json" className="flex-1">
            <TextArea
              id="import-json"
              rows={14}
              value={draft}
              placeholder="{ …the exported JSON… }"
              onChange={(e) => setDraft(e.target.value)}
              className="font-mono text-xs"
            />
          </Field>
          <Button size="sm" className="mt-3 self-start" disabled={!draft.trim()} onClick={load}>
            Import and save
          </Button>
        </Card>
      </div>

      <Card className="mt-5 p-5">
        <h3 className="mb-1 text-sm font-bold uppercase tracking-[0.14em] text-white">
          Where the rest lives
        </h3>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-400">
          <li>
            <Link
              to={`/departments/${config.id}/hub/access`}
              className="dept-accent-text underline-offset-2 hover:underline"
            >
              Access &amp; Roles
            </Link>{" "}
            — which Discord role holds which capability here.
          </li>
          <li>
            <Link
              to={`/departments/${config.id}/hub/audit`}
              className="dept-accent-text underline-offset-2 hover:underline"
            >
              Audit log
            </Link>{" "}
            — every change, and the versions to restore.
          </li>
          <li>
            <Link to="/staff-hub/discord-roles" className="dept-accent-text underline-offset-2 hover:underline">
              Discord role mapping
            </Link>{" "}
            — community-wide, and what decides who lands on this roster at all.
          </li>
        </ul>
      </Card>
    </>
  );
}
