import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { api } from '../../lib/api';

export default function DevAssignees({request,onChange}) {
  const [open,setOpen]=useState(false),[members,setMembers]=useState(null),[selected,setSelected]=useState([]);
  const [search,setSearch]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function show() {
    setOpen(true);setError('');setMembers(null);setSearch('');
    setSelected((request.assignees || []).map(p=>p.discordId));
    try {setMembers((await api.devAssignable(request.id)).members);}
    catch(e){setError(e.message || 'Unable to load developers.');}
  }
  async function save() {
    setBusy(true);setError('');
    try {await api.assignDevelopers(request.id,selected);await onChange();setOpen(false);}
    catch(e){setError(e.message || 'Unable to save assignments.');}
    finally{setBusy(false);}
  }
  const all=[...(members || [])];
  for(const p of request.assignees || [])if(!all.some(m=>m.discordId===p.discordId))all.push({...p,unavailable:true});
  return <>
    <Button size="sm" variant="secondary" onClick={show}>Assign developers</Button>
    <span className="text-sm text-slate-400">{request.assignedToName || 'Unassigned'}</span>
    <Modal open={open} onClose={()=>!busy && setOpen(false)} title="Assign developers">
      <p className="mb-3 text-sm text-slate-400">Choose one or more Developer-role members to handle this ticket.</p>
      <input aria-label="Search developers" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or Discord ID" className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-white" />
      {members===null && !error && <p role="status">Loading developers…</p>}
      <div className="my-3 max-h-72 space-y-2 overflow-y-auto">
        {all.filter(m=>`${m.name} ${m.discordId}`.toLowerCase().includes(search.toLowerCase())).map(m=><label key={m.discordId} className="flex items-center gap-3 rounded-lg bg-white/5 p-3 text-sm text-white">
          <input type="checkbox" checked={selected.includes(m.discordId)} disabled={busy} onChange={e=>setSelected(ids=>e.target.checked ? [...ids,m.discordId] : ids.filter(id=>id!==m.discordId))} />
          <span>{m.name}<span className="block text-xs text-slate-400">{m.discordId}{m.unavailable ? ' · No longer in developer list; remove to save' : ''}</span></span>
        </label>)}
      </div>
      {members?.length===0 && <p className="text-sm text-slate-400">No Developer-role members found.</p>}
      {error && <p role="alert" className="mb-3 text-red-300">{error}</p>}
      <Button onClick={save} disabled={busy || members===null}>{busy ? 'Saving…' : 'Save assignments'}</Button>
    </Modal>
  </>;
}
