/**
 * Which department site a request is for.
 *
 * Florida Roleplay runs one deployment and one database for every department,
 * exactly as the reference implementation this was ported from did. The
 * difference is how a request names its department: there it was always the Host
 * header (fhp.ssrp.gg → "fhp"); here the department is normally a path segment
 * (/departments/fhp/hub/...), because the community is one site on one domain.
 *
 * Hostname resolution is kept as an override, so pointing a subdomain at this
 * deployment later works with no code change:
 *
 *   1. an explicit DEPARTMENT_MAP entry for the host  (host=id,host=id,…)
 *   2. the first DNS label of a real subdomain        (fhp.flrp.us → fhp)
 *   3. nothing — the path decides
 *
 * Whatever the source, the id is validated before it reaches a query.
 */
import { validDepartmentId } from "./departmentConfig.js";

/** Hosts we never read a department out of, however many labels they have. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parseMap(raw) {
  return Object.fromEntries(
    String(raw || "")
      .split(",")
      .map((pair) => pair.split("=").map((part) => part.trim().toLowerCase()))
      .filter(([host, id]) => host && id && validDepartmentId(id)),
  );
}

export function departmentFromHost(host) {
  if (!host) return null;
  const name = String(host).split(":")[0].toLowerCase();
  if (LOCAL_HOSTS.has(name)) return null;

  const mapped = parseMap(process.env.DEPARTMENT_MAP)[name];
  if (mapped) return mapped;

  // A bare apex (flrp.us) or a www host is the community site, not a
  // department; only a real third label counts as a subdomain.
  const labels = name.split(".");
  if (labels.length < 3 || labels[0] === "www") return null;
  return validDepartmentId(labels[0]) ? labels[0] : null;
}

/**
 * The department for a request: the `:deptId` route parameter when the path
 * carries one, otherwise the host. Returns null when neither names a valid id,
 * which the route turns into a 400 rather than guessing.
 */
export function resolveDepartmentId(req) {
  const fromPath = req?.params?.deptId;
  if (fromPath) return validDepartmentId(fromPath) ? fromPath : null;
  return departmentFromHost(req?.headers?.host);
}

/** Express middleware form, for routers mounted under a department prefix. */
export function tenant(req, res, next) {
  const id = resolveDepartmentId(req);
  if (!id) {
    return res
      .status(400)
      .json({ ok: false, message: "No department in this request." });
  }
  req.departmentId = id;
  next();
}
