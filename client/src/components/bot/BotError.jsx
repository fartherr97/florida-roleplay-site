import { CircleAlert, Copy } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { ApiError } from "../../lib/botApi";

/**
 * The API's error, shown as the API wrote it.
 *
 * `message` is written for a human to read and never leaks internal detail, so
 * showing it beats inventing copy that says less. The `requestId` is surfaced
 * rather than only logged: it matches the bot's audit trail, so a support
 * question can be answered exactly instead of approximately.
 *
 * A 403 gets no retry button. The caller is signed in and simply not permitted;
 * offering "try again" invites someone to sit clicking at a wall.
 */
export default function BotError({ error, onRetry, className }) {
  if (!error) return null;

  const api = error instanceof ApiError ? error : null;
  const retryable = onRetry && !(api?.isForbidden || api?.status === 404);

  return (
    <Card className={className}>
      <div className="flex items-start gap-3 p-5">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-rose-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            {api?.status === 429
              ? "Too many requests"
              : api?.isForbidden
                ? "Not permitted"
                : api?.status === 404
                  ? "Not found"
                  : "That didn't work"}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{error.message}</p>

          {api?.status === 429 && (
            <p className="mt-2 text-xs text-slate-500">
              Give it a moment before trying again.
            </p>
          )}

          {api?.requestId && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="rounded-lg bg-black/30 px-2.5 py-1 text-xs text-slate-400 ring-1 ring-inset ring-white/10">
                {api.requestId}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(api.requestId)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-300"
              >
                <Copy className="size-3.5" />
                Copy request ID
              </button>
            </div>
          )}

          {retryable && (
            <Button variant="ghost" size="sm" className="mt-4" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
