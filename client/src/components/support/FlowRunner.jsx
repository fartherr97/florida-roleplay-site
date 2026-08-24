import { useState } from "react";
import { ChevronRight, CornerDownLeft, RotateCcw, Workflow } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Select from "../ui/Select";
import { cn } from "../../lib/cn";
import { fillReply, flowsFor, nodeById } from "../../lib/support";

/**
 * Walking a response flow to compose a reply.
 *
 * The agent answers the follow-ups the flow asks and lands on a reply, which is
 * **inserted into the composer, not sent**. That is the whole safety of the
 * feature: a canned answer that posts itself is how a member gets a reply about
 * the wrong server, and an agent always gets to read and edit first.
 *
 * The trail of answers stays on screen so they can step back one rather than
 * restarting a four-deep tree because they misread a question.
 */
export default function FlowRunner({ flows, ticket, agent, onInsert }) {
  const available = flowsFor(flows, ticket?.type);
  const [flowId, setFlowId] = useState("");
  const [trail, setTrail] = useState([]);

  const flow = available.find((f) => f.id === flowId) ?? null;
  const currentId = trail.length ? trail[trail.length - 1].nextId : flow?.rootId;
  const node = flow ? nodeById(flow, currentId) : null;

  function pick(choice) {
    setTrail((prev) => [...prev, { label: choice.label, nextId: choice.nextId }]);
  }

  function restart() {
    setTrail([]);
  }

  if (!available.length) {
    return (
      <Card className="p-5">
        <p className="flex items-center gap-2 text-sm font-bold text-white">
          <Workflow className="size-4 text-slate-400" />
          Response flows
        </p>
        <p className="mt-2 text-sm text-slate-500">
          None set up for this ticket type yet.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 text-sm font-bold text-white">
        <Workflow className="size-4 text-slate-400" />
        Response flows
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        Answer the questions and it drops the reply into the box. Nothing sends
        until you do.
      </p>

      <div className="mt-4">
        <Select
          value={flowId}
          options={available.map((f) => ({ value: f.id, label: f.name }))}
          placeholder="Pick a flow"
          onChange={(id) => {
            setFlowId(id);
            setTrail([]);
          }}
        />
      </div>

      {trail.length > 0 && (
        <ol className="mt-4 space-y-1">
          {trail.map((step, index) => (
            <li key={index} className="flex items-center gap-1.5 text-xs text-slate-400">
              <ChevronRight className="size-3 shrink-0 text-slate-600" />
              {step.label}
            </li>
          ))}
        </ol>
      )}

      {node && (
        <div className="mt-4">
          {node.type === "prompt" ? (
            <>
              <p className="text-sm font-semibold text-white">{node.label}</p>
              <div className="mt-3 space-y-2">
                {node.choices.map((choice, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => pick(choice)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl bg-black/25 px-3.5 py-2.5 text-left text-sm text-slate-200",
                      "ring-1 ring-inset ring-white/[0.06] transition hover:bg-white/[0.06] hover:text-white",
                    )}
                  >
                    <ChevronRight className="size-4 shrink-0 text-slate-500" />
                    {choice.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                {node.label}
              </p>
              <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-line rounded-xl bg-black/25 p-3.5 text-sm leading-relaxed text-slate-300 ring-1 ring-inset ring-white/[0.06]">
                {fillReply(node.body, ticket, agent)}
              </p>
              <Button
                size="sm"
                className="mt-3 w-full"
                onClick={() => onInsert(fillReply(node.body, ticket, agent))}
              >
                <CornerDownLeft className="size-4" />
                Put it in the box
              </Button>
            </>
          )}
        </div>
      )}

      {trail.length > 0 && (
        <div className="mt-3 flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setTrail((p) => p.slice(0, -1))}>
            Back
          </Button>
          <Button variant="ghost" size="sm" onClick={restart}>
            <RotateCcw className="size-4" />
            Start over
          </Button>
        </div>
      )}
    </Card>
  );
}
