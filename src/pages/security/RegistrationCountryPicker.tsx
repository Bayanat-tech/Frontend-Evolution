import {useEffect,useId,useRef,useState} from 'react';
import {Check,ChevronDown,Globe2,Search} from 'lucide-react';
import 'flag-icons/css/flag-icons.min.css';
export type RegistrationCountry={code:string;name:string;iso2:string|null;dialCode:string|null};
export function RegistrationCountryPicker({countries,value,onChange,dialing=false,disabled=false}:{countries:RegistrationCountry[];value:string;onChange:(country:RegistrationCountry)=>void;dialing?:boolean;disabled?:boolean}) {
 const [open,setOpen]=useState(false),[search,setSearch]=useState(''),[active,setActive]=useState(0);
 const wrapper=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),id=useId();
 const options=dialing?[...new Map(countries.filter(c=>c.iso2&&c.dialCode).map(c=>[c.iso2,c])).values()]:countries;
 const selected=options.find(c=>(dialing?c.iso2:c.code)===value);
 const matches=options.filter(c=>`${c.name} ${c.code} ${c.iso2||''} ${c.dialCode||''}`.toLowerCase().includes(search.toLowerCase()));
 const choose=(country:RegistrationCountry)=>{onChange(country);setOpen(false);setSearch('');};
 useEffect(()=>{if(!open)return;input.current?.focus();const close=(event:MouseEvent)=>{if(!wrapper.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close);},[open]);
 const flag=(country:RegistrationCountry)=>country.iso2?<span aria-hidden="true" className={`fi fi-${country.iso2.toLowerCase()} reg-country-flag`}/>:<Globe2 size={18} aria-hidden="true"/>;
 return <div className={`reg-country-picker ${dialing?'dialing':''}`} ref={wrapper}>
  <button type="button" disabled={disabled} aria-label={dialing?'Calling country':'Country'} aria-expanded={open} aria-haspopup="listbox" aria-controls={id} onClick={()=>{setOpen(!open);setSearch('');setActive(0);}} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();setOpen(true);}}}>
   {selected?<>{flag(selected)}<span>{dialing?selected.dialCode:selected.name}</span></>:<><Globe2 size={17}/><span>{dialing?'Code':'Choose country'}</span></>}<ChevronDown size={15}/>
  </button>
  {open&&<div className="reg-country-menu"><div className="reg-country-search"><Search size={15}/><input ref={input} role="combobox" aria-label={dialing?'Search calling countries':'Search countries'} aria-controls={id} aria-expanded="true" aria-autocomplete="list" aria-activedescendant={matches[active]?`${id}-${active}`:undefined} placeholder="Search country or code" value={search} onChange={event=>{setSearch(event.target.value);setActive(0);}} onKeyDown={event=>{
   if(event.key==='Escape'){event.preventDefault();setOpen(false);}else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setActive(index=>Math.max(0,Math.min(matches.length-1,index+(event.key==='ArrowDown'?1:-1))));}else if(event.key==='Enter'){event.preventDefault();if(matches[active])choose(matches[active]);}
  }}/></div><div role="listbox" id={id} aria-label={dialing?'Calling countries':'Countries'}>{matches.map((country,index)=><button type="button" role="option" id={`${id}-${index}`} key={country.code} aria-selected={(dialing?country.iso2:country.code)===value} className={active===index?'active':''} onMouseEnter={()=>setActive(index)} onClick={()=>choose(country)}>{flag(country)}<span>{country.name}<small>{country.code}</small></span><span>{country.dialCode}</span>{(dialing?country.iso2:country.code)===value&&<Check size={14}/>}</button>)}{!matches.length&&<p>No matching countries</p>}</div></div>}
 </div>;
}
