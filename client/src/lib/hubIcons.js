/**
 * Icon registry for the Staff Hub sidebar and cards, kept separate from the
 * public site's registry so neither pulls in the other's icons.
 */
import {
  Award, BookOpen, ChartColumn, Crown, FileSpreadsheet, Gavel, Home, Inbox,
  ListChecks, ScrollText, Shield, ShieldCheck, SlidersHorizontal, Users,
  UserSearch,
} from "lucide-react";

const HUB_ICONS = {
  Award, BookOpen, ChartColumn, Crown, FileSpreadsheet, Gavel, Home, Inbox,
  ListChecks, ScrollText, Shield, ShieldCheck, SlidersHorizontal, Users,
  UserSearch,
};

export function hubIcon(name, fallback = Home) {
  return HUB_ICONS[name] ?? fallback;
}

export default HUB_ICONS;
