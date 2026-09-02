import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Link2,
  Maximize2,
  Minimize2,
  Network,
  Plus,
  DownloadCloud,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import DeptPageHeader from "../../components/dept/DeptPageHeader";
import { useDeptConfig } from "../../context/useDeptConfig";
import { api } from "../../lib/api";
import { cn } from "../../lib/cn";

/**
 * Chain of Command ("chain") — a free-form, editable org chart, replacing the
 * derived tier list. The chart is a tree of boxes, each with a position title,
 * the holder's name, an optional colour and logo, and an optional member list
 * rendered as a column underneath (the Cpl/Trooper rosters at the bottom of an
 * org sheet).
 *
 * Page config shape: { root: node, notes, accent }
 *   node = { id, title, name, color, imageUrl, members: [string], children: [node] }
 *
 * "Import from roster" builds the whole chart from the department's live main
 * roster in one click: command staff chain at the top, one box per assigned
 * leadership rank, and each unit's rank-and-file listed inside its supervisor's
 * box. After that it's yours to arrange — click a box to edit it, drag one onto
 * another (or its edge) to move it, and use the dashed "+" slots to grow it.
 *
 * Editing needs the editStructure capability; a viewer sees it read-only.
 */

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const hasNodeDrag = (e) => Array.from(e.dataTransfer?.types || []).includes("text/coc-node");

function newNode(title = "New Position") {
  // `reportsTo` holds extra parent box ids — the dashed "also reports to" links a
  // box can have on top of its one structural parent (its place in the tree). It
  // is what lets, say, one precinct box sit under two corporals.
  return { id: uid("node"), title, name: "", color: "", imageUrl: "", members: [], children: [], reportsTo: [] };
}

