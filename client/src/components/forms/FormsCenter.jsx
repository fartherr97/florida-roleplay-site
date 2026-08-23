import { createElement, useEffect, useMemo, useState } from "react";
import { ClipboardList, Eye, Pencil, Plus } from "lucide-react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import HubPageHeader from "../hub/HubPageHeader";
import FormRunner from "./FormRunner";
import FormBuilder from "./FormBuilder";
import SubmissionReview from "./SubmissionReview";
import ResponseSummary from "./ResponseSummary";
import { useAuth } from "../../context/useAuth";
import { api } from "../../lib/api";
import { blankForm } from "../../lib/forms";
import { hubIcon } from "../../lib/hubIcons";
import { formatDateTime } from "../../lib/format";
import { cn } from "../../lib/cn";

const STATUS_TONES = {
  passed: "green",
  failed: "rose",
  "needs-review": "amber",
  submitted: "brand",
};

const STATUS_LABELS = {
  passed: "Passed",
  failed: "Failed",
  "needs-review": "Needs review",
  submitted: "Submitted",
};

/**
 * The forms and exams centre, shared by both hubs.
 *
 * One component with an `audience` prop rather than a page each: the Staff Hub's
 * promotion exams and the Civilian Hub's certification tests are the same
 * documents run through the same engine, and the only real difference is which
 * ones are listed. Two copies of this would have drifted the first time either
 * side gained a feature.
 *
 * `canTake` and `canReview` come from the API, which resolved them against the
 * caller's Discord roles. Deriving them again here would be a second opinion,
 * and the server's is the one that decides.
 */
