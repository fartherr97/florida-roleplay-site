import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { api } from "../../lib/api";
import { checklist as seedChecklist } from "../../data/staffHubData";
import { cn } from "../../lib/cn";

const STORAGE_KEY = "flrp.trialChecklist";

/** Reads the saved ticks, tolerating storage being unavailable or corrupt. */
function readTicks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

/**
 * Trial Moderator onboarding checklist. Progress is kept per browser rather than
 * on the server: this is a personal working list, and an evaluating Administrator
 * signs off the real milestones in the DA database.
 */
export default function HubChecklist() {
  const [sections, setSections] = useState(seedChecklist);
  const [ticks, setTicks] = useState(readTicks);

  useEffect(() => {
    let active = true;
    api.hubChecklist().then((next) => {
      if (active && next?.length) setSections(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const toggle = (id) => {
    setTicks((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore — the checklist still works for this session */
      }
      return next;
    });
  };

  const { done, total, requiredLeft } = useMemo(() => {
    const items = sections.flatMap((section) => section.items);
    return {
      done: items.filter((item) => ticks[item.id]).length,
      total: items.length,
      requiredLeft: items.filter((item) => item.required && !ticks[item.id]).length,
    };
  }, [sections, ticks]);

  const reset = () => {
    setTicks({});
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <HubPageHeader
        icon="ListChecks"
        title="Trial Mod Checklist"
        subtitle="Everything a Trial Moderator completes before their review. Progress is saved in this browser."
        actions={
          <>
            <Badge tone={requiredLeft === 0 ? "green" : "amber"} dot>
              {requiredLeft === 0
                ? "Ready for review"
                : `${requiredLeft} required left`}
            </Badge>
            <Button variant="ghost" size="sm" onClick={reset}>
              Reset
            </Button>
          </>
        }
      />

      <Card className="mb-6 p-5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Progress
          </p>
          <p className="text-sm font-bold text-white">
            {done} / {total}
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-primary-500 transition-all duration-300"
            style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }}
          />
        </div>
      </Card>

      <div className="space-y-5">
        {sections.map((section) => (
          <Card key={section.id} className="p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-bold text-white">{section.title}</h2>
              <Badge tone="slate">
                {section.items.filter((item) => ticks[item.id]).length}/
                {section.items.length}
              </Badge>
            </div>
            <p className="mt-1.5 text-sm text-slate-400">{section.description}</p>

            <ul className="mt-4 space-y-2">
              {section.items.map((item) => {
                const checked = Boolean(ticks[item.id]);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      aria-pressed={checked}
                      className="flex w-full items-start gap-3 rounded-xl bg-black/25 p-3.5 text-left ring-1 ring-inset ring-white/[0.06] transition hover:bg-white/[0.04]"
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md ring-1 ring-inset transition",
                          checked
                            ? "bg-primary-500 text-white ring-primary-400/50"
                            : "bg-white/[0.03] text-transparent ring-white/15",
                        )}
                      >
                        <Check className="size-3.5" />
                      </span>
                      <span
                        className={cn(
                          "text-sm leading-relaxed transition",
                          checked ? "text-slate-500 line-through" : "text-slate-300",
                        )}
                      >
                        {item.label}
                        {item.required && (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-400">
                            Required
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
