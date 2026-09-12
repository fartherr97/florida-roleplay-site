export const DEPARTMENTS = [
  { id: "fhp", label: "Florida Highway Patrol", short: "FHP", logo: "https://www.flrp.us/images/480f8f75e967b7e4.png" },
  { id: "bso", label: "Broward County Sheriff's Office", short: "BSO", logo: "https://www.flrp.us/images/c45e2a2852eba7fb.png" },
  { id: "mpd", label: "Miami Police Department", short: "MPD", logo: "https://www.flrp.us/images/72517584c4a23ba3.png" },
  { id: "civilian", label: "Civilian Department", short: "CIV", logo: "/logo.png" },
];
export const departmentOf = type => type.department ?? ({ dept_fhp: "fhp", dept_bso: "bso", dept_mpd: "mpd", dept_civilian: "civilian" }[type.id] || "");

