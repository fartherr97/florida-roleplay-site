import {useEffect,useId,useRef,useState} from 'react';
import {ChevronDown,Search} from 'lucide-react';

export default function VehicleModelPicker({vehicles,value,onChange,disabled=false}) {
  const id=useId();
  const listRef=useRef(null);
  const inputRef=useRef(null);
  const [query,setQuery]=useState(null);
  const [open,setOpen]=useState(false);
  const [index,setIndex]=useState(0);
  const selected=vehicles?.find(v=>v.id===value);
  const needle=(query || '').trim().toLowerCase();
  const matches=(vehicles || []).filter(v=>[v.name,v.year,v.make,v.model,v.liveries].filter(Boolean).join(' ').toLowerCase().includes(needle));
  const activeIndex=Math.min(index,matches.length-1);
  const expanded=open && vehicles !== null && !disabled;
  useEffect(()=>{
    if(expanded)listRef.current?.children[activeIndex]?.scrollIntoView({block:'nearest'});
  },[activeIndex,expanded]);
  function choose(vehicle){onChange(vehicle.id);setQuery(null);setOpen(false);}
  function keyDown(event){
    if(event.key==='ArrowDown' || event.key==='ArrowUp'){
      event.preventDefault();setOpen(true);
      setIndex(current=>!expanded ? 0 : Math.max(0,Math.min(matches.length-1,current+(event.key==='ArrowDown' ? 1 : -1))));
    } else if(event.key==='Enter' && expanded){
      event.preventDefault();if(matches[activeIndex])choose(matches[activeIndex]);
    } else if(event.key==='Escape'){event.preventDefault();setOpen(false);}
  }
  return <div onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
    <label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-300">Available model</label>
    <div className="relative">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-500"/>
      <input ref={inputRef} id={id} role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={`${id}-options`} aria-activedescendant={expanded && activeIndex>=0 ? `${id}-${activeIndex}` : undefined}
        disabled={disabled || vehicles === null} autoComplete="off" value={query ?? selected?.name ?? ''}
        placeholder={vehicles === null ? 'Loading vehicles...' : 'Search model, make, year or livery...'}
        onFocus={()=>{setOpen(true);setIndex(0);}}
        onChange={event=>{setQuery(event.target.value);onChange('');setIndex(0);setOpen(true);}}
        onKeyDown={keyDown}
        className="w-full rounded-xl border border-white/10 bg-black/25 py-3 pl-10 pr-10 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400/60 disabled:opacity-50"/>
      <button type="button" aria-label="Show available models" disabled={disabled || vehicles === null} onClick={()=>{const next=!expanded;setQuery(null);inputRef.current?.focus();setOpen(next);setIndex(0);}} className="absolute right-1 top-1 rounded-lg p-2.5 text-slate-400 hover:text-white"><ChevronDown aria-hidden="true" className="size-4"/></button>
      {expanded && <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-white/15 bg-slate-950 shadow-xl">
        <ul id={`${id}-options`} role="listbox" aria-label="Available models" ref={listRef} className="max-h-72 overflow-y-auto overscroll-contain">
          {matches.map((vehicle,i)=><li key={vehicle.id} id={`${id}-${i}`} role="option" aria-selected={vehicle.id===value} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(vehicle)} onMouseEnter={()=>setIndex(i)} className={`cursor-pointer border-b border-white/5 px-4 py-3 text-sm last:border-0 ${i===activeIndex ? 'bg-amber-400/10' : 'hover:bg-white/5'}`}>
            <span className="block font-semibold text-white">{vehicle.name}</span>
            <span className="mt-1 block break-words text-xs text-slate-400">Existing liveries: {vehicle.liveries?.trim() || 'Not listed'}</span>
          </li>)}
        </ul>
        {!matches.length && <p role="status" className="p-4 text-sm text-slate-400">No available models match your search.</p>}
        <p role="status" className="border-t border-white/10 px-4 py-2 text-xs text-slate-500">{matches.length} available {matches.length===1 ? 'model' : 'models'}</p>
      </div>}
    </div>
    {selected && <p className="mt-2 text-xs text-slate-400">Existing liveries: {selected.liveries?.trim() || 'Not listed'}</p>}
  </div>;
}