/** Only render an http(s) image URL, so a stray value can't inject anything. */
const safeMediaUrl = (u) => (/^https?:\/\//i.test(String(u || "")) ? u : "");

/** "Master Sergeant - Hotel Troop" → { rank, sub }; no " - " → all rank. */
function splitTitle(title) {
  const i = String(title || "").indexOf(" - ");
  return i >= 0
    ? { rank: title.slice(0, i).trim(), sub: title.slice(i + 3).trim() }
    : { rank: title || "", sub: "" };
}

// ── Auto-import an org chart from the roster ─────────────────────────────────
// Ranks are read as "{Grade} - {Assignment}" (e.g. "Staff Sergeant - Hotel
// Troop") — the grade sets seniority, the assignment sets the unit. Leadership
// grades (Sergeant and up) each get a box, nested under the senior box whose
// assignment shares the most words; rank-and-file grades (Troopers, Officers,
// Corporals…) are listed inside their unit's box, senior-first. Recruits and
// Applicants are left out.

const baseOf = (name) => String(name || "").split(" - ")[0].trim();
const positionOf = (name) => {
  const i = String(name || "").indexOf(" - ");
  return i >= 0 ? name.slice(i + 3).trim().toLowerCase() : "";
};
const familyOf = (grade) => String(grade || "").trim().toLowerCase().split(/\s+/).pop() || "";
const EXEMPT_RE = /\b(recruit|applicant)\b/i;
const LINE_RE = /\b(trooper|officer|deputy|corporal|constable|patrolman|cadet)\b/i;

const GRADE_ABBR = [
  [/master sergeant/i, "M.Sgt."], [/staff sergeant/i, "S.Sgt."], [/sergeant/i, "Sgt."],
  [/master corporal/i, "M.Cpl."], [/senior corporal/i, "Sr.Cpl."], [/corporal/i, "Cpl."],
  [/lt\.?\s*colonel/i, "Lt.Col."], [/colonel/i, "Col."], [/major/i, "Maj."],
  [/captain/i, "Capt."], [/lieutenant/i, "Lt."], [/trooper/i, "Tpr."],
  [/officer/i, "Ofc."], [/deputy/i, "Dep."], [/detective/i, "Det."],
];
function abbrevGrade(grade) {
  for (const [re, ab] of GRADE_ABBR) if (re.test(grade)) return ab;
  return grade;
}

const CONNECTORS = new Set(["and", "the", "of", "for", "a", "an", "to", "at", "in"]);
function positionWords(pos) {
  return new Set(
    String(pos || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1 && !CONNECTORS.has(w)),
  );
}

function bestSeniorFor(seniors, pos) {
  const want = positionWords(pos);
  if (!want.size) return null;
  let best = null;
  let bestScore = 0;
  for (const s of seniors) {
    const have = positionWords(positionOf(s.title));
    let score = 0;
    for (const w of want) if (have.has(w)) score++;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

/**
 * Build the chart from the department's live main roster. `subdivisions` is the
 * projected roster (categories → members with characterName/rank/rankFull);
 * `roleList` is this department's role map, richest first, used to order ranks
 * by seniority.
 */
function buildTreeFromRoster(subdivisions, roleList) {
  const subs = Array.isArray(subdivisions) ? subdivisions : [];
  const sub = subs.find((s) => s.main) || subs[0];
  if (!sub) return { root: null, count: 0, subName: "" };

  // rank name → seniority index (0 = most senior), from the role map order.
  const orderByRank = new Map();
  [...(roleList || [])]
    .sort((a, b) => (b.order ?? 0) - (a.order ?? 0))
    .forEach((r, i) => {
      if (r.rankFull && !orderByRank.has(r.rankFull)) orderByRank.set(r.rankFull, i);
      if (r.rank && !orderByRank.has(r.rank)) orderByRank.set(r.rank, i);
    });

  const people = [];
  for (const cat of sub.categories || [])
    for (const m of cat.members || []) {
      const name = m.characterName || m.name;
      const rankName = m.rankFull || m.rank || "";
      if (!name || !rankName) continue;
      const grade = baseOf(rankName);
      if (!grade || EXEMPT_RE.test(grade)) continue;
      const idx = orderByRank.has(rankName)
        ? orderByRank.get(rankName)
        : orderByRank.has(m.rank)
          ? orderByRank.get(m.rank)
          : Number.MAX_SAFE_INTEGER;
      people.push({
        name,
        grade,
        family: familyOf(grade),
        line: LINE_RE.test(grade),
        assignment: positionOf(rankName),
        idx,
      });
    }
  if (!people.length) return { root: null, count: 0, subName: sub.name };

  for (const p of people) p.unitWords = new Set(positionWords(p.assignment));

  const famBest = new Map();
  for (const p of people) if (!famBest.has(p.family) || p.idx < famBest.get(p.family)) famBest.set(p.family, p.idx);
  const families = [...famBest.entries()].sort((a, b) => a[1] - b[1]).map(([f]) => f);
  const famLevel = new Map(families.map((f, i) => [f, i]));
  const memberLine = (p) => (/trooper/i.test(p.grade) ? p.name : `${abbrevGrade(p.grade)} ${p.name}`);
  const overlap = (a, b) => {
    let n = 0;
    for (const w of a) if (b.has(w)) n++;
    return n;
  };
  const titleCase = (s) => String(s || "").replace(/\b\w/g, (c) => c.toUpperCase());
  const boxTitle = (grade, assignment) => `${grade} - ${titleCase(assignment)}`;

  const mk = (title, name, members = []) => ({
    id: uid("node"), title, name: name || "", color: "", imageUrl: "", members, children: [],
  });

  const leadership = people.filter((p) => !p.line);
  const line = people.filter((p) => p.line);
  let count = 0;

  const command = leadership.filter((p) => !p.assignment).sort((a, b) => a.idx - b.idx);
  let root = null;
  let tail = null;
  for (const p of command) {
    const node = mk(p.grade, p.name);
    count++;
    if (!root) root = node;
    else tail.children.push(node);
    tail = node;
  }
  if (!root) {
    root = mk(sub.name || "Command", "");
    tail = root;
    count = 1;
  }

  const boxByRank = new Map();
  for (const p of leadership.filter((x) => x.assignment)) {
    const key = `${p.grade}|${p.assignment}`;
    let entry = boxByRank.get(key);
    if (!entry) {
      const node = mk(boxTitle(p.grade, p.assignment), p.name);
      entry = { node, assignment: p.assignment, unitWords: p.unitWords, level: famLevel.get(p.family), leaderIdx: p.idx };
      boxByRank.set(key, entry);
      count++;
    } else if (p.idx < entry.leaderIdx) {
      entry.node.members.unshift(memberLine({ ...p }));
      entry.node.name = p.name;
      entry.leaderIdx = p.idx;
    } else {
      entry.node.members.push(memberLine(p));
    }
  }
  const boxes = [...boxByRank.values()];

  const orphans = [];
  for (const p of line.sort((a, b) => a.idx - b.idx)) {
    let best = null;
    let bestScore = 0;
    for (const b of boxes) {
      const s = overlap(p.unitWords, b.unitWords);
      if (s > bestScore || (s === bestScore && s > 0 && best && b.level > best.level)) {
        best = b;
        bestScore = s;
      }
    }
    if (best && bestScore > 0) best.node.members.push(memberLine(p));
    else orphans.push(p);
  }

  const orphanGroups = new Map();
  for (const p of orphans) {
    const key = [...p.unitWords].sort().join(" ") || "unassigned";
    if (!orphanGroups.has(key)) orphanGroups.set(key, []);
    orphanGroups.get(key).push(p);
  }
  for (const [key, list] of orphanGroups) {
    list.sort((a, b) => a.idx - b.idx);
    const leader = list[0];
    const label = key === "unassigned" ? "Unassigned" : key.replace(/\b\w/g, (c) => c.toUpperCase());
    const node = mk(label, leader.name, list.slice(1).map(memberLine));
    boxes.push({ node, assignment: key === "unassigned" ? "" : key, unitWords: leader.unitWords, level: famLevel.get(leader.family), leaderIdx: leader.idx });
    count++;
  }

  boxes.sort((a, b) => a.level - b.level || a.leaderIdx - b.leaderIdx);
  const byLevel = new Map();
  for (const b of boxes) {
    if (!byLevel.has(b.level)) byLevel.set(b.level, []);
    byLevel.get(b.level).push(b);
  }
  let seniors = [tail];
  for (const level of [...byLevel.keys()].sort((a, b) => a - b)) {
    const here = byLevel.get(level);
    for (const b of here) {
      const parent = (seniors.length > 1 ? bestSeniorFor(seniors, b.assignment) : null) || seniors[0] || tail;
      parent.children.push(b.node);
    }
    seniors = here.map((b) => b.node);
  }
  return { root, count, subName: sub.name };
}

// ── Pure tree helpers (immutable, by node id) ────────────────────────────────

function mapTree(node, fn) {
  if (!node) return node;
  const next = fn(node);
  return { ...next, children: (next.children || []).map((c) => mapTree(c, fn)) };
}
function updateNode(root, id, patch) {
  return mapTree(root, (n) => (n.id === id ? { ...n, ...patch } : n));
}
function addChild(root, id, child, position = "end") {
  return mapTree(root, (n) =>
    n.id === id
      ? { ...n, children: position === "start" ? [child, ...(n.children || [])] : [...(n.children || []), child] }
      : n,
  );
}
function deleteNode(root, id) {
  if (!root || root.id === id) return null;
  const prune = (n) => ({ ...n, children: (n.children || []).filter((c) => c.id !== id).map(prune) });
  return prune(root);
}
function moveNode(root, id, dir) {
  return mapTree(root, (n) => {
    const kids = n.children || [];
    const i = kids.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= kids.length) return n;
    const next = [...kids];
    [next[i], next[j]] = [next[j], next[i]];
    return { ...n, children: next };
  });
}
function countNodes(node) {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((s, c) => s + countNodes(c), 0);
}
function findNode(root, id) {
  if (!root) return null;
  if (root.id === id) return root;
  for (const c of root.children || []) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return null;
}
function isDescendant(node, id) {
  if (!node) return false;
  if (node.id === id) return true;
  return (node.children || []).some((c) => isDescendant(c, id));
}
function moveNodeTo(root, dragId, targetId, mode) {
  if (!root || dragId === targetId || root.id === dragId) return root;
  const dragNode = findNode(root, dragId);
  if (!dragNode || isDescendant(dragNode, targetId)) return root;

  let moved = null;
  const prune = (n) => ({
    ...n,
    children: (n.children || [])
      .filter((c) => {
        if (c.id === dragId) {
          moved = c;
          return false;
        }
        return true;
      })
      .map(prune),
  });
  const stripped = prune(root);
  if (!moved) return root;

  let result;
  if (mode === "child") {
    result = mapTree(stripped, (n) => (n.id === targetId ? { ...n, children: [...(n.children || []), moved] } : n));
  } else {
    result = mapTree(stripped, (n) => {
      const kids = n.children || [];
      const i = kids.findIndex((c) => c.id === targetId);
      if (i === -1) return n;
      const next = [...kids];
      next.splice(mode === "before" ? i : i + 1, 0, moved);
      return { ...n, children: next };
    });
  }
  return findNode(result, dragId) ? result : root;
}

/** Every node, flattened, with a label for the "also reports to" picker. */
function flattenNodes(node, out = []) {
  if (!node) return out;
  out.push(node);
  (node.children || []).forEach((c) => flattenNodes(c, out));
  return out;
}

/** The id of a node's structural (tree) parent, or null for the root. */
function parentIdOf(root, id, parent = null) {
  if (!root) return null;
  if (root.id === id) return parent;
  for (const c of root.children || []) {
    const hit = parentIdOf(c, id, root.id);
    if (hit !== null) return hit;
  }
  return null;
}

/** Every id in the tree, so a dangling reportsTo can be dropped after a delete. */
function collectIds(node, set = new Set()) {
  if (!node) return set;
  set.add(node.id);
  (node.children || []).forEach((c) => collectIds(c, set));
  return set;
}

/**
 * Drops secondary-parent links that no longer make sense: an id not in the tree
 * (its box was deleted), a box pointing at itself, or at its own structural
 * parent (which the solid tree line already shows) or one of its descendants
 * (which would draw a line back down into itself). Keeps the data honest so the
 * overlay never renders a stray line.
 */
function sanitizeReportsTo(root) {
  if (!root) return root;
  const ids = collectIds(root);
  const clean = (node) => {
    const structuralParent = parentIdOf(root, node.id);
    const descendants = collectIds(node); // includes self
    const reportsTo = [...new Set(node.reportsTo || [])].filter(
      (pid) => ids.has(pid) && pid !== structuralParent && !descendants.has(pid),
    );
    return { ...node, reportsTo, children: (node.children || []).map(clean) };
  };
  return clean(root);
}

// ── Rendering ────────────────────────────────────────────────────────────────

function NodeCard({ node, accent, canEdit, isRoot, onEdit, dropHint, setDropHint, onDropNode, canDropOn, setDragId }) {
  const color = node.color || accent;
  const myHint = dropHint?.targetId === node.id ? dropHint.mode : null;

  const zoneFor = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (isRoot) return "child";
    if (x < 0.3) return "before";
    if (x > 0.7) return "after";
    return "child";
  };

  const hintStyle =
    myHint === "before"
      ? { boxShadow: "inset 4px 0 0 0 var(--color-primary)" }
      : myHint === "after"
        ? { boxShadow: "inset -4px 0 0 0 var(--color-primary)" }
        : myHint === "child"
          ? { boxShadow: "inset 0 0 0 2px var(--color-primary)" }
          : undefined;

  const { rank, sub } = splitTitle(node.title || "Untitled");

  return (
    <button
      type="button"
      data-coc-id={node.id}
      disabled={!canEdit}
      onClick={() => onEdit(node)}
      title={canEdit ? "Click to edit. Drag onto another box to move under it, or to a box's edge to slot beside it." : undefined}
      draggable={canEdit && !isRoot}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/coc-node", node.id);
        setDragId(node.id);
      }}
      onDragEnd={() => {
        setDragId(null);
        setDropHint(null);
      }}
      onDragOver={(e) => {
        if (!canEdit || !hasNodeDrag(e) || !canDropOn(node.id)) return;
        e.preventDefault();
        const mode = zoneFor(e);
        if (myHint !== mode) setDropHint({ targetId: node.id, mode });
      }}
      onDragLeave={() => {
        if (myHint) setDropHint(null);
      }}
      onDrop={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        const dragId = e.dataTransfer.getData("text/coc-node");
        if (dragId) onDropNode(dragId, node.id, zoneFor(e));
      }}
      style={{
        borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 12%, var(--color-surface-2))`,
        ...hintStyle,
      }}
      className={cn(
        "relative w-44 rounded-lg border px-2 py-1.5 text-center transition",
        canEdit ? "cursor-pointer hover:brightness-125" : "cursor-default",
      )}
    >
      <div className="truncate text-[11px] font-bold uppercase tracking-wide" style={{ color }} title={node.title}>
        {rank || "Untitled"}
      </div>
      {sub && (
        <div
          className="break-words text-[10px] font-semibold uppercase leading-tight tracking-wide"
          style={{ color: `color-mix(in srgb, ${color} 78%, #94a3b8)` }}
          title={node.title}
        >
          {sub}
        </div>
      )}
      {node.name && (
        <div className="truncate text-[13px] font-bold text-white" title={node.name}>
          {node.name}
        </div>
      )}
    </button>
  );
}

