import { Search } from "lucide-react";
import Card from "./Card";
import { TextInput } from "./TextInput";

/**
 * The help-centre hero shared by the rules and knowledge base pages — a wash of
 * orange at the top of a card, a heading, and a prominent search field.
 */
export default function SearchHero({
  title,
  subtitle,
  value,
  onChange,
  placeholder = "Search…",
  children,
}) {
  return (
    <Card className="relative overflow-hidden p-6 sm:p-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary-600/10 to-transparent" />
      <div className="relative">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-3 max-w-2xl text-slate-400">{subtitle}</p>}

        <div className="relative mt-6 max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <TextInput
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="pl-11"
          />
        </div>
        {children}
      </div>
    </Card>
  );
}
