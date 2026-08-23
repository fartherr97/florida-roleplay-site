/**
 * The content blocks a department page can hold.
 *
 * This is the catalogue the Builder Portal's block editor renders its palette
 * from; src/components/dept/BlockRenderer.jsx is what draws each one. The two
 * lists have to agree — a type here with no renderer would add a block that
 * shows nothing.
 */
export const BLOCK_TYPES = [
  { type: "text", label: "Text", icon: "BookOpen", detail: "A heading and a paragraph." },
  { type: "callout", label: "Callout", icon: "Megaphone", detail: "A highlighted note in the department's accent." },
  { type: "links", label: "Link cards", icon: "LayoutGrid", detail: "A grid of tiles pointing at pages or external sites." },
  { type: "steps", label: "Steps", icon: "ListChecks", detail: "A numbered list — checklists, procedures, onboarding." },
  { type: "stats", label: "Stats", icon: "ChartColumn", detail: "A row of numbers." },
  { type: "image", label: "Image", icon: "Star", detail: "A picture with an optional caption." },
];

export const BLOCK_TYPE_MAP = Object.fromEntries(BLOCK_TYPES.map((b) => [b.type, b]));

/** A fresh block of the given type, ready to drop into a page. */
export function newBlock(type, index) {
  const id = `b-${type}-${index}`;
  switch (type) {
    case "callout":
      return { id, type, title: "Heads up", body: "" };
    case "links":
      return { id, type, kicker: "", title: "Quick access", columns: 4, items: [] };
    case "steps":
      return { id, type, kicker: "", title: "How this works", items: [] };
    case "stats":
      return { id, type, items: [] };
    case "image":
      return { id, type, url: "", alt: "", caption: "" };
    default:
      return { id, type: "text", kicker: "", title: "", body: "" };
  }
}
