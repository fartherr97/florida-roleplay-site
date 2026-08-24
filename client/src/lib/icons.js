/**
 * Maps the icon names stored in mock/API data to lucide components, so content
 * records can reference an icon by string without importing React components.
 */
import {
  Anchor, ArrowLeftRight, Award, BookOpen, Bot, Briefcase, Building2, Calendar, Car, ChartColumn,
  ClipboardList, Crown, Flame, Gavel, Heart, House, LayoutGrid, LifeBuoy,
  ListChecks, Mail, Newspaper, Radio, Scale, ScrollText, Shield, Siren,
  Stethoscope, Store, Tag, Users, UserCog, Wrench,
} from "lucide-react";

const ICONS = {
  Anchor, ArrowLeftRight, Award, BookOpen, Bot, Briefcase, Building2, Calendar, Car, ChartColumn,
  ClipboardList, Crown, Flame, Gavel, Heart, House, LayoutGrid, LifeBuoy,
  ListChecks, Mail, Newspaper, Radio, Scale, ScrollText, Shield, Siren,
  Stethoscope, Store, Tag, Users, UserCog, Wrench,
};

export function iconFor(name, fallback = Shield) {
  return ICONS[name] ?? fallback;
}

export default ICONS;
