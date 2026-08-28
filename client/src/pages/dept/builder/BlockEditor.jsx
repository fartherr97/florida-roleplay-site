import { createElement, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import Field from "../../../components/ui/Field";
import Select from "../../../components/ui/Select";
import { TextArea, TextInput } from "../../../components/ui/TextInput";
import BlockRenderer from "../../../components/dept/BlockRenderer";
import { useDeptConfig } from "../../../context/useDeptConfig";
import { BLOCK_TYPES, newBlock } from "../../../lib/deptBlocks";
import { hubIcon, ICON_NAMES } from "../../../lib/hubIcons";

/**
 * Edits the content blocks on one page, with a live preview beside the fields.
 *
 * The preview is the same BlockRenderer the page itself uses, so what is shown
 * here is exactly what will be published — there is no second rendering path to
 * fall out of step.
 */
export default function BlockEditor({ page, config, onClose }) {
  const { mutate } = useDeptConfig();
  const [blocks, setBlocks] = useState(page.config?.blocks ?? []);
  const [hero, setHero] = useState({
    heroKicker: page.config?.heroKicker ?? "",
    heroTitle: page.config?.heroTitle ?? "",
    heroSubtitle: page.config?.heroSubtitle ?? "",
  });

  const base = `/departments/${config.id}/hub`;

  const commit = (nextBlocks, nextHero = hero) => {
    setBlocks(nextBlocks);
    setHero(nextHero);
    mutate((current) => ({
      ...current,
      pages: current.pages.map((entry) =>
        entry.id === page.id
          ? { ...entry, config: { ...entry.config, ...nextHero, blocks: nextBlocks } }
          : entry,
      ),
    }));
  };

  const update = (id, changes) =>
    commit(blocks.map((block) => (block.id === id ? { ...block, ...changes } : block)));

  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Content — ${page.label}`}
      className="max-w-6xl"
    >
      <div className="grid max-h-[70vh] gap-6 overflow-y-auto lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <Field label="Kicker" htmlFor="hero-kicker">
              <TextInput
                id="hero-kicker"
                value={hero.heroKicker}
                onChange={(e) => commit(blocks, { ...hero, heroKicker: e.target.value })}
              />
            </Field>
            <Field label="Title" htmlFor="hero-title">
              <TextInput
                id="hero-title"
                value={hero.heroTitle}
                onChange={(e) => commit(blocks, { ...hero, heroTitle: e.target.value })}
              />
            </Field>
            <Field label="Subtitle" htmlFor="hero-sub">
              <TextArea
                id="hero-sub"
                rows={2}
                value={hero.heroSubtitle}
                onChange={(e) => commit(blocks, { ...hero, heroSubtitle: e.target.value })}
              />
            </Field>
          </Card>

          {blocks.map((block, index) => (
            <Card key={block.id} className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  {BLOCK_TYPES.find((t) => t.type === block.type)?.label ?? block.type}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Move block up"
                    className="rounded-lg p-1 text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === blocks.length - 1}
                    aria-label="Move block down"
                    className="rounded-lg p-1 text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => commit(blocks.filter((b) => b.id !== block.id))}
                    aria-label="Delete block"
                    className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              <BlockFields block={block} pages={config.pages} onChange={update} />
            </Card>
          ))}

          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Add a block
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BLOCK_TYPES.map((type) => (
                <button
                  key={type.type}
                  type="button"
                  title={type.detail}
                  onClick={() => commit([...blocks, newBlock(type.type, blocks.length)])}
                  className="flex items-center gap-2 rounded-xl bg-white/[0.02] p-3 text-left ring-1 ring-inset ring-white/[0.06] transition hover:bg-white/[0.06]"
                >
                  <span className="dept-accent-tile grid size-7 shrink-0 place-items-center rounded-lg ring-1 ring-inset">
                    {createElement(hubIcon(type.icon), { className: "size-3.5" })}
                  </span>
                  <span className="truncate text-xs font-semibold text-slate-300">
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:sticky lg:top-0">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Preview
          </p>
          {blocks.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-slate-400">Add a block to see it here.</p>
            </Card>
          ) : (
            <BlockRenderer blocks={blocks} base={base} />
          )}
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

/** The fields one block type needs. Everything saves as you type. */
function BlockFields({ block, pages, onChange }) {
  const set = (changes) => onChange(block.id, changes);

  if (block.type === "image") {
    return (
      <>
        <Field label="Image URL" htmlFor={`${block.id}-url`}>
          <TextInput
            id={`${block.id}-url`}
            value={block.url ?? ""}
            onChange={(e) => set({ url: e.target.value })}
          />
        </Field>
        <Field label="Caption" htmlFor={`${block.id}-cap`}>
          <TextInput
            id={`${block.id}-cap`}
            value={block.caption ?? ""}
            onChange={(e) => set({ caption: e.target.value })}
          />
        </Field>
        <Field label="Alt text" htmlFor={`${block.id}-alt`} hint="Describes the image for screen readers.">
          <TextInput
            id={`${block.id}-alt`}
            value={block.alt ?? ""}
            onChange={(e) => set({ alt: e.target.value })}
          />
        </Field>
      </>
    );
  }

  if (block.type === "links" || block.type === "steps" || block.type === "stats") {
    return (
      <>
        {block.type !== "stats" && (
          <>
            <Field label="Kicker" htmlFor={`${block.id}-kicker`}>
              <TextInput
                id={`${block.id}-kicker`}
                value={block.kicker ?? ""}
                onChange={(e) => set({ kicker: e.target.value })}
              />
            </Field>
            <Field label="Title" htmlFor={`${block.id}-title`}>
              <TextInput
                id={`${block.id}-title`}
                value={block.title ?? ""}
                onChange={(e) => set({ title: e.target.value })}
              />
            </Field>
          </>
        )}
        {block.type === "links" && (
          <Field label="Columns" htmlFor={`${block.id}-cols`}>
            <Select
              id={`${block.id}-cols`}
              value={String(block.columns ?? 4)}
              onChange={(next) => set({ columns: Number(next) })}
              options={[2, 3, 4].map((value) => ({ value: String(value), label: String(value) }))}
            />
          </Field>
        )}
        <ItemList block={block} pages={pages} onChange={set} />
      </>
    );
  }

  return (
    <>
      {block.type === "text" && (
        <Field label="Kicker" htmlFor={`${block.id}-kicker`}>
          <TextInput
            id={`${block.id}-kicker`}
            value={block.kicker ?? ""}
            onChange={(e) => set({ kicker: e.target.value })}
          />
        </Field>
      )}
      <Field label="Title" htmlFor={`${block.id}-title`}>
        <TextInput
          id={`${block.id}-title`}
          value={block.title ?? ""}
          onChange={(e) => set({ title: e.target.value })}
        />
      </Field>
      <Field label="Body" htmlFor={`${block.id}-body`}>
        <TextArea
          id={`${block.id}-body`}
          rows={4}
          value={block.body ?? ""}
          onChange={(e) => set({ body: e.target.value })}
        />
      </Field>
    </>
  );
}

/** The repeated rows inside a links, steps or stats block. */
function ItemList({ block, pages, onChange }) {
  const items = block.items ?? [];

  const update = (id, changes) =>
    onChange({
      items: items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    });

  const add = () =>
    onChange({ items: [...items, { id: `i-${items.length}-${Date.now()}`, label: "" }] });

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl bg-white/[0.02] p-3 ring-1 ring-inset ring-white/[0.06]">
          <div className="flex items-center gap-2">
            <TextInput
              value={item.label ?? ""}
              placeholder="Label"
              onChange={(e) => update(item.id, { label: e.target.value })}
            />
            <button
              type="button"
              onClick={() => onChange({ items: items.filter((entry) => entry.id !== item.id) })}
              aria-label="Remove item"
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
            >
              <X className="size-4" />
            </button>
          </div>

          {block.type === "links" && (
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <Select
                value={item.icon ?? ""}
                onChange={(next) => update(item.id, { icon: next })}
                placeholder="Icon…"
                options={ICON_NAMES}
              />
              <Select
                value={item.page ?? ""}
                onChange={(next) => update(item.id, { page: next, url: "" })}
                placeholder="Link to a page…"
                options={pages.map((entry) => ({ value: entry.id, label: entry.label }))}
              />
              <TextInput
                value={item.url ?? ""}
                placeholder="…or an external URL"
                onChange={(e) => update(item.id, { url: e.target.value, page: "" })}
              />
            </div>
          )}

          {block.type === "steps" && (
            <TextArea
              className="mt-2"
              rows={2}
              value={item.body ?? ""}
              placeholder="Detail"
              onChange={(e) => update(item.id, { body: e.target.value })}
            />
          )}

          {block.type === "stats" && (
            <TextInput
              className="mt-2"
              value={item.value ?? ""}
              placeholder="Value"
              onChange={(e) => update(item.id, { value: e.target.value })}
            />
          )}
        </div>
      ))}

      <Button variant="ghost" size="sm" onClick={add}>
        <Plus className="size-4" />
        Add item
      </Button>
    </div>
  );
}
