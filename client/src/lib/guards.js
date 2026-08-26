/**
 * Which permission each gated route needs.
 *
 * Routes name a permission, never a rank. src/data/permissions.js maps that
 * permission onto Discord roles, and the configuration page edits that mapping —
 * so access changes without touching this file or shipping a deploy.
 *
 * The server enforces the same permission on the matching endpoint. Hiding a
 * link is a convenience; the API is the boundary.
 */
import { matchPath } from "react-router-dom";

/** Matched with `end: true`, so each entry gates exactly its own path. */
export const GUARDS = [
  // Public site
  { path: "/image-host", permission: "media.upload" },
  { path: "/staff", permission: "site.staff_directory" },
  { path: "/staff/moderation", permission: "site.moderation" },
  { path: "/staff/support", permission: "site.support" },
  { path: "/management/leadership", permission: "site.leadership" },
  {
    path: "/management/department-heads",
    permission: "site.department_heads",
    reason: "department",
  },

  // Staff Hub
  { path: "/staff-hub/home", permission: "staff.view" },
  { path: "/staff-hub/roster", permission: "staff.view" },
  // The forms themselves need forms.view, but this page lists the staff ones —
  // so it takes the same permission as the rest of the Staff Hub.
  { path: "/staff-hub/forms", permission: "staff.view" },
  { path: "/staff-hub/promotion-board", permission: "promotions.view" },
  { path: "/staff-hub/dashboard", permission: "staff.view" },
  { path: "/staff-hub/trial-checklist", permission: "staff.view" },
  { path: "/staff-hub/resources", permission: "staff.view" },
  // Anybody who can open the Staff Hub can reach the DA Hub to file against their
  // own department, and the API decides which bodies they may file for. Reading
  // everybody else's record and running a background check is the separate,
  // stricter `discipline.view` grant the API enforces — the lookup surface on the
  // page hides itself when the caller lacks it.
  { path: "/staff-hub/da-hub", permission: "staff.view" },
  { path: "/staff-hub/reports", permission: "site.moderation" },
  { path: "/staff-hub/training", permission: "staff.view" },
  { path: "/staff-hub/analytics", permission: "staff.view" },
  // The launcher itself only lists what you can already open, so it needs no
  // gate beyond the hub's own.
  { path: "/staff-hub/administration", permission: "staff.view" },
  { path: "/staff-hub/administrators", permission: "staff.links.admin" },
  { path: "/staff-hub/senior-admins", permission: "staff.links.senior" },
  { path: "/staff-hub/head-admin", permission: "staff.portal.manage" },
  { path: "/staff-hub/submissions", permission: "exams.view" },
  { path: "/staff-hub/exam-members", permission: "exams.view" },
  { path: "/staff-hub/audit-log", permission: "exams.audit" },
  { path: "/staff-hub/management", permission: "exams.manage" },
  { path: "/staff-hub/permissions", permission: "permissions.manage" },
  { path: "/staff-hub/discord-roles", permission: "discord.roles.manage" },

  // Civilian Hub
  { path: "/civilian-hub/home", permission: "civilian.view" },
  { path: "/civilian-hub/forms", permission: "forms.view" },
  { path: "/civilian-hub/businesses", permission: "civilian.view" },
  { path: "/civilian-hub/penal-code", permission: "civilian.view" },
  { path: "/civilian-hub/guides", permission: "civilian.view" },
];

/** The guard covering `pathname`, or null when the route is public. */
export function guardFor(pathname) {
  return (
    GUARDS.find((guard) => matchPath({ path: guard.path, end: true }, pathname)) ??
    null
  );
}
