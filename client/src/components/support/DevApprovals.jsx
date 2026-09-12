import {useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import Button from '../ui/Button';
import Card from '../ui/Card';
import VehicleModelPicker from './VehicleModelPicker';
import {api} from '../../lib/api';
import {formatDateTimeLocal} from '../../lib/format';
export default function DevApprovals({request,can,claim,approvals=[],mine,onChange}) {
  const [params]=useSearchParams();
  const [vehicles,setVehicles]=useState(null);
  const [selected,setSelected]=useState(params.get('vehicle') || '');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const personal=['leo_personal','civ_personal','supporter_personal'].includes(request.type);
  const relevant=personal || ['department_work','personal_change'].includes(request.type);
  const active=['pending','approved','in_progress'].includes(request.status);
  useEffect(()=>{
    if(!mine || !personal || !active || claim)return;
    let live=true;
    api.devVehicles().then(r=>live && setVehicles(r.vehicles.filter(v=>v.available && v.claimable && !v.claim))).catch(()=>live && setError('Could not load available vehicles.'));
    return()=>{live=false;};
  },[mine,personal,active,claim]);
  if(!relevant)return null;
  async function run(action){
    setBusy(true);setError('');
    try{const r=await action();if(!r?.ok)throw new Error(r?.message || 'Could not save.');await onChange();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const target=claim?.id || 'external';
  return <Card className="mt-5 space-y-4 p-5">
    <h2 className="font-bold text-white">Vehicle review</h2>
    {claim && <p className="text-sm text-slate-300">Requested model: <strong>{claim.name}</strong> · {claim.status === 'active' ? 'Approved' : 'Awaiting model approval'}</p>}
    {mine && personal && active && !claim && <div className="space-y-3">
      <p className="text-sm text-slate-400">Choose an available personal vehicle to request approval in this ticket.</p>
      <VehicleModelPicker vehicles={vehicles} value={selected} onChange={setSelected} disabled={busy}/>
      <Button disabled={busy || !vehicles?.some(v=>v.id===selected)} onClick={()=>run(()=>api.claimDevVehicle(selected,'',request.id))}>Claim model for approval</Button>
    </div>}
    <div className="flex flex-wrap gap-3">{[['model','Model',can.approveModel],['liveries','Liveries',can.approveLiveries]].map(([kind,label,allowed])=>{
      const current=approvals.find(a=>a.kind===kind && a.targetKey===target && !a.revokedAt);
      if(!allowed || (!active && !current))return null;
      return <Button key={kind} variant={current ? 'secondary' : 'primary'} disabled={busy} onClick={()=>run(()=>api.approveDevRequest(request.id,kind,current ? 'revoke' : 'approve',current?.id))}>{current ? 'Revoke' : 'Approve'} {label}</Button>;
    })}</div>
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    {approvals.length>0 && <div className="border-t border-white/10 pt-3"><h3 className="text-xs font-bold uppercase text-slate-400">Approval log</h3><ul className="mt-2 space-y-2 text-sm text-slate-300">{approvals.map(a=><li key={a.id}>{a.kind === 'model' ? 'Model' : 'Liveries'} approved by <strong>{a.actorName}</strong> · {formatDateTimeLocal(a.createdAt)}<span className="block text-xs text-slate-500">{a.targetKey === 'external' ? 'Original request' : `Claim ${a.targetKey}`} · Discord ID {a.actorId}</span>{a.revokedAt && <span className="mt-1 block text-amber-300">Revoked by <strong>{a.revokedByName}</strong> · {formatDateTimeLocal(a.revokedAt)} · Discord ID {a.revokedById}</span>}</li>)}</ul></div>}
  </Card>;
}
