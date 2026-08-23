/**
 * Forms and exams — one engine for both.
 *
 * A form and an exam are the same document: a list of questions with an optional
 * answer key. Set `feedback: true` (or leave every question at zero points) and
 * nothing is graded, which is what makes a survey; set an answer key and a pass
 * threshold and the same document becomes an exam. Building two systems for that
 * would have meant two builders, two renderers and two ways to read the results.
 *
 * Ported from fartherr97/ssrp-department-hub with one change: gating. There, an
 * exam named a permission *group* and a level; here it names Discord role keys
 * and leans on the community's permission catalogue, so form access works the
 * same way every other gate on the site does.
 *
 * Everything here is pure, so the client and the server grade identically.
 * Mirrored at server/src/lib/forms.js.
 */

/* ------------------------------------------------------------------ *
 * Question types
 * ------------------------------------------------------------------ */

/**
 * The question palette. `auto` marks a type that can be machine-graded — some
 * of those (scale, rating, date, time) only auto-grade when an answer key is
 * set, and otherwise behave as survey fields or defer to a reviewer.
 */
export const QUESTION_TYPES = [
  { type: "short", label: "Short answer", auto: true, hasOptions: false },
  { type: "paragraph", label: "Paragraph", auto: false, hasOptions: false },
  { type: "multiple", label: "Multiple choice", auto: true, hasOptions: true },
  { type: "checkboxes", label: "Checkboxes", auto: true, hasOptions: true },
  { type: "dropdown", label: "Dropdown", auto: true, hasOptions: true },
  { type: "truefalse", label: "True / False", auto: true, hasOptions: false },
  { type: "scale", label: "Linear scale", auto: true, hasOptions: false },
  { type: "rating", label: "Rating", auto: true, hasOptions: false },
  { type: "date", label: "Date", auto: true, hasOptions: false },
  { type: "time", label: "Time", auto: true, hasOptions: false },
];

export const QUESTION_TYPE_MAP = Object.fromEntries(
  QUESTION_TYPES.map((entry) => [entry.type, entry]),
);

export function isAutoGradable(type) {
  return QUESTION_TYPE_MAP[type]?.auto ?? false;
}

export function typeHasOptions(type) {
  return QUESTION_TYPE_MAP[type]?.hasOptions ?? false;
}

/* ------------------------------------------------------------------ *
 * Blanks
 * ------------------------------------------------------------------ */

let sequence = 0;

/** Ids only ever have to be unique within one document. */
function localId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  sequence += 1;
  return `${prefix}-${sequence.toString(36)}-${Date.now().toString(36)}`;
}

export function blankQuestion(type = "multiple") {
  const question = { id: localId("q"), type, prompt: "", required: true, points: 1 };

  if (typeHasOptions(type)) {
    question.options = ["Option 1", "Option 2"];
    question.correct = type === "checkboxes" ? [] : "";
  } else if (type === "truefalse") {
    question.correct = "True";
  } else if (type === "short") {
    question.correct = [];
    // "exact" matches one of the accepted answers outright; "keywords" passes
    // when every keyword appears somewhere in the answer.
    question.matchMode = "exact";
  } else if (type === "scale") {
    question.scaleMin = 1;
    question.scaleMax = 5;
    question.minLabel = "";
    question.maxLabel = "";
    question.correct = "";
  } else if (type === "rating") {
    question.ratingMax = 5;
    question.correct = "";
  } else if (type === "date" || type === "time") {
    question.correct = "";
  }

  return question;
}

export function blankForm(audience = "staff") {
  return {
    id: localId("form"),
    audience,
    title: "New form",
    description: "",
    icon: "ClipboardList",
    passThreshold: 80,
    // Role keys from ROLE_MAP. Empty means anyone who can open the hub.
    submitRoles: [],
    // Role keys that may grade this one, on top of anyone holding forms.review.
    reviewRoles: [],
    resourceLinks: [],
    completionMessage: "",
    // No grading: every question becomes a survey field.
    feedback: false,
    // Record no name or Discord id with the response.
    anonymous: false,
    published: false,
    questions: [blankQuestion("multiple")],
  };
}

/** A feedback form scores nothing, so strip the points before grading it. */
export function asFeedbackForm(form) {
  if (!form?.feedback) return form;
  return {
    ...form,
    questions: (form.questions || []).map((question) => ({ ...question, points: 0 })),
  };
}

