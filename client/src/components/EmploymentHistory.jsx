export default function EmploymentHistory({ entries = [] }) {
  return <section className="mt-4 rounded-xl border border-amber-400/20 bg-black/20 p-4">
    <h3 className="text-sm font-semibold text-amber-200">Department employment history</h3>
    {entries.length ? <ul className="mt-3 space-y-3">{entries.map(entry=><li key={entry.id} className="text-sm text-slate-300">
      <p className="font-semibold text-white">{entry.type} · {entry.department.toUpperCase()}</p>
      <p className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString()}{entry.issuedByName ? ` · Logged by ${entry.issuedByName}` : ''}</p>
      <p className="mt-1 whitespace-pre-wrap">{entry.reason}</p>
    </li>)}</ul> : <p className="mt-2 text-sm text-slate-400">No personnel records in this period.</p>}
  </section>;
}
