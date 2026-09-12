import { useState } from 'react';
import { api } from '../../lib/api';
import Button from '../ui/Button';

export default function DevParticipants({request, canManage, onChange, kind='development'}) {
  const [id,setId] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function change(discordId, action) {
    setBusy(true);setError('');
    try { await api.changeTicketParticipant(kind,request.id,discordId,action);setId('');await onChange(); }
    catch(e) {setError(e.message || 'Could not update participants.');}
    finally {setBusy(false);}
  }
  return <section className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
    <h2 className="font-semibold text-white">Ticket participants</h2>
    <p className="mt-1 text-sm text-slate-400">Added members can read and reply to this ticket’s public conversation. Adding someone does not grant approval permissions or access to internal notes.</p>
    <ul className="my-3 space-y-2 text-sm text-slate-300">
      <li>{request.openedByName} <span className="text-slate-500">· Ticket opener</span></li>
      {(request.participants || []).map(p => <li key={p.discordId} className="flex flex-wrap items-center justify-between gap-2">
        <span>{p.name} <span className="text-slate-500">({p.discordId})</span></span>
        {canManage && <Button size="sm" variant="ghost" disabled={busy} onClick={() => change(p.discordId,'remove')} aria-label={`Remove participant ${p.name}`}>Remove</Button>}
      </li>)}
    </ul>
    {canManage && request.status !== 'closed' && <form className="flex flex-wrap gap-2" onSubmit={e => {e.preventDefault();change(id.trim(),'add');}}>
      <label className="flex-1 text-sm text-slate-300">Discord user ID
        <input required inputMode="numeric" pattern="[0-9]{17,20}" value={id} onChange={e => setId(e.target.value)} placeholder="Paste their Discord user ID"
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white" />
      </label>
      <Button type="submit" className="self-end" disabled={busy || !/^\d{17,20}$/.test(id.trim())}>Add participant</Button>
    </form>}
    {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
  </section>;
}
