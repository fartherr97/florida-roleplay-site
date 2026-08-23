import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import { api } from "../../lib/api";
import { portal as seedPortal, portalLinks as seedLinks } from "../../data/staffHubData";

const SECTION_LABELS = {
  allStaff: "Resources",
  administrators: "Administrators",
  seniorAdmins: "Senior Admins+",
};

/** Collapsible editor block, so the panel opens as a short list of sections. */
function Panel({ title, children }) {
  return (
    <details className="card group overflow-hidden">
      <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 transition hover:bg-white/[0.02]">
        <span className="text-sm font-bold text-white">{title}</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 group-open:hidden">
          Edit
        </span>
      </summary>
      <div className="border-t border-white/[0.06] p-6">{children}</div>
    </details>
  );
}

/**
 * Director panel — edits the featured member, reminders, quick notes and every
 * rank's link collection. Writes go to the API; when it is unreachable the save
 * reports that rather than pretending it persisted.
 */
export default function HubDirector() {
  const [featured, setFeatured] = useState(seedPortal.featuredMember);
  const [reminders, setReminders] = useState(seedPortal.reminders);
  const [quickNotes, setQuickNotes] = useState(seedPortal.quickNotes);
  const [links, setLinks] = useState(seedLinks);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let active = true;
    api.hubPortal().then((data) => {
      if (!active || !data) return;
      setFeatured(data.featuredMember ?? {});
      setReminders(data.reminders ?? []);
      setQuickNotes(data.quickNotes ?? "");
      setLinks(data.links ?? seedLinks);
    });
    return () => {
      active = false;
    };
  }, []);

  const save = async (section, payload) => {
    try {
      const result = await api.saveHubPortal(section, payload);
      setStatus({
        tone: result?.message ? "amber" : "green",
        text: result?.message ?? "Saved.",
      });
    } catch (err) {
      setStatus({ tone: "rose", text: err.message || "Save failed." });
    }
  };

  const updateLink = (section, index, field, value) =>
    setLinks((prev) => ({
      ...prev,
      [section]: prev[section].map((link, i) =>
        i === index ? { ...link, [field]: value } : link,
      ),
    }));

  const addLink = (section) =>
    setLinks((prev) => ({
      ...prev,
      [section]: [...(prev[section] ?? []), { title: "New link", url: "https://" }],
    }));

  const removeLink = (section, index) =>
    setLinks((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index),
    }));

  return (
    <>
      <HubPageHeader
        icon="Crown"
        title="Director"
        subtitle="Manage the featured member, reminders, quick notes and every rank's links."
        actions={<Badge tone="rose">Director only</Badge>}
      />

      {status && (
        <Card className="mb-6 p-4">
          <p
            className={`text-sm font-semibold ${
              status.tone === "green"
                ? "text-emerald-300"
                : status.tone === "amber"
                  ? "text-amber-300"
                  : "text-rose-300"
            }`}
          >
            {status.text}
          </p>
        </Card>
      )}

      <div className="space-y-4">
        <Panel title="Staff Member of the Month">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" htmlFor="featuredName">
              <TextInput
                id="featuredName"
                value={featured.name ?? ""}
                onChange={(e) => setFeatured({ ...featured, name: e.target.value })}
              />
            </Field>
            <Field label="Rank" htmlFor="featuredRank">
              <TextInput
                id="featuredRank"
                value={featured.rank ?? ""}
                onChange={(e) => setFeatured({ ...featured, rank: e.target.value })}
              />
            </Field>
            <Field label="Claims" htmlFor="featuredClaims">
              <TextInput
                id="featuredClaims"
                value={featured.claims ?? ""}
                onChange={(e) => setFeatured({ ...featured, claims: e.target.value })}
              />
            </Field>
            <Field label="Vest hours" htmlFor="featuredVest">
              <TextInput
                id="featuredVest"
                value={featured.vestHours ?? ""}
                onChange={(e) =>
                  setFeatured({ ...featured, vestHours: e.target.value })
                }
              />
            </Field>
          </div>
          <Field label="Note" htmlFor="featuredNote" className="mt-5">
            <TextArea
              id="featuredNote"
              rows={3}
              value={featured.note ?? ""}
              onChange={(e) => setFeatured({ ...featured, note: e.target.value })}
            />
          </Field>
          <Button size="sm" className="mt-5" onClick={() => save("featured", featured)}>
            <Save className="size-4" />
            Save featured member
          </Button>
        </Panel>

        <Panel title="Reminders">
          <div className="space-y-5">
            {[0, 1, 2].map((index) => (
              <Field key={index} label={`Reminder ${index + 1}`} htmlFor={`reminder${index}`}>
                <TextArea
                  id={`reminder${index}`}
                  rows={2}
                  value={reminders[index] ?? ""}
                  onChange={(e) =>
                    setReminders((prev) => {
                      const next = [...prev];
                      next[index] = e.target.value;
                      return next;
                    })
                  }
                />
              </Field>
            ))}
          </div>
          <Button
            size="sm"
            className="mt-5"
            onClick={() =>
              save("reminders", { reminders: reminders.filter(Boolean) })
            }
          >
            <Save className="size-4" />
            Save reminders
          </Button>
        </Panel>

        <Panel title="Quick Notes">
          <Field label="Quick notes" htmlFor="quickNotes">
            <TextArea
              id="quickNotes"
              rows={7}
              value={quickNotes}
              onChange={(e) => setQuickNotes(e.target.value)}
            />
          </Field>
          <Button
            size="sm"
            className="mt-5"
            onClick={() => save("quick-notes", { quickNotes })}
          >
            <Save className="size-4" />
            Save quick notes
          </Button>
        </Panel>

        {Object.keys(SECTION_LABELS).map((section) => (
          <Panel key={section} title={`${SECTION_LABELS[section]} links`}>
            <div className="space-y-4">
              {(links[section] ?? []).map((link, index) => (
                <div
                  key={`${section}-${index}`}
                  className="rounded-2xl bg-black/25 p-4 ring-1 ring-inset ring-white/[0.06]"
                >
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-400">
                    Link {index + 1}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Title" htmlFor={`${section}-title-${index}`}>
                      <TextInput
                        id={`${section}-title-${index}`}
                        value={link.title}
                        onChange={(e) =>
                          updateLink(section, index, "title", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="URL" htmlFor={`${section}-url-${index}`}>
                      <TextInput
                        id={`${section}-url-${index}`}
                        value={link.url}
                        onChange={(e) =>
                          updateLink(section, index, "url", e.target.value)
                        }
                      />
                    </Field>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    className="mt-4"
                    onClick={() => removeLink(section, index)}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="ghost" size="sm" onClick={() => addLink(section)}>
                <Plus className="size-4" />
                Add link
              </Button>
              <Button
                size="sm"
                onClick={() => save("links", { section, links: links[section] ?? [] })}
              >
                <Save className="size-4" />
                Save {SECTION_LABELS[section]} links
              </Button>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
