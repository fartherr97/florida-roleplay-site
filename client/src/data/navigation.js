/**
 * Navigation model for the top bar and the mobile drawer. Which dropdown items
 * a user may reach is decided by src/lib/guards.js, so the roles are declared
 * once there rather than repeated here.
 */
import { SITE } from "./mockData";

export const primaryLinks = [
  { label: "Home", to: "/" },
  { label: "Rules", to: "/rules" },
  // Points at the configurable system, not the older fixed whitelist form at
  // /applications — that one is still reachable, just no longer the front door.
  { label: "Applications", to: "/apply" },
  { label: "Discord", href: SITE.discordInvite, external: true },
  { label: "Store", to: "/store" },
  { label: "Knowledge Base", to: "/knowledge-base" },
  { label: "Events", to: "/events" },
  { label: "Reports / Complaints", to: "/reports" },
  { label: "Support", to: "/support" },
];

export const navGroups = [
  {
    id: "civilian",
    label: "Civilian",
    tone: {
      text: "text-emerald-400",
      tile: "bg-emerald-500/10 text-emerald-400 ring-emerald-400/20",
    },
    items: [
      { label: "Civilian Hub", to: "/civilian-hub", icon: "LayoutGrid" },
      { label: "Community Roster", to: "/civilian-hub/roster", icon: "Users" },
      { label: "Forms & Assessments", to: "/civilian-hub/forms", icon: "ClipboardList" },
      { label: "Vehicles", to: "/civilian-hub/vehicles", icon: "Car" },
      { label: "Properties", to: "/civilian-hub/properties", icon: "House" },
      { label: "Business Directory", to: "/civilian-hub/businesses", icon: "Store" },
      { label: "Job Board", to: "/civilian-hub/jobs", icon: "Briefcase" },
      { label: "Classifieds", to: "/civilian-hub/classifieds", icon: "Tag" },
      { label: "Penal Code", to: "/civilian-hub/penal-code", icon: "Scale" },
      { label: "Supporters", to: "/supporters", icon: "Heart" },
    ],
  },
  {
    id: "emergency",
    label: "Emergency Services",
    // Tailwind tone classes for the trigger, icon tile and drawer heading.
    tone: {
      text: "text-sky-400",
      tile: "bg-sky-500/10 text-sky-400 ring-sky-400/20",
    },
    items: [
      { label: "All Departments", to: "/departments", icon: "LayoutGrid" },
      { label: "Florida Highway Patrol", to: "/departments/fhp", icon: "Car" },
      { label: "Hillsborough County SO", to: "/departments/hcso", icon: "Shield" },
      { label: "Tampa Police Department", to: "/departments/tpd", icon: "Building2" },
      { label: "Hillsborough County Fire Rescue", to: "/departments/hcfr", icon: "Flame" },
      { label: "Transfer Portal", to: "/transfers", icon: "ArrowLeftRight" },
    ],
  },
  {
    id: "staff",
    label: "Staff",
    tone: {
      text: "text-primary-400",
      tile: "bg-primary-500/10 text-primary-400 ring-primary-400/20",
    },
    items: [
      { label: "Staff Hub", to: "/staff-hub", icon: "LayoutGrid" },
      { label: "Staff Roster", to: "/staff-hub/roster", icon: "Users" },
      { label: "Staff Forms & Exams", to: "/staff-hub/forms", icon: "ClipboardList" },
      { label: "Promotion Board", to: "/staff-hub/promotion-board", icon: "Award" },
      { label: "Staff Dashboard", to: "/staff-hub/dashboard", icon: "ChartColumn" },
      { label: "Trial Mod Checklist", to: "/staff-hub/trial-checklist", icon: "ListChecks" },
      { label: "Staff DA Database", to: "/staff-hub/da-database", icon: "Gavel" },
      { label: "Staff Resources", to: "/staff-hub/resources", icon: "BookOpen" },
      { label: "Staff Team", to: "/staff", icon: "Shield" },
      { label: "Moderation Queue", to: "/staff/moderation", icon: "Scale" },
      { label: "Support Queue", to: "/staff/support", icon: "LifeBuoy" },
      { label: "Apply for Staff", to: "/applications/staff", icon: "ClipboardList" },
    ],
  },
  {
    id: "management",
    label: "Management",
    tone: {
      text: "text-rose-500",
      tile: "bg-rose-500/10 text-rose-400 ring-rose-400/20",
    },
    items: [
      { label: "Leadership", to: "/management/leadership", icon: "Crown" },
      { label: "Department Heads", to: "/management/department-heads", icon: "UserCog" },
      { label: "Contact Management", to: "/management/contact", icon: "Mail" },
      { label: "Bot Dashboard", to: "/management/bot", icon: "Bot" },
    ],
  },
];
