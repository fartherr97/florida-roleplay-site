import { useState } from "react";
import { Link } from "react-router-dom";
import { Undo2 } from "lucide-react";
import Button from "../../../components/ui/Button";
import DeptPageHeader from "../../../components/dept/DeptPageHeader";
import { useDeptConfig } from "../../../context/useDeptConfig";
import StartHereTab from "./StartHereTab";
import BrandingTab from "./BrandingTab";
import PagesTab from "./PagesTab";
import RosterTab from "./RosterTab";
import AdvancedTab from "./AdvancedTab";
import { cn } from "../../../lib/cn";

/**
 * The Builder Portal: this department's whole site, editable in place.
 *
 * Every tab writes through `mutate`, which applies the change locally and
 * debounces a save — so the page you are editing is the page you are looking at,
 * and there is no Save button to forget. The safety net is version history:
 * every save keeps the config it replaced, and the Audit page restores one.
 */
const TABS = [
  { id: "start", label: "Start here", Component: StartHereTab },
  { id: "branding", label: "Branding", Component: BrandingTab },
  { id: "pages", label: "Pages", Component: PagesTab },
  { id: "roster", label: "Roster", Component: RosterTab },
  { id: "advanced", label: "Advanced", Component: AdvancedTab },
];

export default function DeptBuilder({ page, config }) {
  const [tabId, setTabId] = useState("start");
  const { saveState, saveMessage, undo, canUndo } = useDeptConfig();
  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0];
  const { Component } = tab;

  return (
    <>
      <DeptPageHeader
        icon={page.icon}
        eyebrow={config.branding.shortName}
        title={page.label}
        subtitle="Changes save themselves. Version history on the Audit page puts anything back."
        actions={
          <>
            {canUndo && (
              <Button variant="ghost" size="sm" onClick={undo}>
                <Undo2 className="size-4" />
                Undo
              </Button>
            )}
            <Button as={Link} to={`/departments/${config.id}/hub`} variant="secondary" size="sm">
              View site
            </Button>
          </>
        }
      />

      {saveState === "error" && saveMessage && (
        <p className="mb-5 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-400/25">
          {saveMessage}
        </p>
      )}
      {saveState === "saved" && saveMessage && (
        <p className="mb-5 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-inset ring-amber-400/25">
          {saveMessage}
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTabId(entry.id)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-semibold ring-1 ring-inset transition",
              entry.id === tab.id
                ? "dept-accent-tile"
                : "bg-white/[0.02] text-slate-300 ring-white/[0.06] hover:bg-white/[0.06] hover:text-white",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {/* Keyed so switching tabs glides the new panel in, matching the
          reference hub's tab feel. */}
      <div key={tab.id} className="anim-tab-in">
        <Component config={config} />
      </div>
    </>
  );
}

