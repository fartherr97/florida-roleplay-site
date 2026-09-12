import { useEffect, useState } from 'react';
import Section from '../../components/layout/Section';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import AccessDenied from '../../components/auth/AccessDenied';
import { useAuth } from '../../context/useAuth';
import { api } from '../../lib/api';

export default function DevAssignments() {
  const { user, loading, hasPermission } = useAuth();
  const allowed = hasPermission('development.assignments.view');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    if (!user || !allowed) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setBusy(true); setError('');
      api.devAssignments(search, page).then(result => { if (!cancelled) setData(result); })
        .catch(e => { if (!cancelled) setError(e.message || 'Unable to load assignments.'); })
        .finally(() => { if (!cancelled) setBusy(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [user, allowed, search, page, refresh]);
  if (loading) return null;
  if (!user || !allowed) return <AccessDenied reason={!user ? 'signed-out' : 'role'} />;
  return <Section className="max-w-7xl">
    <PageHeader eyebrow="Development Hub" title="Assigned Vehicles"
      subtitle="Approved personal vehicles and the members they are assigned to. Pending or revoked approvals are not assignments."
      actions={<Button onClick={() => setRefresh(n => n + 1)} disabled={busy}>Refresh</Button>} />
    <label className="block text-sm text-slate-300">Search assignments
      <input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
        placeholder="Member, Discord ID, vehicle or spawn code…"
        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
    </label>
    <div className="my-6 h-px bg-gradient-to-r from-yellow-400 via-orange-500 to-transparent" />
    {error ? <div role="alert" className="text-red-300">{error} <Button onClick={() => setRefresh(n => n + 1)}>Retry</Button></div>
      : busy ? <p role="status" className="text-slate-400">Loading assignments…</p>
      : <><p className="mb-4 text-sm text-slate-400" role="status">{data?.total ?? 0} assigned vehicles{search ? ' matching your search' : ''}</p>
        {!data?.assignments.length ? <p className="rounded-xl border border-white/10 p-8 text-slate-400">{search ? 'No matching assignments.' : 'No approved vehicle assignments have been recorded in the library yet.'}</p>
          : <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-slate-300"><tr>{['Vehicle', 'Assigned member', 'Approval', 'Files / liveries'].map(h => <th key={h} className="p-4">{h}</th>)}</tr></thead>
            <tbody>{data.assignments.map(a => <tr key={a.id} className="border-t border-white/10 align-top">
              <td className="p-4"><p className="font-semibold text-white">{a.name || [a.year, a.make, a.model].filter(Boolean).join(' ')}</p><code className="text-violet-300">{a.spawnCode || 'No spawn code listed'}</code><p className="mt-1 text-slate-400">{a.library === 'leo' ? 'Law Enforcement' : a.library === 'civ' ? 'Civilian' : a.library || 'Other'}</p></td>
              <td className="p-4"><p className="text-white">{a.memberName}</p><code className="text-xs text-slate-400">{a.discordId}</code></td>
              <td className="p-4 text-slate-400"><p>{a.approvedBy || 'Not recorded'}</p><p>{a.assignedAt ? new Date(a.assignedAt).toLocaleString() : 'Date not recorded'}</p>{a.requestId && <p className="mt-1 text-xs">Ticket: {a.requestId}</p>}</td>
              <td className="max-w-sm break-words p-4 text-slate-400"><p>{Array.isArray(a.liveries) ? a.liveries.join(', ') || 'Liveries not listed' : a.liveries || 'Liveries not listed'}</p><p className="mt-2 text-xs">{a.resource || 'Resource not listed'}</p></td>
            </tr>)}</tbody></table></div>}
        {data?.total > 100 && <div className="mt-5 flex items-center gap-4"><Button disabled={page === 1} onClick={() => setPage(n => n - 1)}>Previous</Button><span className="text-slate-400">Page {page} of {Math.ceil(data.total / 100)}</span><Button disabled={page * 100 >= data.total} onClick={() => setPage(n => n + 1)}>Next</Button></div>}
      </>}
  </Section>;
}
