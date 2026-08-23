/**
 * Navigation model for the top bar and the mobile drawer. Which dropdown items
 * a user may reach is decided by src/lib/guards.js, so the roles are declared
 * once there rather than repeated here.
 */
import { SITE } from "./mockData";

export const primaryLinks = [
  { label: "Home", to: "/" },
  { label: "Rules", to: "/rules" },
  { label: "Applications", to: "/applications" },
  { label: "Discord", href: SITE.discordInvite, external: true },
  { label: "Store", to: "/store" },
  { label: "Supporters", to: "/supporters" },
  { label: "Knowledge Base", to: "/knowledge-base" },
  { label: "Events", to: "/events" },
  { label: "Reports / Complaints", to: "/reports" },
];

export const navGroups = [
  {
    id: "emergency",
    label: "Emergency Services",
    // Tailwind tone classes for the trigger, icon tile and drawer heading.
    tone: {
      text: "text-sky-400",
      tile: "bg-sky-500/10 text-sky-400 ring-sky-400/20",
    },
    items: [
      { label: "Florida Highway Patrol", to: "/departments/fhp", icon: "Car" },
      { label: "Hillsborough County SO", to: "/departments/hcso", icon: "Shield" },
      { label: "Tampa Police Department", to: "/departments/tpd", icon: "Building2" },
      { label: "Hillsborough County Fire Rescue", to: "/departments/hcfr", icon: "Flame" },
      { label: "Homeland Security", to: "/departments/dhs", icon: "Siren" },
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
      { label: "Staff Team", to: "/staff", icon: "Users" },
      { label: "Moderation", to: "/staff/moderation", icon: "Gavel" },
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
    ],
  },
];
