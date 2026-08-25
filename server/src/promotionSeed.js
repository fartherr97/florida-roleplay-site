/**
 * Promotion board seed — nominations, ballots and the live-visibility rules.
 *
 * An exact copy of client/src/data/promotionData.js; change one and change the
 * other. People and ranks match the staff roster, so the board reads as the same
 * team the rest of the site shows.
 *
 * Dates are relative to load rather than fixed, so the seed always has one vote
 * genuinely open and one genuinely closed — a board where every nomination
 * expired months ago shows none of the states that matter.
 */


/**
 * Who may watch a result before it is published. Senior Admins see moderator
 * votes live but not votes on their own peers; Head Admin sees everything, which
 * is what `promotions.manage` already grants — the rule is here so the intent is
 * visible on the page rather than implied by a permission.
 */
export const visibilityRules = [
  { roleKey: "senior_admin", maxRoleKey: "senior_mod" },
  { roleKey: "head_admin", maxRoleKey: "" },
];

export const votes = [];
