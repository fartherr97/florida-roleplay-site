import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
export default function QueueRolePicker({type,onChange}) {
  const [guilds,setGuilds]=useState([]),[roles,setRoles]=useState([]),[search,setSearch]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;api.supportQueueRoles().then(r=>active && setGuilds(r.guilds || [])).catch(e=>active && setError(e.message));return()=>{active=false};},[retry]);
  useEffect(()=>{
    let active=true;setRoles([]);setError('');setSearch('');
    if(!type.workGuildId)return;
    setLoading(true);
    api.supportQueueRoles(type.workGuildId).then(r=>active && setRoles(r.roles || [])).catch(e=>active && setError(e.message)).finally(()=>active && setLoading(false));
    return()=>{active=false};
  },[type.workGuildId,retry]);
  const selected=type.workRoleIds || [];
  const options=[...roles];
  for(const id of selected)if(!options.some(r=>r.id===id))options.push({id,name:type.workRoleNames?.[id] || id,missing:true});
  return <div className="space-y-3">
    <label className="block text-sm text-slate-300">Discord guild
      <select aria-label="Queue Discord guild" value={type.workGuildId || ''} onChange={e=>onChange({workGuildId:e.target.value,workRoleIds:[],workRoleNames:{},exclusive:e.target.value ? true : type.exclusive})} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 p-3 text-white">
        <option value="">Keep existing team access</option>
        {type.workGuildId && !guilds.some(g=>g.id===type.workGuildId) && <option value={type.workGuildId}>{type.workGuildId}</option>}
        {guilds.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
    </label>
    {type.workGuildId ? <>
      <input aria-label="Search queue roles" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search roles by name or Discord ID" className="w-full rounded-lg border border-white/10 bg-black/20 p-3 text-white" />
      <p className="text-xs text-slate-400">{selected.length} roles selected. Holding any selected role grants access to work this queue.</p>
      {loading && <p role="status">Loading Discord roles…</p>}
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2">
        {options.filter(r=>(r.name+' '+r.id).toLowerCase().includes(search.toLowerCase())).map(r=><label key={r.id} className="flex cursor-pointer items-center gap-3 rounded p-2 text-sm text-slate-200 hover:bg-white/5">
          <input type="checkbox" checked={selected.includes(r.id)} onChange={e=>onChange({workRoleIds:e.target.checked ? [...selected,r.id] : selected.filter(id=>id!==r.id),workRoleNames:{...type.workRoleNames,[r.id]:r.name}})} />
          <span>{r.name}<span className="block text-xs text-slate-500">{r.id}{r.missing && !loading ? ' · Unavailable role; remove before saving' : ''}</span></span>
        </label>)}
      </div>
    </> : <p className="text-xs text-slate-400">Current team permissions remain in place. Choose a guild to replace them with Discord roles.</p>}
    {error && <div role="alert" className="text-sm text-red-300">{error} <button type="button" className="underline" onClick={()=>setRetry(n=>n+1)}>Retry</button></div>}
  </div>;
}
