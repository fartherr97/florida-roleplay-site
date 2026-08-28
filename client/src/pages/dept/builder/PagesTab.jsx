import { createElement, useState } from "react";
import { ChevronDown, ChevronUp, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import Field from "../../../components/ui/Field";
import Select from "../../../components/ui/Select";
import { TextInput } from "../../../components/ui/TextInput";
import BlockEditor from "./BlockEditor";
import WelcomeEditor from "./WelcomeEditor";
import TabIntro from "./TabIntro";
import { useDeptConfig } from "../../../context/useDeptConfig";
import { PAGE_TYPES, PAGE_TYPE_MAP } from "../../../lib/departmentConfig";
import { hubIcon, ICON_NAMES } from "../../../lib/hubIcons";

/**
 * The department's pages: which exist, what they are called, where they sit in
 * the nav and — for the content-driven types — what is on them.
 *
 * A page's `type` is fixed once it is created. Changing it would leave the old
 * type's data stranded under a renderer that cannot read it, and "delete it and
 * add the right one" is both clearer and recoverable from version history.
 */
export default function PagesTab({ config }) {
  const { mutate } = useDeptConfig();
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [blocksFor, setBlocksFor] = useState(null);
  const [welcomeFor, setWelcomeFor] = useState(null);
  const [confirming, setConfirming] = useState(null);

  const pages = config.pages;
  const groups = config.navGroups;

  const setPages = (next) => mutate((current) => ({ ...current, pages: next }));

  const move = (index, delta) => {
    const next = [...pages];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setPages(next);
  };

  const blockPage = blocksFor ? pages.find((page) => page.id === blocksFor) : null;
  const welcomePage = welcomeFor ? pages.find((page) => page.id === welcomeFor) : null;

  return (
    <>
      <TabIntro title="Pages" badge={`${pages.length} pages`}>
        Order here is the order in the nav. Administrative pages carry their own access rules —
        the Builder Portal, Access and the Audit log are only ever visible to people who hold the
        matching capability, whatever else is set on them.
      </TabIntro>

      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          Add a page
        </Button>
      </div>

      <div className="space-y-2">
        {pages.map((page, index) => {
          const type = PAGE_TYPE_MAP[page.type];
          const group = groups.find((g) => g.id === page.navGroup);
          const hasBlocks =
            page.type === "home" || page.type === "content" || page.type === "welcome";

          return (
            <Card key={page.id} className="flex flex-wrap items-center gap-3 p-4">
              <span className="dept-accent-tile grid size-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset">
                {createElement(hubIcon(page.icon), { className: "size-4" })}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">{page.label}</span>
                  {page.locked && (
                    <span title="This page cannot be removed">
                      <Lock className="size-3.5 text-slate-500" />
                    </span>
                  )}
                  {page.restricted && <Badge tone="amber">Restricted</Badge>}
                  {type?.requires && <Badge tone="rose">{type.requires}</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {type?.label} · {group?.label ?? "Ungrouped"} · /{page.id}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${page.label} up`}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === pages.length - 1}
                  aria-label={`Move ${page.label} down`}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
                >
                  <ChevronDown className="size-4" />
                </button>
                {page.type === "welcome" && (
                  <Button variant="ghost" size="sm" onClick={() => setWelcomeFor(page.id)}>
                    Welcome
                  </Button>
                )}
                {hasBlocks && (
                  <Button variant="ghost" size="sm" onClick={() => setBlocksFor(page.id)}>
                    Content
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(page)}
                  aria-label={`Edit ${page.label}`}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(page)}
                  disabled={page.locked}
                  aria-label={`Delete ${page.label}`}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <NavGroups config={config} />

      {editing && (
        <PageSettings
          key={editing.id}
          page={editing}
          groups={groups}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            setPages(pages.map((page) => (page.id === next.id ? next : page)));
            setEditing(null);
          }}
        />
      )}

      {adding && (
        <AddPage
          groups={groups}
          existing={pages}
          onClose={() => setAdding(false)}
          onAdd={(page) => {
            setPages([...pages, page]);
            setAdding(false);
          }}
        />
      )}

      {blockPage && (
        <BlockEditor
          key={blockPage.id}
          page={blockPage}
          config={config}
          onClose={() => setBlocksFor(null)}
        />
      )}

      {welcomePage && (
        <WelcomeEditor
          key={welcomePage.id}
          page={welcomePage}
          onClose={() => setWelcomeFor(null)}
        />
      )}

      {confirming && (
        <Modal open onClose={() => setConfirming(null)} title={`Delete "${confirming.label}"?`}>
          <p className="text-sm text-slate-400">
            The page and everything on it come off this site. The version history on the Audit page
            keeps a copy, so this can be undone.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setPages(pages.filter((page) => page.id !== confirming.id));
                setConfirming(null);
              }}
            >
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Add, rename, reorder and remove the nav groups the pages are sorted into. */
function NavGroups({ config }) {
  const { mutate } = useDeptConfig();
  const groups = config.navGroups;

  const setGroups = (next) => mutate((current) => ({ ...current, navGroups: next }));

  const rename = (id, label) =>
    setGroups(groups.map((group) => (group.id === id ? { ...group, label } : group)));

  const move = (index, delta) => {
    const next = [...groups];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setGroups(next);
  };

  const add = () =>
    setGroups([...groups, { id: `group-${Date.now()}`, label: "New group" }]);

  // Removing a group leaves its pages without a home; the config normaliser
  // reparents any orphaned page to the first group, so the pages survive — they
  // just move. The last group can't be removed, since every page needs one.
  const remove = (id) => setGroups(groups.filter((group) => group.id !== id));

  return (
    <Card className="mt-6 p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-white">Nav groups</h3>
        <Button variant="ghost" size="sm" onClick={add}>
          <Plus className="size-4" />
          Add group
        </Button>
      </div>
      <p className="mb-4 text-sm text-slate-400">
        Each group is one dropdown in the top bar, in this order. A group with no pages the viewer
        can open is hidden rather than shown empty. Removing a group moves its pages to the first
        group.
      </p>
      <div className="space-y-2">
        {groups.map((group, index) => (
          <div
            key={group.id}
            className="flex flex-wrap items-end gap-2 rounded-xl bg-white/[0.02] p-3 ring-1 ring-inset ring-white/[0.06]"
          >
            <Field label="Label" htmlFor={`group-${group.id}`} className="min-w-40 flex-1">
              <TextInput
                id={`group-${group.id}`}
                value={group.label}
                onChange={(e) => rename(group.id, e.target.value)}
              />
            </Field>
            <div className="mb-1 flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Move group up"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === groups.length - 1}
                aria-label="Move group down"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
              >
                <ChevronDown className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => remove(group.id)}
                disabled={groups.length <= 1}
                aria-label={`Remove ${group.label}`}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-30"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PageSettings({ page, groups, onClose, onSave }) {
  const [values, setValues] = useState(page);
  const set = (changes) => setValues((current) => ({ ...current, ...changes }));

  return (
    <Modal open onClose={onClose} title={`"${page.label}" settings`}>
      <div className="space-y-4">
        <Field label="Label" htmlFor="p-label">
          <TextInput id="p-label" value={values.label} onChange={(e) => set({ label: e.target.value })} />
        </Field>
        <Field label="Nav group" htmlFor="p-group">
          <Select
            id="p-group"
            value={values.navGroup}
            onChange={(next) => set({ navGroup: next })}
            options={groups.map((group) => ({ value: group.id, label: group.label }))}
          />
        </Field>
        <Field label="Icon" htmlFor="p-icon">
          <Select
            id="p-icon"
            value={values.icon}
            onChange={(next) => set({ icon: next })}
            options={ICON_NAMES}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave(values)}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AddPage({ groups, existing, onClose, onAdd }) {
  const [type, setType] = useState("content");
  const [label, setLabel] = useState("");
  const [navGroup, setNavGroup] = useState(groups[0]?.id ?? "main");

  const definition = PAGE_TYPE_MAP[type];
  // A page id is a URL segment, so derive it from the label and keep it unique.
  const slug = (label || definition.label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const taken = existing.some((page) => page.id === slug);

  return (
    <Modal open onClose={onClose} title="Add a page">
      <div className="space-y-4">
        <Field label="Type" htmlFor="new-type">
          <Select
            id="new-type"
            value={type}
            onChange={setType}
            options={PAGE_TYPES.map((entry) => ({ value: entry.type, label: entry.label }))}
          />
        </Field>
        <p className="text-xs leading-relaxed text-slate-500">{definition.detail}</p>

        <Field label="Label" htmlFor="new-label" hint={slug ? `Address: /${slug}` : undefined}>
          <TextInput
            id="new-label"
            value={label}
            placeholder={definition.label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <Field label="Nav group" htmlFor="new-group">
          <Select
            id="new-group"
            value={navGroup}
            onChange={setNavGroup}
            options={groups.map((group) => ({ value: group.id, label: group.label }))}
          />
        </Field>

        {taken && (
          <p className="text-xs text-rose-300">
            This department already has a page at /{slug}. Pick a different label.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!slug || taken}
            onClick={() =>
              onAdd({
                id: slug,
                label: label || definition.label,
                type,
                icon: definition.icon,
                navGroup,
                locked: false,
                restricted: false,
                access: [],
                config: {},
              })
            }
          >
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}
