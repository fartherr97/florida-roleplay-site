import { Search } from "lucide-react";
import Select from "../ui/Select";
import { TextInput } from "../ui/TextInput";

/**
 * Search plus the dropdowns a roster filters by. Kept together so every roster
 * on the site presents the same control row in the same order.
 */
export default function RosterFilters({ query, onQuery, placeholder, filters = [] }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <TextInput
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="pl-11"
        />
      </div>
      {filters.map((filter) => (
        <Select
          key={filter.id}
          value={filter.value}
          onChange={filter.onChange}
          options={filter.options}
          className="sm:w-52"
        />
      ))}
    </div>
  );
}