/* ------------------------------------------------------------------ *
 * Grading
 * ------------------------------------------------------------------ */

const norm = (value) => String(value ?? "").trim().toLowerCase();

/**
 * Grade one answer.
 *
 * `correct` is true/false for anything machine-gradable and null when a human
 * has to decide. `needsReview` is the flag the submissions queue filters on — a
 * paragraph worth points always sets it, and so does any question worth points
 * whose answer key was never filled in, because silently scoring those zero
 * would fail people for the author's omission.
 */
export function gradeAnswer(question, value) {
  const max = Number(question.points) || 0;
  const type = question.type;

  // A zero-point question of any type is a survey field, not something a
  // reviewer needs to look at.
  const survey = { awarded: 0, max: 0, needsReview: false, correct: null };
  const defer = { awarded: 0, max, needsReview: true, correct: null };

  if (type === "paragraph") return max === 0 ? survey : defer;

  if (type === "multiple" || type === "dropdown" || type === "truefalse") {
    const ok = value != null && norm(value) === norm(question.correct);
    return { awarded: ok ? max : 0, max, needsReview: false, correct: ok };
  }

  if (type === "checkboxes") {
    const want = new Set((question.correct || []).map(norm));
    const got = new Set((Array.isArray(value) ? value : []).map(norm));
    const ok = want.size === got.size && [...want].every((entry) => got.has(entry));
    return { awarded: ok ? max : 0, max, needsReview: false, correct: ok };
  }

  if (type === "short") {
    const accepted = (question.correct || []).map(norm).filter(Boolean);
    if (accepted.length === 0) return max === 0 ? survey : defer;
    const answer = norm(value);
    const ok =
      question.matchMode === "keywords"
        ? accepted.every((keyword) => answer.includes(keyword))
        : accepted.some((entry) => entry === answer);
    return { awarded: ok ? max : 0, max, needsReview: false, correct: ok };
  }

  if (type === "scale" || type === "rating" || type === "date" || type === "time") {
    const key = question.correct;
    if (key === undefined || key === null || key === "") return max > 0 ? defer : survey;
    const ok = norm(value) === norm(key);
    return { awarded: ok ? max : 0, max, needsReview: false, correct: ok };
  }

  return { awarded: 0, max, needsReview: false, correct: false };
}

function tally(form, graded) {
  const score = graded.reduce((sum, entry) => sum + entry.awarded, 0);
  const maxScore = graded.reduce((sum, entry) => sum + entry.max, 0);
  const needsReview = graded.some((entry) => entry.needsReview);
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const threshold = Number(form.passThreshold) || 0;
  return {
    graded,
    score,
    maxScore,
    needsReview,
    percent,
    // Nothing was worth points, so there is nothing to pass or fail — a survey
    // is answered, not graded, and calling that "failed" would be wrong.
    status: maxScore === 0
      ? "submitted"
      : needsReview
        ? "needs-review"
        : percent >= threshold
          ? "passed"
          : "failed",
  };
}

/** Grade a whole submission. `answers` is a { questionId: value } map. */
export function gradeSubmission(form, answers = {}) {
  const scored = asFeedbackForm(form);
  return tally(
    scored,
    (scored.questions || []).map((question) => ({
      questionId: question.id,
      ...gradeAnswer(question, answers[question.id]),
    })),
  );
}

/**
 * Recompute a submission after a reviewer has scored the flagged answers.
 * `overrides` is a { questionId: awardedPoints } map, clamped to each
 * question's maximum so a reviewer cannot award more than the question is worth.
 */
export function applyReview(form, submission, overrides = {}) {
  const graded = (submission.graded || []).map((entry) =>
    entry.questionId in overrides
      ? {
          ...entry,
          awarded: Math.max(0, Math.min(entry.max, Number(overrides[entry.questionId]) || 0)),
          needsReview: false,
        }
      : entry,
  );
  return { ...submission, ...tally(form, graded) };
}

/** Required questions with no answer, so the runner can refuse to submit. */
export function missingRequired(form, answers = {}) {
  return (form.questions || [])
    .filter((question) => {
      if (!question.required) return false;
      const value = answers[question.id];
      if (value == null || value === "") return true;
      if (Array.isArray(value) && value.length === 0) return true;
      return false;
    })
    .map((question) => question.id);
}

