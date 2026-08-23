import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "../ui/Button";

/**
 * The pagination the API returns. `pageSize` is capped server side, so the
 * options here are requests rather than guarantees — the control reads its
 * state back from the response instead of tracking what it asked for.
 */
export default function Paginator({ pagination, onPage, className }) {
  if (!pagination) return null;
  const { page, pageSize, total, totalPages, hasNext } = pagination;
  if (!total) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className ?? ""}`}>
      <p className="text-xs text-slate-500">
        {first}–{last} of {total}
      </p>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <span className="text-xs text-slate-500">
          {page} / {totalPages || 1}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasNext}
          onClick={() => onPage(page + 1)}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
