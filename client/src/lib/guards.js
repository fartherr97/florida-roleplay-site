/**
 * Single source of truth for which routes are role-gated. PublicLayout consults
 * it to decide whether to render the shell or the Access Denied page, and the
 * top bar consults it to hide destinations a user cannot open.
 *
 * Hidden links are a convenience only — the server middleware in
 * server/src/middleware/requireRole.js is the actual security boundary, and the
 * two must agree on role names.
 */
import { matchPath } from "react-router-dom";
import { ROLES } from "../data/mockData";

export const STAFF_ROLES = [
  ROLES.STAFF,
  ROLES.MODERATOR,
  ROLES.ADMIN,
  ROLES.MANAGEMENT,
];
export const MOD_ROLES = [ROLES.MODERATOR, ROLES.ADMIN, ROLES.MANAGEMENT];
export const MANAGEMENT_ROLES = [ROLES.MANAGEMENT];
export const DEPT_HEAD_ROLES = [ROLES.MANAGEMENT, ROLES.DEPT_HEAD];

/** Matched with `end: true`, so each entry gates exactly its own path. */
export const GUARDS = [
  { path: "/staff", roles: STAFF_ROLES },
  { path: "/staff/moderation", roles: MOD_ROLES },
  { path: "/staff/support", roles: STAFF_ROLES },
  { path: "/management/leadership", roles: MANAGEMENT_ROLES },
  {
    path: "/management/department-heads",
    roles: DEPT_HEAD_ROLES,
    reason: "department",
  },
];

/** The guard covering `pathname`, or null when the route is public. */
export function guardFor(pathname) {
  return (
    GUARDS.find((guard) => matchPath({ path: guard.path, end: true }, pathname)) ??
    null
  );
}
