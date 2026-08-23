import Card from "../ui/Card";

/**
 * Hairline-bordered table used across both hubs. Columns describe their own
 * cells, so a page declares the shape once and the scroll container, header
 * treatment and empty state come for free.
 */
export default function DataTable({ columns, rows, rowKey, empty = "Nothing here yet." }) {
  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-slate-400">{empty}</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-5 py-3 font-bold ${column.align === "right" ? "text-right" : ""}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="transition hover:bg-white/[0.02]">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-5 py-3.5 ${column.align === "right" ? "text-right" : ""}`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
