import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Link2, Pencil, Plus, Trash2, FolderPlus } from "lucide-react";
import Section from "../components/layout/Section";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Field from "../components/ui/Field";
import { TextInput, TextArea } from "../components/ui/TextInput";
import SearchHero from "../components/ui/SearchHero";
import { api } from "../lib/api";
import { rules as seedRules } from "../data/mockData";
import { useAuth } from "../context/useAuth";
import { cn } from "../lib/cn";

/**
 * Searchable, categorised rulebook. Each category collapses, and every rule is
 * deep-linkable by anchor so staff can point at a specific clause.
 *
 * Ownership (rules.manage) gets an inline editor: add/edit/remove rules and
 * categories in place. Everyone else sees the read-only book.
 */
export default function Rules() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("rules.manage");

  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState(seedRules);
  const [openIds, setOpenIds] = useState(() => seedRules.map((g) => g.id));
  const [editMode, setEditMode] = useState(false);
  const [modal, setModal] = useState(null); // { type, ... }
  const location = useLocation();

  const load = useCallback(
    (q) => api.rules(q).then((data) => data && setGroups(data)),
    [],
  );

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api.rules(query).then((data) => {
        if (!active || !data) return;
        setGroups(data);
        // A search should reveal its matches rather than hide them behind a collapse.
        if (query.trim()) setOpenIds(data.map((g) => g.id));
      });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  // Open (and scroll to) the category holding a linked rule anchor.
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const group = groups.find((g) => g.items.some((item) => item.id === id));
    const timer = setTimeout(() => {
      if (group) {
        setOpenIds((prev) => (prev.includes(group.id) ? prev : [...prev, group.id]));
      }
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 220);
    return () => clearTimeout(timer);
  }, [location.hash, groups]);

  const total = useMemo(
    () => groups.reduce((sum, group) => sum + group.items.length, 0),
    [groups],
  );

  const toggle = (id) =>
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));

  const jumpTo = (id) => {
    setOpenIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const refresh = () => load(query.trim());

  const removeRule = async (item) => {
    if (!window.confirm(`Delete rule "${item.title}"? This cannot be undone.`)) return;
    await api.deleteRule(item.id);
    await refresh();
  };

  return (
    <Section>
      <SearchHero
        title="Server Rules"
        subtitle="Everything below is enforced. Read it once properly and the rest of your time here will go a lot more smoothly."
        value={query}
        onChange={setQuery}
        placeholder="Search rules — try 'pursuit' or 'metagaming'"
      >
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-xs text-slate-500">
            {total} rule{total === 1 ? "" : "s"} across {groups.length} categor
            {groups.length === 1 ? "y" : "ies"}
          </p>
          {canEdit && (
            <div className="ml-auto flex items-center gap-2">
              {editMode && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setModal({ type: "cat-add" })}
                >
                  <FolderPlus className="size-4" />
                  Add category
                </Button>
              )}
              <Button
                size="sm"
                variant={editMode ? "primary" : "ghost"}
                onClick={() => setEditMode((v) => !v)}
              >
                <Pencil className="size-4" />
                {editMode ? "Done editing" : "Edit rules"}
              </Button>
            </div>
          )}
        </div>
      </SearchHero>

      {groups.length === 0 ? (
        <Card className="mt-6 p-8 text-center">
          <p className="text-sm text-slate-400">No rules match “{query}”. Try a broader term.</p>
        </Card>
      ) : (
        <div className="mt-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6 lg:items-start">
          <nav className="mb-4 lg:sticky lg:top-24 lg:mb-0">
            <Card className="p-2">
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Sections
              </p>
              <ul className="max-h-[70vh] space-y-0.5 overflow-y-auto">
                {groups.map((group) => (
                  <li key={group.id}>
                    <button
                      type="button"
                      onClick={() => jumpTo(group.id)}
                      className="block w-full truncate rounded-lg px-3 py-1.5 text-left text-sm text-slate-400 transition hover:bg-primary-500/10 hover:text-white"
                    >
                      {group.category}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </nav>

          <div className="space-y-4">
            {groups.map((group) => {
              const isOpen = openIds.includes(group.id);
              return (
                <Card key={group.id} id={group.id} className="scroll-mt-24 overflow-hidden">
                  <div className="flex w-full items-center justify-between gap-4 p-5">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => toggle(group.id)}
                      className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
                    >
                      <div className="min-w-0">
                        <h2 className="text-base font-bold text-white">{group.category}</h2>
                        <p className="mt-1 text-sm text-slate-400">{group.description}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge tone="slate">{group.items.length}</Badge>
                        <ChevronDown
                          className={cn(
                            "size-4 text-slate-400 transition-transform duration-200",
                            isOpen && "rotate-180",
                          )}
                        />
                      </div>
                    </button>
                    {editMode && (
                      <div className="flex shrink-0 items-center gap-1">
                        <IconButton
                          label="Edit category"
                          onClick={() =>
                            setModal({
                              type: "cat-edit",
                              categoryId: group.id,
                              category: group.category,
                              description: group.description ?? "",
                            })
                          }
                        >
                          <Pencil className="size-4" />
                        </IconButton>
                        <IconButton
                          label="Add rule"
                          onClick={() => setModal({ type: "rule-add", categoryId: group.id })}
                        >
                          <Plus className="size-4" />
                        </IconButton>
                      </div>
                    )}
                  </div>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <ul className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
                          {group.items.map((item) => (
                            <li
                              key={item.id}
                              id={item.id}
                              className="group scroll-mt-24 px-5 py-4 target:bg-primary-500/[0.06]"
                            >
                              <div className="flex items-start gap-3">
                                <span className="mt-0.5 shrink-0 rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] font-bold text-primary-400 ring-1 ring-inset ring-white/10">
                                  {item.number || "—"}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                                    {item.title}
                                    <a
                                      href={`#${item.id}`}
                                      aria-label={`Link to rule ${item.number}`}
                                      className="text-slate-600 opacity-0 transition hover:text-primary-400 group-hover:opacity-100"
                                    >
                                      <Link2 className="size-3.5" />
                                    </a>
                                  </h3>
                                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-400">
                                    {item.body}
                                  </p>
                                </div>
                                {editMode && (
                                  <div className="flex shrink-0 items-center gap-1">
                                    <IconButton
                                      label="Edit rule"
                                      onClick={() =>
                                        setModal({ type: "rule-edit", categoryId: group.id, item })
                                      }
                                    >
                                      <Pencil className="size-4" />
                                    </IconButton>
                                    <IconButton label="Delete rule" danger onClick={() => removeRule(item)}>
                                      <Trash2 className="size-4" />
                                    </IconButton>
                                  </div>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {modal && (
        <RuleEditorModal
          modal={modal}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await refresh();
          }}
        />
      )}
    </Section>
  );
}

function IconButton({ label, danger, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-lg text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-white",
        danger && "hover:text-rose-300",
      )}
    >
      {children}
    </button>
  );
}

/** One modal handling all four edit shapes: add/edit a rule, add/edit a category. */
function RuleEditorModal({ modal, onClose, onSaved }) {
  const isCatAdd = modal.type === "cat-add";
  const isRuleEdit = modal.type === "rule-edit";
  const showCategoryFields = isCatAdd || modal.type === "cat-edit";
  // Rule fields show for everything except renaming a category.
  const showRuleFields = modal.type !== "cat-edit";

  const [category, setCategory] = useState(modal.category ?? "");
  const [description, setDescription] = useState(modal.description ?? "");
  const [number, setNumber] = useState(modal.item?.number ?? "");
  const [title, setTitle] = useState(modal.item?.title ?? "");
  const [body, setBody] = useState(modal.item?.body ?? "");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const heading = {
    "rule-add": "Add rule",
    "rule-edit": "Edit rule",
    "cat-add": "Add category",
    "cat-edit": "Edit category",
  }[modal.type];

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      let res;
      if (modal.type === "cat-edit") {
        res = await api.updateRuleCategory(modal.categoryId, { category, description });
      } else if (modal.type === "cat-add") {
        // A new category is created by adding its first rule.
        res = await api.addRule({ category, categoryDescription: description, number, title, body });
      } else if (isRuleEdit) {
        res = await api.updateRule(modal.item.id, { number, title, body });
      } else {
        res = await api.addRule({ categoryId: modal.categoryId, number, title, body });
      }
      if (res && res.ok === false) throw new Error(res.message || "Couldn't save.");
      await onSaved();
    } catch (err) {
      setError(err?.message ?? (err?.errors ? err.errors.join(" ") : "Couldn't save."));
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={heading} className="max-w-xl">
      <form onSubmit={submit} className="space-y-4">
        {showCategoryFields && (
          <>
            <Field label="Category name" htmlFor="r-cat" required>
              <TextInput id="r-cat" value={category} onChange={(e) => setCategory(e.target.value)} />
            </Field>
            <Field label="Category description" htmlFor="r-catdesc">
              <TextInput
                id="r-catdesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short line under the category heading"
              />
            </Field>
          </>
        )}

        {showRuleFields && (
          <>
            <Field label="Number (optional)" htmlFor="r-num">
              <TextInput
                id="r-num"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="e.g. 1.1"
              />
            </Field>
            <Field label="Title" htmlFor="r-title" required>
              <TextInput id="r-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Rule text" htmlFor="r-body" required>
              <TextArea id="r-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
          </>
        )}

        {isCatAdd && (
          <p className="text-xs text-slate-500">
            A category needs a first rule — fill in the rule fields above to create it.
          </p>
        )}

        {error && <p className="text-sm text-rose-300">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