/* ------------------------------------------------------------------ *
 * Access
 * ------------------------------------------------------------------ */

/**
 * Who may take a form.
 *
 * `forms.manage` always may, so an author can test their own draft before
 * publishing it. Everyone else needs the form published, plus one of its
 * `submitRoles` when it names any — an empty list means "anyone who can open
 * this hub", which is the right default for a whitelist quiz or a feedback form.
 */
export function canTakeForm(form, { roleKeys = [], permissions = new Set() } = {}) {
  if (!form) return false;
  const perms = permissions instanceof Set ? permissions : new Set(permissions);
  if (perms.has("forms.manage")) return true;
  if (!form.published) return false;
  if (!perms.has("forms.submit")) return false;
  if (!form.submitRoles?.length) return true;
  const held = new Set(roleKeys);
  return form.submitRoles.some((role) => held.has(role));
}

/** Who may grade its submissions and see who answered what. */
export function canReviewForm(form, { roleKeys = [], permissions = new Set() } = {}) {
  if (!form) return false;
  const perms = permissions instanceof Set ? permissions : new Set(permissions);
  if (perms.has("forms.manage") || perms.has("forms.review")) return true;
  if (!form.reviewRoles?.length) return false;
  const held = new Set(roleKeys);
  return form.reviewRoles.some((role) => held.has(role));
}

/** Whether the submissions tab is worth showing at all. */
export function canReviewAny(forms, context) {
  return (forms || []).some((form) => canReviewForm(form, context));
}

/* ------------------------------------------------------------------ *
 * Response aggregation
 * ------------------------------------------------------------------ */

/**
 * Roll every submission's answers up per question, so a feedback form can be
 * read as a summary rather than one response at a time. The shape of `summary`
 * depends on the question: choice counts, a numeric distribution, or a list of
 * text answers.
 */
export function aggregateResponses(form, submissions) {
  const rows = (submissions || []).filter(
    (submission) => !submission.deleted && submission.formId === form.id,
  );

  return (form.questions || []).map((question) => {
    const values = rows
      .map((submission) => submission.answers?.[question.id])
      .filter(
        (value) =>
          value != null && value !== "" && !(Array.isArray(value) && value.length === 0),
      );
    const answered = values.length;

    if (["multiple", "dropdown", "truefalse"].includes(question.type)) {
      const options = question.type === "truefalse" ? ["True", "False"] : question.options || [];
      const counts = Object.fromEntries(options.map((option) => [option, 0]));
      values.forEach((value) => {
        counts[value] = (counts[value] || 0) + 1;
      });
      return { question, answered, summary: { kind: "choice", counts, total: answered } };
    }

    if (question.type === "checkboxes") {
      const counts = Object.fromEntries((question.options || []).map((option) => [option, 0]));
      values.forEach((value) => {
        (Array.isArray(value) ? value : []).forEach((option) => {
          counts[option] = (counts[option] || 0) + 1;
        });
      });
      return { question, answered, summary: { kind: "choice", counts, total: answered } };
    }

    if (question.type === "scale" || question.type === "rating") {
      const numbers = values.map(Number).filter((entry) => !Number.isNaN(entry));
      const average = numbers.length
        ? numbers.reduce((sum, entry) => sum + entry, 0) / numbers.length
        : 0;
      const distribution = {};
      numbers.forEach((entry) => {
        distribution[entry] = (distribution[entry] || 0) + 1;
      });
      return {
        question,
        answered,
        summary: {
          kind: "numeric",
          average,
          distribution,
          total: numbers.length,
          min: question.type === "rating" ? 1 : (question.scaleMin ?? 1),
          max: question.type === "rating" ? (question.ratingMax ?? 5) : (question.scaleMax ?? 5),
        },
      };
    }

    return {
      question,
      answered,
      summary: { kind: "text", items: values.map((value) => String(value)) },
    };
  });
}

/** Submission counts for a form's card in the list. */
export function formStats(form, submissions) {
  const rows = (submissions || []).filter((entry) => entry.formId === form.id);
  return {
    total: rows.length,
    needsReview: rows.filter((entry) => entry.status === "needs-review").length,
    passed: rows.filter((entry) => entry.status === "passed").length,
    failed: rows.filter((entry) => entry.status === "failed").length,
  };
}
