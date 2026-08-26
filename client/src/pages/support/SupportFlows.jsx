import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, CornerDownRight, Loader2, MessageSquare, Plus, Trash2 } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import AccessDenied from "../../components/auth/AccessDenied";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { cn } from "../../lib/cn";
import {
  REPLY_VARIABLES,
  blankFlow,
  blankNode,
  nodeById,
  normalizeFlow,
  validateFlow,
} from "../../lib/support";
import { useSupportConfig } from "../../context/useSupportConfig";

/**
 * The flow builder.
 *
 * Rendered as an indented outline rather than a canvas of boxes and arrows. A
 * support tree is three or four deep and every branch ends in text — an outline
 * shows the whole shape on one screen and stays editable on a laptop, which a
 * drag-and-drop canvas does not.
 */
export default function SupportFlows() {
  const { hasPermission } = useAuth();
  const [flows, setFlows] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let active = true;
    api
      .supportFlows()
      .then((result) => {
        if (!active) return;
        const list = (result.flows ?? []).map(normalizeFlow);
        setFlows(list);
        setSelected(list[0]?.id ?? null);
      })
      .catch(() => active && setFlows([]));
    return () => {
      active = false;
    };
  }, []);

  if (!hasPermission("support.manage")) return <AccessDenied reason="role" />;

  const current = (flows ?? []).find((f) => f.id === selected) ?? null;

  function replace(next) {
    setFlows((prev) => prev.map((f) => (f.id === next.id ? next : f)));
  }

  function addFlow() {
    const fresh = normalizeFlow(blankFlow({ name: "New flow" }));
    setFlows((prev) => [...prev, fresh]);
    setSelected(fresh.id);
  }

  return (
    <Section className="max-w-5xl">
      <Button as={Link} to="/support/queue" variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="size-4" />
        Back to the queue
      </Button>

      <PageHeader
        eyebrow="Support"
        title="Response flows"
        subtitle="The branching answers agents walk on a ticket. Each one ends in text they can edit before it sends."
        actions={
          <Button size="sm" onClick={addFlow}>
            <Plus className="size-4" />
            New flow
          </Button>
        }
      />

      {flows === null ? (
        <div className="h-96 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : flows.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-semibold text-white">No flows yet.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
            A flow asks an agent the follow-up questions an answer depends on,
            then hands them the answer.
          </p>
          <Button size="sm" className="mt-5" onClick={addFlow}>
            <Plus className="size-4" />
            Build one
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
          <nav className="space-y-2">
            {flows.map((flow) => (
              <button
                key={flow.id}
                type="button"
                onClick={() => setSelected(flow.id)}
                className={cn(
                  "w-full rounded-xl px-3.5 py-2.5 text-left text-sm ring-1 ring-inset transition",
                  selected === flow.id
                    ? "bg-brand-500/15 text-white ring-brand-400/40"
                    : "bg-black/20 text-slate-400 ring-white/[0.06] hover:text-white",
                )}
              >
                <span className="block truncate font-semibold">{flow.name || "Untitled"}</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {flow.enabled ? "Live" : "Draft"} · {flow.nodes.length} steps
                </span>
              </button>
            ))}
          </nav>

          {current && (
            <FlowEditor
              key={current.id}
              flow={current}
              onChange={replace}
              onDeleted={() => {
                setFlows((prev) => prev.filter((f) => f.id !== current.id));
                setSelected(null);
              }}
            />
          )}
        </div>
      )}
    </Section>
  );
}

