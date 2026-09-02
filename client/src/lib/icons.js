/**
 * Maps the icon names stored in mock/API data to lucide components, so content
 * records can reference an icon by string without importing React components.
 */
import {
  Activity, Anchor, ArrowLeftRight, Award, BookOpen, Bot, Briefcase, Building2, Calendar, Car, ChartColumn,
  ClipboardList, Code, Crown, Flame, Gamepad2, Gavel, Heart, House, Image, LayoutGrid, LifeBuoy, Link,
  ListChecks, Mail, MessageSquare, Newspaper, Radio, Scale, ScrollText, Shield, ShoppingCart, Siren, Star,
  SlidersHorizontal, Stethoscope, Store, Tag, Ticket, Users, UserCog, Wrench,
} from "lucide-react";

const ICONS = {
  Activity, Anchor, ArrowLeftRight, Award, BookOpen, Bot, Briefcase, Building2, Calendar, Car, ChartColumn,
  ClipboardList, Code, Crown, Flame, Gamepad2, Gavel, Heart, House, Image, LayoutGrid, LifeBuoy, Link,
  ListChecks, Mail, MessageSquare, Newspaper, Radio, Scale, ScrollText, Shield, ShoppingCart, Siren, Star,
  SlidersHorizontal, Stethoscope, Store, Tag, Ticket, Users, UserCog, Wrench,
};

export function iconFor(name, fallback = Shield) {
  return ICONS[name] ?? fallback;
}

export default ICONS;
