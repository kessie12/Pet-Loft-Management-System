import {useEffect,useState} from 'react';
import {useApp} from '../context/AppContext';
import {defaultGroomingPricing,WEIGHTS,EXTRA_WEIGHTS} from '../lib/pricing';
import type {GroomingPricing} from '../types';
const matrix=[['shortCoat','Basic — short coat'],['longCoat','Basic — long coat'],['doubleCoat','Basic — double coat'],['shavedDown','Shaved down'],['summerCut','Full — summer cut'],['pantsCut','Full — pants cut'],['handCut','Full — hand cut']] as const;
export const GroomingPriceSettings=()=>{
  const {systemConfig,updateSystemConfig}=useApp();const [draft,setDraft]=useState(systemConfig.groomingPricing||defaultGroomingPricing);const [message,setMessage]=useState('');
  useEffect(()=>setDraft(systemConfig.groomingPricing||defaultGroomingPricing),[systemConfig.groomingPricing]);
  const editArray=(key:keyof GroomingPricing,index:number,price:number)=>setDraft(prev=>({...prev,[key]:(prev[key] as number[]).map((value,i)=>i===index?price:value)}));
  const save=async()=>{try{await updateSystemConfig({groomingPricing:draft});setMessage('Grooming prices saved for new bookings.');}catch(error){setMessage(error instanceof Error?error.message:'Unable to save prices.');}};
  return <div className="border rounded-2xl bg-white p-5 space-y-4"><h3 className="font-bold">Grooming Price List</h3><p className="text-xs text-slate-600">Prices are in RM. Existing bookings retain their recorded quote.</p>
    <div className="overflow-x-auto"><table className="text-sm w-full"><thead><tr><th className="text-left p-2">Package</th>{WEIGHTS.map(w=><th key={w} className="p-2">{w}</th>)}</tr></thead><tbody>{matrix.map(([key,label])=><tr key={key} className="border-t"><td className="p-2">{label}</td>{draft[key].map((price,i)=><td key={i} className="p-2"><input aria-label={`${label} ${WEIGHTS[i]}`} type="number" min={0} step="0.01" className="border rounded-lg p-2 w-20" value={price} onChange={e=>editArray(key,i,Number(e.target.value))}/></td>)}</tr>)}</tbody></table></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">{([['alaska','Alaska special breed'],['poodle','Standard Poodle'],['catSmall','Cat below 13 kg'],['catLarge','Cat 13 kg and above']] as const).map(([key,label])=><label key={key}>{label}<input type="number" min={0} step="0.01" value={draft[key]} onChange={e=>setDraft({...draft,[key]:Number(e.target.value)})} className="block w-full border rounded-lg p-2"/></label>)}</div>
    <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">{EXTRA_WEIGHTS.map((label,i)=><label key={label}>Extra {label}<input type="number" min={0} step="0.01" value={draft.extraWeight[i]} onChange={e=>editArray('extraWeight',i,Number(e.target.value))} className="block w-full border rounded-lg p-2"/></label>)}</div>
    <div className="grid sm:grid-cols-2 gap-3 text-sm">{draft.addons.map((addon,index)=><label key={addon.name}>{addon.name}<input type="number" min={0} step="0.01" value={addon.price} onChange={e=>setDraft({...draft,addons:draft.addons.map((a,i)=>i===index?{...a,price:Number(e.target.value)}:a)})} className="block w-full border rounded-lg p-2"/></label>)}</div>
    <button className="bg-amber-600 text-white font-bold rounded-lg px-4 py-2 cursor-pointer" onClick={()=>void save()}>Save grooming prices</button>{message&&<p role="status" className="text-sm">{message}</p>}
  </div>;
};
