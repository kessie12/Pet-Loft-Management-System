import { useEffect,useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Room } from '../types';
export const PhysicalKennelSettings=()=>{
  const {rooms,systemConfig,savePhysicalRooms,dataStatus}=useApp();
  const [draft,setDraft]=useState<Room[]>(rooms);const [message,setMessage]=useState('');
  useEffect(()=>setDraft(rooms),[rooms]);
  const update=(id:string,changes:Partial<Room>)=>setDraft(prev=>prev.map(room=>room.id===id?{...room,...changes}:room));
  const types=systemConfig.customerBoardingRooms||[];
  const save=async()=>{setMessage('');try{await savePhysicalRooms(draft);setMessage('Kennels saved. The matrix and auto-room rules use this same inventory.');}catch(error){setMessage(error instanceof Error?error.message:'Unable to save kennels.');}};
  return <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
    <h2 className="text-lg font-bold">Physical Kennels</h2>
    <p className="text-sm text-slate-600">Manage kennel numbers, room types and cleaning availability. Price and capacity come from Boarding Rooms. Occupancy comes from bookings. Remove a kennel from preferred-room rules before deleting it.</p>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="p-2">Kennel</th><th className="p-2">Species</th><th className="p-2">Room type</th><th className="p-2">Capacity / price</th><th className="p-2">Availability</th><th className="p-2">Enabled</th><th></th></tr></thead><tbody>
      {draft.map(room=>{const type=types.find(t=>t.id===room.category&&t.species===room.species);return <tr key={room.id} className="border-b border-slate-100">
        <td className="p-2"><input aria-label={`Kennel number ${room.roomNumber}`} className="w-24 border rounded-lg p-2" value={room.roomNumber} onChange={e=>update(room.id,{roomNumber:e.target.value})}/></td>
        <td className="p-2"><select aria-label={`Species ${room.roomNumber}`} className="border rounded-lg p-2" value={room.species} onChange={e=>{const species=e.target.value as 'Dog'|'Cat';update(room.id,{species,category:types.find(t=>t.species===species)?.id||''});}}><option>Dog</option><option>Cat</option></select></td>
        <td className="p-2"><select aria-label={`Room type ${room.roomNumber}`} className="border rounded-lg p-2" value={room.category} onChange={e=>update(room.id,{category:e.target.value})}>{types.filter(t=>t.species===room.species).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></td>
        <td className="p-2">{type?.capacity??'—'} pets / RM {type?.price??'—'}</td>
        <td className="p-2"><select aria-label={`Availability ${room.roomNumber}`} className="border rounded-lg p-2" value={room.status==='cleaning'?'cleaning':'available'} onChange={e=>update(room.id,{status:e.target.value as Room['status']})}><option value="available">Available for allocation</option><option value="cleaning">Cleaning / maintenance</option></select></td>
        <td className="p-2"><input aria-label={`Enabled ${room.roomNumber}`} type="checkbox" checked={room.enabled!==false} onChange={e=>update(room.id,{enabled:e.target.checked})}/></td>
        <td className="p-2"><button className="text-rose-700 font-bold cursor-pointer" onClick={()=>setDraft(prev=>prev.filter(r=>r.id!==room.id))}>Remove</button></td>
      </tr>;})}
    </tbody></table></div>
    <div className="flex flex-wrap gap-3"><button className="border rounded-lg px-4 py-2 cursor-pointer" onClick={()=>{const type=types.find(t=>t.species==='Dog');if(!type)return;setDraft(prev=>[...prev,{id:'room-'+crypto.randomUUID(),roomNumber:'NEW-'+(prev.length+1),species:'Dog',category:type.id,basePrice:type.price,maxCapacity:type.capacity,description:type.desc,status:'available',enabled:true}]);}}>Add kennel</button><button disabled={dataStatus==='saving'} className="bg-amber-600 text-white font-bold px-4 py-2 rounded-lg cursor-pointer" onClick={()=>void save()}>Save kennels</button></div>
    {message&&<p role="status" className="text-sm text-slate-700">{message}</p>}
  </div>;
};