export default function FormsCenter({ audience, eyebrow, title, subtitle }) {
  const { hasPermission } = useAuth();
  const [view, setView] = useState({ mode: "list" });
  const [reloadKey, setReloadKey] = useState(0);
  // Stamped with the request it answered, so "still loading" is derived during
  // render rather than set from inside the effect — switching hubs then shows a
  // skeleton instead of the other hub's forms for a frame.
  const [loaded, setLoaded] = useState({ key: null, forms: [], roles: [] });

  const canManage = hasPermission("forms.manage");
  const key = `${audience}:${reloadKey}`;

  useEffect(() => {
    let active = true;
    Promise.all([api.forms(audience), api.rosterRoleMap()]).then(([list, roleMap]) => {
      if (active) setLoaded({ key, forms: list ?? [], roles: roleMap?.roles ?? [] });
    });
    return () => {
      active = false;
    };
  }, [audience, key]);

  const loading = loaded.key !== key;
  const forms = loading ? [] : loaded.forms;
  const roles = loaded.roles;

  const back = () => {
    setView({ mode: "list" });
    setReloadKey((key) => key + 1);
  };

  if (view.mode === "take") {
    return <FormRunner form={view.form} onBack={back} />;
  }
  if (view.mode === "build") {
    return (
      <FormBuilder
        key={view.form.id}
        form={view.form}
        roles={roles}
        onBack={back}
        onSaved={() => setReloadKey((key) => key + 1)}
      />
    );
  }
  if (view.mode === "submissions") {
    return <Submissions form={view.form} onBack={back} />;
  }

  return (
    <>
      <HubPageHeader
        icon="ClipboardList"
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        actions={
          canManage && (
            <Button
              size="sm"
              onClick={() => setView({ mode: "build", form: blankForm(audience) })}
            >
              <Plus className="size-4" />
              New form
            </Button>
          )
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-52 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : forms.length === 0 ? (
        <Card className="p-10 text-center">
          <ClipboardList className="mx-auto size-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">
            There are no forms here yet.
            {canManage && " Use “New form” to build one."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {forms.map((form) => (
            <FormCard
              key={form.id}
              form={form}
              canManage={canManage}
              onTake={() => setView({ mode: "take", form })}
              onReview={() => setView({ mode: "submissions", form })}
              onEdit={() => setView({ mode: "build", form })}
            />
          ))}
        </div>
      )}
    </>
  );
}

function FormCard({ form, canManage, onTake, onReview, onEdit }) {
  const points = (form.questions ?? []).reduce((sum, q) => sum + (Number(q.points) || 0), 0);
  const graded = points > 0 && !form.feedback;

  return (
    <Card className="flex flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-500/15 text-primary-400 ring-1 ring-inset ring-primary-400/20">
          {createElement(hubIcon(form.icon, ClipboardList), { className: "size-5" })}
        </span>
        <div className="flex flex-wrap justify-end gap-1.5">
          {!form.published && <Badge tone="slate">Draft</Badge>}
          {form.anonymous && <Badge tone="brand">Anonymous</Badge>}
          {graded ? <Badge tone="primary">{points} pts</Badge> : <Badge tone="green">Survey</Badge>}
        </div>
      </div>

      <h2 className="mt-4 text-base font-bold text-white">{form.title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{form.description}</p>

      <div className="mt-4 flex items-center gap-3 border-t border-white/[0.06] pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
        <span>{form.questions?.length ?? 0} questions</span>
        {graded && <span>Pass at {form.passThreshold}%</span>}
        {form.canReview && <span className="ml-auto">{form.submissionCount ?? 0} responses</span>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {form.canTake && (
          <Button size="sm" onClick={onTake}>
            {graded ? "Take exam" : "Open form"}
          </Button>
        )}
        {form.canReview && (
          <Button variant="ghost" size="sm" onClick={onReview}>
            <Eye className="size-4" />
            Responses
          </Button>
        )}
        {canManage && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-4" />
            Edit
          </Button>
        )}
        {!form.canTake && !form.canReview && !canManage && (
          <p className="text-xs text-slate-500">
            Your Discord roles don't qualify you for this one yet.
          </p>
        )}
      </div>
    </Card>
  );
}

/** The review queue for one form, with a summary tab beside it. */
function Submissions({ form, onBack }) {
  const [tab, setTab] = useState("queue");
  const [open, setOpen] = useState(null);
  const [loaded, setLoaded] = useState({ formId: null, rows: [] });

  useEffect(() => {
    let active = true;
    api.formSubmissions(form.id).then((rows) => {
      if (active) setLoaded({ formId: form.id, rows: rows ?? [] });
    });
    return () => {
      active = false;
    };
  }, [form.id]);

  const loading = loaded.formId !== form.id;
  const submissions = loading ? [] : loaded.rows;

  /** Apply a saved review in place, so the queue reflects it without a refetch. */
  const patch = (updated) =>
    setLoaded((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
    }));

  // Anything awaiting a human first — that is the whole reason to open a queue.
  const ordered = useMemo(
    () =>
      [...(loading ? [] : loaded.rows)].sort(
        (a, b) =>
          Number(b.needsReview) - Number(a.needsReview) ||
          String(b.at).localeCompare(String(a.at)),
      ),
    [loading, loaded.rows],
  );

  if (open) {
    const current = submissions.find((entry) => entry.id === open) ?? null;
    if (current) {
      return (
        <SubmissionReview
          key={current.id}
          form={form}
          submission={current}
          onBack={() => setOpen(null)}
          onSaved={patch}
        />
      );
    }
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          All forms
        </Button>
        <h1 className="text-lg font-bold tracking-tight text-white">{form.title}</h1>
        <div className="ml-auto flex rounded-xl bg-white/[0.03] p-1 ring-1 ring-inset ring-white/[0.06]">
          {[
            { id: "queue", label: "Responses" },
            { id: "summary", label: "Summary" },
          ].map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                entry.id === tab ? "bg-primary-500 text-white" : "text-slate-400 hover:text-white",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : tab === "summary" ? (
        <ResponseSummary form={form} submissions={submissions} />
      ) : ordered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-slate-400">Nobody has submitted this one yet.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-white/[0.06]">
          {ordered.map((submission) => (
            <button
              key={submission.id}
              type="button"
              onClick={() => setOpen(submission.id)}
              className="flex w-full flex-wrap items-center gap-3 px-5 py-4 text-left transition hover:bg-white/[0.02]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {submission.subject?.name ?? "Anonymous response"}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(submission.at)}</p>
              </div>
              {submission.maxScore > 0 && !submission.needsReview && (
                <span className="text-sm font-bold text-white">{submission.percent}%</span>
              )}
              <Badge tone={STATUS_TONES[submission.status] ?? "slate"}>
                {STATUS_LABELS[submission.status] ?? submission.status}
              </Badge>
            </button>
          ))}
        </Card>
      )}
    </>
  );
}
