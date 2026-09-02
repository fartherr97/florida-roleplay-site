/**
 * Icon registry for the hubs' navigation and cards, kept separate from the
 * public site's registry so neither pulls in the other's icons.
 *
 * The department hubs pick from this list too: a config stores an icon by name,
 * so anything a department can choose in the Builder Portal has to resolve here.
 * Adding an icon makes it available to every department at once.
 */
import {
  Activity, Anchor, Award, BadgeCheck, BookOpen, Briefcase, Building2, Calendar,
  Car, ChartColumn, CircleDollarSign, ClipboardList, Clock, Crown, Dog, Flame,
  FileSpreadsheet, Fuel, Gavel, GraduationCap, Home, House, IdCard,
  Inbox, Key, KeyRound, Landmark, LayoutGrid, LifeBuoy, ListChecks, MapPin, Megaphone,
  Network, Phone, Plane, Radio, Scale, ScrollText, Shield, ShieldCheck, Shirt,
  Siren, SlidersHorizontal, Star, Store, Stethoscope, Tag, Truck, Users,
  Search, UserSearch, Wallet, Wrench,
} from "lucide-react";

const HUB_ICONS = {
  Activity, Anchor, Award, BadgeCheck, BookOpen, Briefcase, Building2, Calendar,
  Car, ChartColumn, CircleDollarSign, ClipboardList, Clock, Crown, Dog, Flame,
  FileSpreadsheet, Fuel, Gavel, GraduationCap, Home, House, IdCard,
  Inbox, Key, KeyRound, Landmark, LayoutGrid, LifeBuoy, ListChecks, MapPin, Megaphone,
  Network, Phone, Plane, Radio, Scale, ScrollText, Shield, ShieldCheck, Shirt,
  Siren, SlidersHorizontal, Star, Store, Stethoscope, Tag, Truck, Users,
  Search, UserSearch, Wallet, Wrench,
};

/** The names the Builder Portal's icon picker offers, in this order. */
export const ICON_NAMES = Object.keys(HUB_ICONS);

export function hubIcon(name, fallback = Home) {
  return HUB_ICONS[name] ?? fallback;
}

export default HUB_ICONS;
