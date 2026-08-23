/**
 * Maps the icon names stored in mock/API data to lucide components, so content
 * records can reference an icon by string without importing React components.
 */
import {
  Anchor, Bot, Building2, Calendar, Car, ClipboardList, Crown, Flame, Gavel,
  Heart, LifeBuoy, Mail, Newspaper, Radio, ScrollText, Shield, Siren,
  Stethoscope, Store, Users, UserCog, Wrench,
} from "lucide-react";

const ICONS = {
  Anchor, Bot, Building2, Calendar, Car, ClipboardList, Crown, Flame, Gavel,
  Heart, LifeBuoy, Mail, Newspaper, Radio, ScrollText, Shield, Siren,
  Stethoscope, Store, Users, UserCog, Wrench,
};

export function iconFor(name, fallback = Shield) {
  return ICONS[name] ?? fallback;
}

export default ICONS;