function MemberColumn({ members, color: colorProp, accent }) {
  const list = (members || []).filter(Boolean);
  if (!list.length) return null;
  const color = colorProp || accent;
  return (
    <div className="mt-1.5 grid w-44 gap-1">
      {list.map((m, i) => (
        <div
          key={i}
          style={{ borderColor: `color-mix(in srgb, ${color} 30%, transparent)` }}
          className="truncate rounded-md border bg-white/[0.03] px-2 py-1 text-center text-xs text-slate-300"
          title={m}
        >
          {m}
        </div>
      ))}
    </div>
  );
}

function SlotButton({ title, dragging, valid, hinted, setHint, onDropId, onAdd, compact = false }) {
  if (dragging && valid) {
    const dnd = {
      onDragOver: (e) => {
        if (!hasNodeDrag(e)) return;
        e.preventDefault();
        if (!hinted) setHint(true);
      },
      onDragLeave: () => hinted && setHint(false),
      onDrop: (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = e.dataTransfer.getData("text/coc-node");
        if (id) onDropId(id);
      },
    };
    if (compact) {
      return (
        <button
          type="button"
          title="Drop here"
          {...dnd}
          className={cn(
            "flex size-9 items-center justify-center rounded-full border border-dashed bg-[var(--color-surface-1)] transition",
            hinted ? "scale-110 border-primary-400 bg-primary-500/20 text-primary-300" : "border-white/30 text-slate-400",
          )}
        >
          <Plus size={14} />
        </button>
      );
    }
    return (
      <button
        type="button"
        {...dnd}
        className={cn(
          "flex h-[42px] w-44 items-center justify-center gap-1.5 rounded-lg border border-dashed bg-[var(--color-surface-1)] text-xs font-semibold transition",
          hinted ? "border-primary-400 bg-primary-500/15 text-primary-300" : "border-white/25 text-slate-400",
        )}
      >
        <Plus size={13} />
        {hinted ? "Move here" : "Drop here"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onAdd}
      title={title}
      className={cn(
        "mt-0.5 flex size-6 items-center justify-center rounded-full border border-dashed bg-[var(--color-surface-1)] transition",
        dragging ? "border-white/10 text-slate-700" : "border-white/25 text-slate-500 hover:border-white/40 hover:text-primary-300",
      )}
    >
      <Plus size={12} />
    </button>
  );
}

function NodeTree({ node, accent, canEdit, isRoot = true, onEdit, onAddChild, dropHint, setDropHint, onDropNode, canDropOn, setDragId, dragId }) {
  const children = node.children || [];
  const total = children.length;
  const showRow = total > 0 || canEdit;
  const rails = (i) =>
    total > 1 ? (
      <>
        {i > 0 && <span className="absolute left-0 top-0 h-px w-1/2 bg-white/15" />}
        {i < total - 1 && <span className="absolute right-0 top-0 h-px w-1/2 bg-white/15" />}
      </>
    ) : null;

  return (
    <div className="flex flex-col items-center">
      {safeMediaUrl(node.imageUrl) && (
        <img
          src={safeMediaUrl(node.imageUrl)}
          alt={node.title}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          className="mb-1.5 size-14 object-contain"
        />
      )}
      <NodeCard
        node={node}
        accent={accent}
        canEdit={canEdit}
        isRoot={isRoot}
        onEdit={onEdit}
        dropHint={dropHint}
        setDropHint={setDropHint}
        onDropNode={onDropNode}
        canDropOn={canDropOn}
        setDragId={setDragId}
      />
      <MemberColumn members={node.members} color={node.color} accent={accent} />
      {showRow && (
        <>
          <span className="h-3 w-px bg-white/15" />
          <div className="group/kids flex items-start">
            {canEdit && total > 1 && (
              <div className="relative w-0 self-stretch">
                <div className={cn("absolute right-1 top-2 z-10 transition-opacity", dragId ? "opacity-100" : "opacity-0 group-hover/kids:opacity-100")}>
                  <SlotButton
                    title={`Add a box under “${node.title}” (left side)`}
                    dragging={Boolean(dragId)}
                    valid={!dragId || canDropOn(children[0].id)}
                    hinted={dropHint?.targetId === node.id && dropHint?.mode === "slot-start"}
                    setHint={(on) => setDropHint(on ? { targetId: node.id, mode: "slot-start" } : null)}
                    onDropId={(id) => onDropNode(id, children[0].id, "before")}
                    onAdd={() => onAddChild(node.id, "start")}
                    compact
                  />
                </div>
              </div>
            )}
            {children.map((child, i) => (
              <div key={child.id} className="relative flex flex-col items-center px-1.5">
                {rails(i)}
                <span className="h-3 w-px bg-white/15" />
                <NodeTree
                  node={child}
                  accent={accent}
                  canEdit={canEdit}
                  isRoot={false}
                  onEdit={onEdit}
                  onAddChild={onAddChild}
                  dropHint={dropHint}
                  setDropHint={setDropHint}
                  onDropNode={onDropNode}
                  canDropOn={canDropOn}
                  setDragId={setDragId}
                  dragId={dragId}
                />
              </div>
            ))}
            {canEdit && total > 0 && (
              <div className="relative w-0 self-stretch">
                <div className={cn("absolute left-1 top-2 z-10 transition-opacity", dragId ? "opacity-100" : "opacity-0 group-hover/kids:opacity-100")}>
                  <SlotButton
                    title={`Add a box under “${node.title}”`}
                    dragging={Boolean(dragId)}
                    valid={!dragId || canDropOn(node.id)}
                    hinted={dropHint?.targetId === node.id && dropHint?.mode === "slot"}
                    setHint={(on) => setDropHint(on ? { targetId: node.id, mode: "slot" } : null)}
                    onDropId={(id) => onDropNode(id, node.id, "child")}
                    onAdd={() => onAddChild(node.id, "end")}
                    compact
                  />
                </div>
              </div>
            )}
            {canEdit && total === 0 && (
              <div className="flex flex-col items-center px-1.5">
                <span className="h-3 w-px bg-white/15" />
                <SlotButton
                  title={`Add a box under “${node.title}”`}
                  dragging={Boolean(dragId)}
                  valid={!dragId || canDropOn(node.id)}
                  hinted={dropHint?.targetId === node.id && dropHint?.mode === "slot"}
                  setHint={(on) => setDropHint(on ? { targetId: node.id, mode: "slot" } : null)}
                  onDropId={(id) => onDropNode(id, node.id, "child")}
                  onAdd={() => onAddChild(node.id, "end")}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Box editor ───────────────────────────────────────────────────────────────

function NodeModal({ node, isRoot, allBoxes = [], onClose, onSave, onAddChild, onMove, onDelete }) {
  const [draft, setDraft] = useState(node);
  const membersText = (draft.members || []).join("\n");
  const reportsTo = draft.reportsTo || [];

  const boxLabel = (b) => {
    const { rank } = splitTitle(b.title || "Box");
    return b.name ? `${rank} · ${b.name}` : rank || "Box";
  };
  const toggleReport = (id) =>
    setDraft({
      ...draft,
      reportsTo: reportsTo.includes(id) ? reportsTo.filter((x) => x !== id) : [...reportsTo, id],
    });

  return (
    <Modal open onClose={onClose} title={`Edit “${node.title || "box"}”`} className="max-w-xl">
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Position title" hint="e.g. Patrol Lieutenant, or “Sergeant - Hotel Troop”.">
            <TextInput
              value={draft.title || ""}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              autoFocus
            />
          </Field>
          <Field label="Name(s)" hint="Who holds it, e.g. J. Welch. Blank shows just the title.">
            <TextInput value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
        </div>
        <Field label="Box colour" hint="Blank uses the department accent.">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={draft.color || "#3b82f6"}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              aria-label="Box colour"
              className="h-11 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent"
            />
            <TextInput
              value={draft.color || ""}
              placeholder="Accent"
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              className="h-11 font-mono"
            />
            {draft.color && (
              <Button variant="ghost" size="sm" onClick={() => setDraft({ ...draft, color: "" })}>
                Clear
              </Button>
            )}
          </div>
        </Field>
        <Field label="Logo / insignia URL" hint="Optional. Shows above the box — a unit patch or badge.">
          <TextInput
            value={draft.imageUrl || ""}
            placeholder="https://…"
            onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value.trim() })}
          />
        </Field>
        <Field label="Member list" hint="Optional, one per line — shows as a column under the box.">
          <TextArea
            rows={4}
            value={membersText}
            placeholder={"Cpl. D. Smith\nN. Brown\nJ. Carter"}
            onChange={(e) => setDraft({ ...draft, members: e.target.value.split("\n") })}
          />
        </Field>

        {allBoxes.length > 0 && (
          <Field
            label="Also reports to"
            hint="Extra supervisors above this box, drawn as dashed lines on top of its normal place in the chart. Use it when one box answers to more than one — e.g. a precinct under two corporals."
          >
            <div className="flex flex-wrap gap-1.5">
              {allBoxes.map((b) => {
                const on = reportsTo.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleReport(b.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                      on
                        ? "border-primary-400/50 bg-primary-500/15 text-primary-200"
                        : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/25 hover:text-slate-200",
                    )}
                  >
                    <Link2 className="size-3" />
                    {boxLabel(b)}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        <div className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-3">
          <Button variant="ghost" size="sm" onClick={() => onAddChild(draft)}>
            <Plus className="size-4" />
            Add box below
          </Button>
          <Button variant="ghost" size="sm" disabled={isRoot} onClick={() => onMove(-1)}>
            ← Move left
          </Button>
          <Button variant="ghost" size="sm" disabled={isRoot} onClick={() => onMove(1)}>
            Move right →
          </Button>
          <p className="text-xs text-slate-500 sm:col-span-3">
            “Add box below” saves this box and creates a new one reporting to it. Deleting a box also
            deletes everything under it{isRoot ? ", including the whole chart" : ""}.
          </p>
        </div>
      </div>
      <div className="mt-5 flex justify-between gap-2">
        <Button variant="danger" size="sm" onClick={onDelete}>
          Delete box
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={!draft.title?.trim()} onClick={() => onSave(draft)}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DeptChain({ page, config }) {
  const { id, can, savePage } = useDeptConfig();
  const canEdit = can("editStructure");
  const cfg = page.config || {};
  const accent = cfg.accent || "var(--dept-accent)";

  // The live roster and role map power "Import from roster".
  const [roster, setRoster] = useState({ subdivisions: [], roles: [] });
  useEffect(() => {
    let active = true;
    Promise.all([api.deptRoster(id), api.rosterRoleMap()]).then(([r, rm]) => {
      if (!active) return;
      setRoster({
        subdivisions: r?.subdivisions ?? [],
        roles: (rm?.roles ?? []).filter((role) => role.department === id),
      });
    });
    return () => {
      active = false;
    };
  }, [id]);

  // A local, editable copy of the tree so drags and edits feel instant; each
  // change is persisted with a debounced savePage, flushed on unmount.
  const [root, setRoot] = useState(() => cfg.root || null);
  const [notes, setNotes] = useState(cfg.notes || "");
  const pending = useRef(null);
  const timer = useRef(null);
  const flushRef = useRef(null);
  const flush = () => {
    clearTimeout(timer.current);
    if (!pending.current) return;
    const next = pending.current;
    pending.current = null;
    savePage(page.id, next).catch(() => {});
  };
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => () => flushRef.current?.(), []);
  const commit = (patch, { immediate = false } = {}) => {
    const next = { ...cfg, root, notes, ...patch };
    if ("root" in patch) setRoot(patch.root);
    if ("notes" in patch) setNotes(patch.notes);
    pending.current = next;
    clearTimeout(timer.current);
    if (immediate) flush();
    else timer.current = setTimeout(flush, 500);
  };
  // Sanitising on every write keeps secondary "reports to" links honest — a link
  // to a box that was just deleted or moved under this one is dropped here rather
  // than lingering as a stray line.
  const setTree = (next, immediate = true) => commit({ root: sanitizeReportsTo(next) }, { immediate });

  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmImport, setConfirmImport] = useState(null);
  const [dropHint, setDropHint] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const panRef = useRef(null);
  const contentRef = useRef(null);
  const panState = useRef(null);
  const fsRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [links, setLinks] = useState({ w: 0, h: 0, segs: [] });

  // The boxes a box may add as extra parents: every other box except itself, its
  // own subtree (a line back down into itself), and its structural parent (whose
  // solid line already shows the relationship).
  const editBoxes = useMemo(() => {
    if (!editing || !root) return [];
    const structuralParent = parentIdOf(root, editing.id);
    const own = collectIds(findNode(root, editing.id) || { id: editing.id });
    return flattenNodes(root)
      .filter((b) => !own.has(b.id) && b.id !== structuralParent)
      .map((b) => ({ id: b.id, title: b.title, name: b.name }));
  }, [editing, root]);

  // Measure the boxes and lay the dashed "also reports to" lines over the chart.
  // Coordinates are in the scroll container's own content space, so the overlay
  // scrolls with the chart and needs no re-measure on pan — only on a layout
  // change (a box added/moved, zoom, fullscreen, a resize, an image loading).
  useLayoutEffect(() => {
    const panEl = panRef.current;
    if (!panEl) return undefined;
    let raf = 0;
    const measure = () => {
      const base = panEl.getBoundingClientRect();
      const rects = new Map();
      panEl.querySelectorAll("[data-coc-id]").forEach((el) => {
        const r = el.getBoundingClientRect();
        rects.set(el.getAttribute("data-coc-id"), {
          left: r.left - base.left + panEl.scrollLeft,
          top: r.top - base.top + panEl.scrollTop,
          w: r.width,
          h: r.height,
        });
      });
      const segs = [];
      flattenNodes(root).forEach((n) => {
        (n.reportsTo || []).forEach((pid) => {
          const p = rects.get(pid);
          const c = rects.get(n.id);
          if (!p || !c) return;
          segs.push({ x1: p.left + p.w / 2, y1: p.top + p.h, x2: c.left + c.w / 2, y2: c.top });
        });
      });
      setLinks({ w: panEl.scrollWidth, h: panEl.scrollHeight, segs });
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    schedule();
    const ro = contentRef.current ? new ResizeObserver(schedule) : null;
    if (ro && contentRef.current) ro.observe(contentRef.current);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [root, zoom, isFullscreen]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === fsRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else fsRef.current?.requestFullscreen?.();
  };
  useEffect(() => {
    const el = panRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const step = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(1.5, Math.max(0.4, +(z + step).toFixed(2))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const canDropOn = (targetId) =>
    Boolean(dragId) && dragId !== targetId && !isDescendant(findNode(root, dragId), targetId);

  const cleanMembers = (draft) => ({
    ...draft,
    members: (draft.members || []).map((m) => m.trim()).filter(Boolean),
  });

  function saveNode(draft) {
    setTree(updateNode(root, draft.id, cleanMembers(draft)));
    setEditing(null);
  }
  function addBelow(draft) {
    const child = newNode();
    setTree(addChild(updateNode(root, draft.id, cleanMembers(draft)), draft.id, child));
    setEditing(child);
  }
  function addChildTo(nodeId, position = "end") {
    const child = newNode();
    setTree(addChild(root, nodeId, child, position));
    setEditing(child);
  }
  function handleDropNode(dId, targetId, mode) {
    setDropHint(null);
    setTree(moveNodeTo(root, dId, targetId, mode));
  }
  function move(dir) {
    setTree(moveNode(root, editing.id, dir));
  }
  function importFromRoster() {
    const built = buildTreeFromRoster(roster.subdivisions, roster.roles);
    if (!built.root) return;
    if (root) {
      setConfirmImport(built);
    } else {
      setTree(built.root);
      setZoom(0.4);
    }
  }

  return (
    <div>
      <DeptPageHeader
        icon={page.icon}
        eyebrow={config.branding.shortName}
        title={page.label}
        subtitle={
          canEdit
            ? "Use the dashed “Add box” slots to grow the chart, click a box to edit it, or drag one onto another box (or its edge) to move it."
            : "Who reports to whom, from the top down."
        }
        actions={
          canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={importFromRoster}>
                <DownloadCloud className="size-4" />
                Import from roster
              </Button>
              {!root && (
                <Button
                  size="sm"
                  onClick={() => {
                    const r = newNode("Colonel");
                    setTree(r);
                    setEditing(r);
                  }}
                >
                  <Plus className="size-4" />
                  Start blank
                </Button>
              )}
            </div>
          ) : null
        }
      />

      {!root ? (
        <Card className="p-10 text-center">
          <Network size={32} className="mx-auto mb-3 text-slate-500" />
          <div className="text-base font-semibold text-slate-200">No chain of command yet</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Import the whole thing from the main roster in one click, or start with the top position
            and build down.
          </p>
          {canEdit && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={importFromRoster}>
                <DownloadCloud className="size-4" />
                Import from roster
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const r = newNode("Colonel");
                  setTree(r);
                  setEditing(r);
                }}
              >
                <Plus className="size-4" />
                Start blank
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <Card className="relative overflow-hidden p-0">
          <div ref={fsRef} className="relative" style={isFullscreen ? { background: "var(--color-surface-1)", padding: "1rem" } : undefined}>
            <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-xl border border-white/10 bg-[var(--color-surface-1)]/95 p-1">
              <IconButton icon={ZoomOut} label="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} />
              <button
                onClick={() => setZoom(1)}
                title="Reset zoom"
                className="w-10 text-center text-[11px] font-bold text-slate-400 transition hover:text-white"
              >
                {Math.round(zoom * 100)}%
              </button>
              <IconButton icon={ZoomIn} label="Zoom in" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))} />
              <IconButton
                icon={isFullscreen ? Minimize2 : Maximize2}
                label={isFullscreen ? "Exit full screen" : "Full screen"}
                onClick={toggleFullscreen}
              />
              <span className="hidden whitespace-nowrap px-1.5 text-[10px] font-semibold text-slate-500 lg:block">
                drag to pan · Ctrl+scroll zooms
              </span>
            </div>

            <div
              ref={panRef}
              onMouseDown={(e) => {
                if (e.button !== 1 && (e.button !== 0 || e.target.closest("button, img, input"))) return;
                e.preventDefault();
                panState.current = { x: e.clientX, y: e.clientY, sl: panRef.current.scrollLeft, st: panRef.current.scrollTop };
              }}
              onMouseMove={(e) => {
                const ps = panState.current;
                if (!ps) return;
                panRef.current.scrollLeft = ps.sl - (e.clientX - ps.x);
                panRef.current.scrollTop = ps.st - (e.clientY - ps.y);
              }}
              onMouseUp={() => (panState.current = null)}
              onMouseLeave={() => (panState.current = null)}
              className={cn(
                "relative cursor-grab select-none overflow-auto p-6 active:cursor-grabbing",
                isFullscreen ? "h-full max-h-none" : "max-h-[72vh]",
              )}
            >
              {links.segs.length > 0 && (
                <svg
                  className="pointer-events-none absolute left-0 top-0 z-0"
                  width={links.w}
                  height={links.h}
                  style={{ overflow: "visible" }}
                  aria-hidden="true"
                >
                  <defs>
                    <marker id="coc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M0,0 L10,5 L0,10 z" fill={accent} />
                    </marker>
                  </defs>
                  {links.segs.map((s, i) => {
                    const midY = (s.y1 + s.y2) / 2;
                    return (
                      <path
                        key={i}
                        d={`M ${s.x1} ${s.y1} C ${s.x1} ${midY}, ${s.x2} ${midY}, ${s.x2} ${s.y2}`}
                        fill="none"
                        stroke={accent}
                        strokeWidth="1.5"
                        strokeDasharray="5 4"
                        strokeOpacity="0.8"
                        markerEnd="url(#coc-arrow)"
                      />
                    );
                  })}
                </svg>
              )}
              <div ref={contentRef} style={{ zoom }} className="relative z-[1] mx-auto w-max">
                <NodeTree
                  node={root}
                  accent={accent}
                  canEdit={canEdit}
                  onEdit={setEditing}
                  onAddChild={addChildTo}
                  dropHint={dropHint}
                  setDropHint={setDropHint}
                  onDropNode={handleDropNode}
                  canDropOn={canDropOn}
                  setDragId={setDragId}
                  dragId={dragId}
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {(notes || (canEdit && root)) && (
        <Card className="mt-4 p-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Notes</div>
          {canEdit ? (
            <TextArea
              rows={2}
              value={notes}
              placeholder="e.g. Contact your direct supervisor first, then move up the chain…"
              onChange={(e) => commit({ notes: e.target.value })}
            />
          ) : (
            <p className="whitespace-pre-line text-sm leading-6 text-slate-300">{notes}</p>
          )}
        </Card>
      )}

      {editing && (
        <NodeModal
          key={editing.id}
          node={editing}
          isRoot={root?.id === editing.id}
          allBoxes={editBoxes}
          onClose={() => setEditing(null)}
          onSave={saveNode}
          onAddChild={addBelow}
          onMove={move}
          onDelete={() => {
            setConfirmDelete(editing);
            setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(null)} title="Delete this box?" className="max-w-md">
          <p className="text-sm text-slate-300">
            {root?.id === confirmDelete.id
              ? "This is the top of the chart — deleting it removes the entire chain of command."
              : `Delete "${confirmDelete.title}" and the ${Math.max(0, countNodes(confirmDelete) - 1)} box(es) under it?`}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setTree(deleteNode(root, confirmDelete.id));
                setConfirmDelete(null);
              }}
            >
              Delete
            </Button>
          </div>
        </Modal>
      )}

      {confirmImport && (
        <Modal open onClose={() => setConfirmImport(null)} title="Import from roster?" className="max-w-lg">
          <p className="text-sm text-slate-300">
            Replace the current chart with {confirmImport.count || 0} boxes built from{" "}
            {confirmImport.subName || "the roster"}: everyone down to Trooper (Recruits and Applicants
            left out), with each unit's rank-and-file listed inside its supervisor's box. Units are
            nested where their names line up; drag boxes to arrange the rest.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmImport(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setTree(confirmImport.root);
                setZoom(0.4);
                setConfirmImport(null);
              }}
            >
              Import &amp; replace
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** A small square icon button for the zoom / fullscreen controls. */
function IconButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
    >
      <Icon size={15} />
    </button>
  );
}
