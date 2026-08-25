/**
 * Seed disciplinary actions, so the DA Hub and `/bgcheck` both render before
 * anybody has filed one and the whole flow is demonstrable with no database.
 *
 * Deliberately spread across bodies, types and dates: one member carries a
 * record that spans the staff team and a department, one action is inside the
 * six-month window and one falls outside it, and one is voided. A seed where
 * every row looks the same shows none of what the background check does.
 *
 * Mirrored from server/src/disciplineSeed.js.
 */


export const ACTIONS = [];
