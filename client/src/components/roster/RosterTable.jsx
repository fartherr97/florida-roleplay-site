import { Fragment } from "react";
import Card from "../ui/Card";
import { cn } from "../../lib/cn";

/**
 * The grouped roster table used by the Staff Hub, the Civilian Hub and every
 * department site.
 *
 * One table, not one per band. That matters more than it sounds: a stack of
 * separate tables lets each band size its own columns, so "Callsign" lands in a
 * different place in every group and the roster stops scanning as a single list.
 * Here the bands are full-width header rows inside one table, so the columns
 * line up down the whole page.
 *
 * A band with no members still renders when it holds vacancies — an empty
 * position is information, and hiding the band would hide it.
 */
/**
 * Static class strings per breakpoint, so Tailwind's scanner can see them — a
 * template literal built from `column.hideBelow` would compile to nothing.
 * `hidden` first and the variant second is deliberate: unprefixed utilities lose
 * to variant-prefixed ones whatever order they appear in the attribute, because
 * the media query comes later in the stylesheet.
 */
const HIDE_BELOW = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
  "2xl": "hidden 2xl:table-cell",
};

export default function RosterTable({
  columns,
  groups,
  rowKey = (row) => row.id,
  onRowClick,
  empty = "Nobody matches that search.",
  minWidth = "44rem",
}) {
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);

  if (total === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm text-slate-400">{empty}</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-3 py-3 font-bold whitespace-nowrap",
                    column.align === "right" && "text-right",
                    column.hideBelow && HIDE_BELOW[column.hideBelow],
                    column.width,
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {groups.map((group) => (
              <Fragment key={group.id}>
                <tr>
                  <td colSpan={columns.length} className="p-0">
                    {/* The band. A left edge in the band's colour and a wash of
                        the same colour behind it — enough to separate the groups
                        without turning the table into stripes. */}
                    <div
                      className="my-1.5 flex items-center gap-3 rounded-lg border-l-[3px] px-4 py-2"
                      style={{
                        borderColor: group.color,
                        backgroundColor: `color-mix(in srgb, ${group.color} 10%, transparent)`,
                      }}
                    >
                      {group.insigniaUrl && (
                        <img
                          src={group.insigniaUrl}
                          alt=""
                          className="size-5 shrink-0 object-contain"
                        />
                      )}
                      <span
                        className="text-[11px] font-bold uppercase tracking-[0.16em]"
                        style={{ color: group.color }}
                      >
                        {group.label}
                      </span>
                      <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                        {group.rows.filter((row) => !row.vacant).length}
                      </span>
                    </div>
                  </td>
                </tr>

                {group.rows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick && !row.vacant ? () => onRowClick(row) : undefined}
                    className={cn(
                      "border-b border-white/[0.04] transition",
                      row.vacant
                        ? "opacity-45"
                        : cn(
                            "hover:bg-white/[0.02]",
                            onRowClick && "cursor-pointer",
                          ),
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-3 py-3 align-middle",
                          column.align === "right" && "text-right",
                          column.hideBelow && HIDE_BELOW[column.hideBelow],
                        )}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
