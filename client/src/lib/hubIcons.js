/**
 * Icon registry for both hubs' navigation and cards, kept separate from the
 * public site's registry so neither pulls in the other's icons.
 */
import {
  Award, BadgeCheck, BookOpen, Briefcase, Building2, Calendar, Car, ChartColumn,
  CircleDollarSign, Crown, FileSpreadsheet, Fuel, Gavel, Home, House, IdCard,
  Inbox, Key, KeyRound, ListChecks, MapPin, Phone, Scale, ScrollText, Shield, ShieldCheck,
  SlidersHorizontal, Store, Tag, Users, UserSearch, Wallet,
} from "lucide-react";

const HUB_ICONS = {
  Award, BadgeCheck, BookOpen, Briefcase, Building2, Calendar, Car, ChartColumn,
  CircleDollarSign, Crown, FileSpreadsheet, Fuel, Gavel, Home, House, IdCard,
  Inbox, Key, KeyRound, ListChecks, MapPin, Phone, Scale, ScrollText, Shield, ShieldCheck,
  SlidersHorizontal, Store, Tag, Users, UserSearch, Wallet,
};

export function hubIcon(name, fallback = Home) {
  return HUB_ICONS[name] ?? fallback;
}

export default HUB_ICONS;