function FlowEditor({ flow, onChange, onDeleted }) {
  const { types: ticketTypes } = useSupportConfig();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const problems = useMemo(() => validateFlow(flow), [flow]);
  const blocking = problems.filter((p) => p.level === "error");

  const set = (patch) => {
    onChange({ ...flow, ...patch });
    setStatus(null);
  };

  const setNode = (id, patch) =>
    set({ nodes: flow.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });

  /** Adds a node and points the choice that created it at the new one. */
  function addUnder(parentId, choiceIndex, type) {
    const node = blankNode(type);
    node.label = type === "prompt" ? "Another question" : "Reply";
    const nodes = [...flow.nodes, node];
    onChange({
      ...flow,
      nodes: nodes.map((n) =>
        n.id === parentId
          ? { ...n, choices: n.choices.map((c, i) => (i === choiceIndex ? { ...c, nextId: node.id } : c)) }
          : n,
      ),
    });
  }

  async function save(enabled) {
    const next = enabled === undefined ? flow : { ...flow, enabled };
    setBusy(true);
    setStatus(null);
    try {
      const result = await api.saveSupportFlow(next.id, next);
      if (result?.ok) {
        onChange(normalizeFlow(result.flow ?? next));
        setStatus({ tone: "green", message: result.message ?? "Saved." });
      } else {
        setStatus({ tone: "rose", message: result?.message ?? "That did not save." });
      }
    } catch (err) {
      setStatus({ tone: "rose", message: err?.message ?? "That did not save." });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const result = await api.deleteSupportFlow(flow.id);
    if (result?.ok) onDeleted();
    else setStatus({ tone: "rose", message: result?.message ?? "That did not delete." });
  }

  return (
    <div className="min-w-0 space-y-5">
      <Card className="space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <TextInput value={flow.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Offered on" hint="Leave all unticked to offer it on every ticket type.">
            <div className="flex flex-wrap gap-1.5">
              {ticketTypes.map((type) => {
                const on = flow.ticketTypes.includes(type.id);
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() =>
                      set({
                        ticketTypes: on
                          ? flow.ticketTypes.filter((t) => t !== type.id)
                          : [...flow.ticketTypes, type.id],
                      })
                    }
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition",
                      on ? "bg-brand-500/15 text-white ring-brand-400/40" : "bg-black/20 text-slate-400 ring-white/[0.06]",
                    )}
                  >
                    {type.label}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        <div className="rounded-xl bg-black/20 p-3.5 ring-1 ring-inset ring-white/[0.06]">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400">
            Variables you can use in a reply
          </p>
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
            {REPLY_VARIABLES.map((v) => (
              <span key={v.key}>
                <code className="rounded bg-black/40 px-1.5 py-0.5 text-brand-300">{`{${v.key}}`}</code>{" "}
                {v.detail}
              </span>
            ))}
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <p className="mb-4 text-sm font-bold text-white">The tree</p>
        <NodeOutline
          flow={flow}
          nodeId={flow.rootId}
          depth={0}
          seen={new Set()}
          setNode={setNode}
          addUnder={addUnder}
        />
      </Card>

      {problems.length > 0 && (
        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <AlertTriangle className="size-4 text-amber-400" />
            Before it goes live
          </p>
          <ul className="mt-3 space-y-1.5">
            {problems.map((problem, index) => (
              <li key={index} className="flex gap-2 text-sm">
                <span className={problem.level === "error" ? "text-rose-400" : "text-amber-400"}>
                  {problem.level === "error" ? "✕" : "!"}
                </span>
                <span className="text-slate-300">{problem.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {status && (
        <p className={status.tone === "green" ? "text-sm text-emerald-300" : "text-sm text-rose-300"}>
          {status.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => save()} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Save
        </Button>
        {flow.enabled ? (
          <Button variant="secondary" onClick={() => save(false)} disabled={busy}>
            Take it offline
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => save(true)} disabled={busy || blocking.length > 0}>
            Make it live
          </Button>
        )}
        <Badge tone={flow.enabled ? "green" : "slate"}>{flow.enabled ? "Live" : "Draft"}</Badge>
        <Button variant="ghost" size="sm" onClick={remove} className="ml-auto">
          <Trash2 className="size-4" />
          Delete
        </Button>
      </div>
    </div>
  );
}

/**
 * One node and everything under it.
 *
 * `seen` guards against a cycle — a choice pointing back up the tree would
 * otherwise recurse until the stack gives out. A cycle is legal in the data
 * (an agent can loop back to an earlier question); it just cannot be drawn
 * twice.
 */
function NodeOutline({ flow, nodeId, depth, seen, setNode, addUnder }) {
  const node = nodeById(flow, nodeId);
  if (!node) {
    return (
      <p className="py-2 text-sm text-rose-300" style={{ paddingLeft: depth * 20 }}>
        This branch points at a step that no longer exists.
      </p>
    );
  }
  if (seen.has(nodeId)) {
    return (
      <p className="py-1 text-xs text-slate-500" style={{ paddingLeft: depth * 20 }}>
        ↺ loops back to “{node.label || "Untitled"}”
      </p>
    );
  }
  const nextSeen = new Set(seen).add(nodeId);

  return (
    <div style={{ paddingLeft: depth * 20 }} className="border-l border-white/[0.06] pl-4 first:border-0 first:pl-0">
      <div className="py-2">
        <div className="flex items-center gap-2">
          <Badge tone={node.type === "prompt" ? "brand" : "green"}>
            {node.type === "prompt" ? "Question" : "Reply"}
          </Badge>
          <TextInput
            value={node.label}
            onChange={(e) => setNode(node.id, { label: e.target.value })}
            placeholder={node.type === "prompt" ? "What are you asking the agent?" : "A name for this reply"}
            className="text-sm"
          />
        </div>

        {node.type === "reply" ? (
          <TextArea
            rows={4}
            value={node.body}
            onChange={(e) => setNode(node.id, { body: e.target.value })}
            placeholder="The reply. Use {user} and {agent} for names."
            className="mt-2 text-sm"
          />
        ) : (
          <div className="mt-2 space-y-2">
            {node.choices.map((choice, index) => (
              <div key={index}>
                <div className="flex items-center gap-2">
                  <CornerDownRight className="size-4 shrink-0 text-slate-600" />
                  <TextInput
                    value={choice.label}
                    onChange={(e) =>
                      setNode(node.id, {
                        choices: node.choices.map((c, i) => (i === index ? { ...c, label: e.target.value } : c)),
                      })
                    }
                    placeholder="The answer to this question"
                    className="text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setNode(node.id, { choices: node.choices.filter((_, i) => i !== index) })
                    }
                    aria-label="Remove this choice"
                    className="shrink-0 text-slate-600 transition hover:text-rose-300"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                {choice.nextId ? (
                  <NodeOutline
                    flow={flow}
                    nodeId={choice.nextId}
                    depth={depth + 1}
                    seen={nextSeen}
                    setNode={setNode}
                    addUnder={addUnder}
                  />
                ) : (
                  <div className="flex gap-2 py-2" style={{ paddingLeft: 20 }}>
                    <Button variant="ghost" size="sm" onClick={() => addUnder(node.id, index, "reply")}>
                      <MessageSquare className="size-3.5" />
                      Ends in a reply
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => addUnder(node.id, index, "prompt")}>
                      <Plus className="size-3.5" />
                      Ask another
                    </Button>
                  </div>
                )}
              </div>
            ))}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNode(node.id, { choices: [...node.choices, { label: "", nextId: "" }] })}
            >
              <Plus className="size-3.5" />
              Add an answer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
