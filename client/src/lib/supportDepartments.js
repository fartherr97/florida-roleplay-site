export const DEPARTMENTS = [
  { id: "fhp", label: "Florida Highway Patrol", short: "FHP" },
  { id: "bso", label: "Broward County Sheriff's Office", short: "BSO" },
  { id: "mpd", label: "Miami Police Department", short: "MPD" },
  { id: "civilian", label: "Civilian Department", short: "CIV" },
];
export const departmentOf = type => type.department ?? ({ dept_fhp: "fhp", dept_bso: "bso", dept_mpd: "mpd", dept_civilian: "civilian" }[type.id] || "");

