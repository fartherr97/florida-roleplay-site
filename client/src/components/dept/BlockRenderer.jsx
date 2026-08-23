import { createElement } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Info } from "lucide-react";
import Card from "../ui/Card";
import { hubIcon } from "../../lib/hubIcons";
import { safeUrl } from "../../lib/safeUrl";
import { cn } from "../../lib/cn";

/**
 * Renders the content blocks stored on a page's `config.blocks`.
 *
 * Blocks are what make a department's pages editable without a deploy: the
 * Builder Portal's block editor writes this shape, and this file is the only
 * place that knows how each type looks. Adding a type means adding a renderer
 * here and a form in src/pages/dept/builder/BlockEditor.jsx.
 *
 * Every URL a block carries came out of a config someone edited, so links are
 * filtered through src/lib/safeUrl.js before they reach an href.
 */

function BlockHeading({ kicker, title, action }) {
  if (!kicker && !title && !action) return null;
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {kicker && (
          <div className="dept-accent-text text-[11px] font-bold uppercase tracking-[0.18em]">
            {kicker}
          </div>
        )}
        {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}
      </div>
      {action}
    </div>
  );
}

function TextBlock({ block }) {
  return (
    <Card className="p-6">
      <BlockHeading kicker={block.kicker} title={block.title} />
      <p className="whitespace-pre-line text-sm leading-7 text-slate-400">{block.body}</p>
    </Card>
  );
}

function CalloutBlock({ block }) {
  return (
    <div className="dept-accent-ring flex gap-3 rounded-2xl p-5 ring-1 ring-inset bg-white/[0.03]">
      <Info className="dept-accent-text mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">
        {block.title && <div className="mb-1 font-semibold text-white">{block.title}</div>}
        <p className="whitespace-pre-line text-sm leading-7 text-slate-400">{block.body}</p>
      </div>
    </div>
  );
}

// Static class strings so Tailwind's scanner can see every variant. Always 2-up
// on phones; the configured count takes over from sm.
const CARD_COLS = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
};

function LinksBlock({ block, base }) {
  const items = (block.items || []).filter((item) => item.page || safeUrl(item.url));
  if (items.length === 0) return null;

  return (
    <Card className="p-6">
      <BlockHeading kicker={block.kicker} title={block.title} />
      <div className={cn("grid gap-3", CARD_COLS[block.columns] ?? CARD_COLS[4])}>
        {items.map((item) => {
          const icon = createElement(hubIcon(item.icon), { className: "size-5" });
          const inner = (
            <>
              <span className="dept-accent-tile grid size-10 place-items-center rounded-xl ring-1 ring-inset">
                {icon}
              </span>
              <span className="truncate text-sm font-semibold text-slate-200 group-hover:text-white">
                {item.label}
              </span>
            </>
          );
          const className =
            "group flex flex-col items-center gap-2.5 rounded-2xl bg-white/[0.02] p-4 text-center ring-1 ring-inset ring-white/[0.06] transition hover:-translate-y-0.5 hover:bg-white/[0.05]";

          return item.page ? (
            <Link key={item.id} to={`${base}/${item.page}`} className={className}>
              {inner}
            </Link>
          ) : (
            <a
              key={item.id}
              href={safeUrl(item.url)}
              target="_blank"
              rel="noreferrer noopener"
              className={className}
            >
              {inner}
              <ExternalLink className="size-3.5 text-slate-500" />
            </a>
          );
        })}
      </div>
    </Card>
  );
}

function ImageBlock({ block }) {
  const src = safeUrl(block.url);
  if (!src) return null;
  return (
    <figure className="overflow-hidden rounded-2xl ring-1 ring-inset ring-white/[0.06]">
      <img src={src} alt={block.alt || ""} className="w-full object-cover" />
      {block.caption && (
        <figcaption className="bg-white/[0.02] px-4 py-2.5 text-xs text-slate-400">
          {block.caption}
        </figcaption>
      )}
    </figure>
  );
}

function StatsBlock({ block }) {
  const items = block.items || [];
  if (items.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.id} className="p-5">
          <div className="dept-accent-text text-2xl font-extrabold tracking-tight">
            {item.value}
          </div>
          <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            {item.label}
          </div>
        </Card>
      ))}
    </div>
  );
}

function StepsBlock({ block }) {
  const items = block.items || [];
  if (items.length === 0) return null;
  return (
    <Card className="p-6">
      <BlockHeading kicker={block.kicker} title={block.title} />
      <ol className="space-y-4">
        {items.map((item, index) => (
          <li key={item.id} className="flex gap-4">
            <span className="dept-accent-tile grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold ring-1 ring-inset">
              {index + 1}
            </span>
            <div className="min-w-0 pt-1">
              <div className="text-sm font-semibold text-white">{item.label}</div>
              {item.body && (
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-400">
                  {item.body}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

const RENDERERS = {
  text: TextBlock,
  callout: CalloutBlock,
  links: LinksBlock,
  image: ImageBlock,
  stats: StatsBlock,
  steps: StepsBlock,
};

export default function BlockRenderer({ blocks = [], base }) {
  if (blocks.length === 0) return null;
  return (
    <div className="space-y-5">
      {blocks.map((block) => {
        const Renderer = RENDERERS[block.type];
        if (!Renderer) return null;
        return (
          <div key={block.id}>
            <Renderer block={block} base={base} />
          </div>
        );
      })}
    </div>
  );
}
