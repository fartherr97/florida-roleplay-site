/**
 * The forms and exams the community ships with.
 *
 * A form and an exam are the same document — see src/lib/forms.js. What
 * separates them here is whether the questions carry points and an answer key:
 * the staff promotion exams do, the feedback forms do not, and the civilian
 * certification tests sit in between.
 *
 * `audience` decides which hub lists a form. `submitRoles` and `reviewRoles`
 * name Discord role keys from ROLE_MAP, so who can take an exam follows the
 * roles someone actually holds rather than a separate list to maintain.
 *
 * Mirrored in server/src/formsSeed.js.
 */

export const forms = [];

/**
 * Seed submissions, so the review queue and the response summary render before
 * anyone has actually filled a form in. Graded shapes are computed on read from
 * the same engine the live path uses, rather than hardcoded here — hardcoding
 * them would let the seeds drift away from what the grader actually produces.
 */
export const submissions = [];
