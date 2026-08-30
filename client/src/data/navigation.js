/**
 * Navigation model for the top bar and the mobile drawer. Which dropdown items
 * a user may reach is decided by src/lib/guards.js, so the roles are declared
 * once there rather than repeated here.
 */
import { SITE } from "./mockData";

export const primaryLinks = [
  { label: "Home", to: "/" },
  { label: "Rules", to: "/rules" },
  { label: "Penal Code", to: "/penal-code" },
  { label: "Whitelist", to: "/whitelist" },
  // Applications are handled by Sonoran now — this hands off rather than
  // opening a form on the site. SITE.applyUrl is the one place the URL lives.
  { label: "Applications", href: SITE.applyUrl, external: true },
  { label: "Discord", href: SITE.discordInvite, external: true },
  { label: "Store", to: "/store" },
  { label: "Reports", to: "/reports" },
  { label: "Support", to: "/support" },
];

export const navGroups = [
  {
    id: "civilian",
    label: "Civilian",
    tone: {
      text: "text-emerald-400",
      tile: "bg-emerald-500/10 text-emerald-400 ring-emerald-400/20",
      hover: "hover:bg-emerald-500/10 hover:text-emerald-300 focus-visible:bg-emerald-500/10",
    },
    items: [
      { label: "Civilian Hub", to: "/civilian-hub", icon: "LayoutGrid" },
      { label: "Forms & Assessments", to: "/civilian-hub/forms", icon: "ClipboardList" },
      { label: "Business Directory", to: "/civilian-hub/businesses", icon: "Store" },
    ],
  },
  {
    id: "emergency",
    label: "Emergency Services",
    // Tailwind tone classes for the trigger, icon tile and drawer heading.
    tone: {
      text: "text-sky-400",
      tile: "bg-sky-500/10 text-sky-400 ring-sky-400/20",
      hover: "hover:bg-sky-500/10 hover:text-sky-300 focus-visible:bg-sky-500/10",
    },
    items: [
      { label: "All Departments", to: "/departments", icon: "LayoutGrid" },
      { label: "Florida Highway Patrol", to: "/departments/fhp", icon: "Car" },
      { label: "Broward County SO", to: "/departments/bcso", icon: "Shield" },
      { label: "Miami Police Department", to: "/departments/mpd", icon: "Building2" },
      { label: "Transfer Portal", to: "/transfers", icon: "ArrowLeftRight" },
      { label: "Image Hosting", to: "/image-host", icon: "Image" },
    ],
  },
  {
    id: "development",
    label: "Development",
    tone: {
      text: "text-violet-400",
      tile: "bg-violet-500/10 text-violet-400 ring-violet-400/20",
      hover: "hover:bg-violet-500/10 hover:text-violet-300 focus-visible:bg-violet-500/10",
    },
    items: [
      { label: "Development Hub", to: "/development", icon: "LayoutGrid" },
      { label: "Create Request", to: "/development/new", icon: "Plus" },
      { label: "My Requests", to: "/development/requests", icon: "Ticket" },
      { label: "Dev Team Roster", to: "/development/roster", icon: "Users" },
      { label: "Vehicle Library", to: "/development/library", icon: "Car" },
      { label: "Help Center", to: "/development/help", icon: "LifeBuoy" },
      { label: "Suggestions & Bugs", to: "/development/feedback", icon: "MessageSquare" },
      { label: "Dev Queue", to: "/development/queue", icon: "Wrench" },
      { label: "Request Categories", to: "/development/types", icon: "SlidersHorizontal" },
    ],
  },
  {
    id: "staff",
    label: "Staff",
    tone: {
      text: "text-primary-400",
      tile: "bg-primary-500/10 text-primary-400 ring-primary-400/20",
      hover: "hover:bg-primary-500/10 hover:text-primary-300 focus-visible:bg-primary-500/10",
    },
    items: [
      { label: "Staff Hub", to: "/staff-hub", icon: "LayoutGrid" },
      { label: "Staff Roster", to: "/staff-hub/roster", icon: "Users" },
      { label: "Staff Forms & Exams", to: "/staff-hub/forms", icon: "ClipboardList" },
      { label: "Promotion Board", to: "/staff-hub/promotion-board", icon: "Award" },
      { label: "Staff Dashboard", to: "/staff-hub/dashboard", icon: "ChartColumn" },
      { label: "Trial Mod Checklist", to: "/staff-hub/trial-checklist", icon: "ListChecks" },
      { label: "DA Hub", to: "/staff-hub/da-hub", icon: "Gavel" },
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
      hover: "hover:bg-rose-500/10 hover:text-rose-300 focus-visible:bg-rose-500/10",
    },
    items: [
      { label: "Site Administration", to: "/staff-hub/administration", icon: "SlidersHorizontal" },
      { label: "Access & Roles", to: "/staff-hub/access", icon: "KeyRound" },
      { label: "Image Hosting Administration", to: "/management/image-hosting", icon: "Image" },
      // The route stays open (a public contact form) but the link is management-only.
      { label: "Contact Management", to: "/management/contact", icon: "Mail", permission: "permissions.manage" },
      // The bot dashboard has its own session-based gate; hide the link from anyone
      // who isn't management so the tab doesn't leak to signed-out visitors.
      { label: "Bot Dashboard", to: "/management/bot", icon: "Bot", permission: "permissions.manage" },
      { label: "Email Directory", to: "/management/emails", icon: "Mail", permission: "emails.view" },
      { label: "Broadcast", to: "/management/broadcast", icon: "Megaphone", permission: "truthsocial.post" },
    ],
  },
];
