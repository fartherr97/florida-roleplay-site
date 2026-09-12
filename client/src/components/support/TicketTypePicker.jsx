import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, Shield, LifeBuoy } from "lucide-react";

import { api } from "../../lib/api";
import { DEPARTMENTS, departmentOf } from "../../lib/supportDepartments";

export default function TicketTypePicker({ types, onSelect }) {
  const [expanded, setExpanded] = useState(null);
  const [branding, setBranding] = useState([]);
  useEffect(() => {
    let active = true;
    api.recruitment().then(result => {
      if (active) setBranding(result?.departments || []);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const logoFor = dept => branding.find(entry => entry.id === dept.id || entry.id === `ad-${dept.id}` || entry.shortName?.toLowerCase() === dept.short.toLowerCase())?.logoUrl || dept.logo;
  const general = types.filter(type => !departmentOf(type));
  const groups = DEPARTMENTS.map(dept => ({ ...dept, queues: types.filter(type => departmentOf(type) === dept.id) })).filter(dept => dept.queues.length);
  const option = type => (
    <button type="button" key={type.id} onClick={() => onSelect(type)} className="group flex w-full items-center gap-4 rounded-xl border border-white/10 bg-white/[0.025] p-4 text-left transition hover:border-brand-400/50 hover:bg-brand-400/5 focus-visible:outline-2 focus-visible:outline-brand-400">
      <div className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{type.id === `dept_${departmentOf(type)}` ? 'General enquiry' : type.label}</span><span className="mt-1 block text-xs leading-relaxed text-slate-400">{type.blurb}</span></div>
      <ArrowRight className="size-4 shrink-0 text-slate-500 group-hover:text-brand-400" />
    </button>
  );
  return <div className="space-y-8">
    {groups.length > 0 && <div><h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300"><Shield className="size-4" />Department support</h2>
      <div className="grid items-start gap-3 sm:grid-cols-2">{groups.map(dept => <div key={dept.id} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
        <button type="button" aria-expanded={expanded === dept.id} aria-controls={`queues-${dept.id}`} onClick={() => setExpanded(expanded === dept.id ? null : dept.id)} className="flex w-full items-center gap-4 p-5 text-left hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-brand-400">
          <img src={logoFor(dept)} alt="" className="size-14 shrink-0 object-contain drop-shadow-md" onError={event => { if (!event.currentTarget.src.endsWith("/logo.png")) event.currentTarget.src = "/logo.png"; }} />
          <span className="flex-1"><span className="block font-semibold text-white">{dept.label}</span><span className="mt-1 block text-xs text-slate-400">{dept.queues.length} ticket {dept.queues.length === 1 ? 'option' : 'options'} · Choose a queue</span></span>
          <ChevronDown className={`size-4 shrink-0 text-slate-400 transition-transform duration-300 motion-reduce:transition-none ${expanded === dept.id ? 'rotate-180' : ''}`} />
        </button>
        <div id={`queues-${dept.id}`} aria-hidden={expanded !== dept.id} inert={expanded !== dept.id} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${expanded === dept.id ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="min-h-0 overflow-hidden"><div className="space-y-2 border-t border-white/10 p-3">{dept.queues.map(option)}</div></div>
        </div>
      </div>)}</div>
    </div>}
    {groups.length > 0 && general.length > 0 && <div role="separator" aria-label="Community support section" className="relative py-1">
      <div className="h-px bg-gradient-to-r from-amber-300/10 via-amber-400/80 to-orange-500/20" />
      <div aria-hidden="true" className="absolute inset-x-1/4 top-0 h-3 bg-amber-400/10 blur-lg" />
    </div>}
    {general.length > 0 && <div><h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300"><LifeBuoy className="size-4" />Community support</h2><div className="grid gap-3 sm:grid-cols-2">{general.map(option)}</div></div>}
    {!types.length && <p className="rounded-xl border border-white/10 p-6 text-sm text-slate-400">No ticket queues are available right now.</p>}
  </div>;
}
