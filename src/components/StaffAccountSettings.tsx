import {useState} from 'react';
import {useApp} from '../context/AppContext';
import type {StaffAccount} from '../types';
const blank=():StaffAccount&{password:string}=>({id:'',name:'',username:'',role:'Staff',phone:'',active:true,password:''});
export const StaffAccountSettings=()=>{
  const {staffMembers,saveStaffAccount,dataMode,dataStatus}=useApp();const [draft,setDraft]=useState(blank);const [message,setMessage]=useState('');
  const save=async(event:React.FormEvent)=>{event.preventDefault();setMessage('');try{await saveStaffAccount({...draft,password:draft.password||undefined});setDraft(blank());setMessage('Account saved. Changes end this account’s existing login sessions.');}catch(error){setMessage(error instanceof Error?error.message:'Unable to save account.');}};
  return <div className="grid lg:grid-cols-2 gap-5">
    <div className="bg-white border rounded-2xl p-5 space-y-3"><h3 className="font-bold">Individual Accounts</h3>
      {staffMembers.map(account=><div key={account.id} className="bg-slate-50 border rounded-xl p-3 flex justify-between items-center gap-3"><div><p className="font-bold">{account.name} <span className="text-xs font-normal">({account.role})</span></p><p className="text-xs text-slate-600">{account.username||'No individual login'} · {account.active?'Active':'Disabled'} · Credit: {account.role==='Boss'?'Allowed':account.canManageCredit===undefined?'Use staff default':account.canManageCredit?'Allowed':'View only'}</p></div><button className="font-bold text-amber-800 cursor-pointer" onClick={()=>{setDraft({...account,password:''});setMessage('');}}>Edit</button></div>)}
    </div>
    <form onSubmit={save} className="bg-white border rounded-2xl p-5 space-y-3 text-sm"><h3 className="font-bold">{draft.id?'Edit account':'Add account'}</h3>
      {dataMode==='demo'&&<p className="text-xs text-amber-800">Individual sign-in is available in cloud mode. This demo previews the account directory.</p>}
      <label className="block">Name<input required value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} className="block w-full border rounded-lg p-2"/></label>
      <label className="block">Login username<input required minLength={3} maxLength={80} value={draft.username||''} onChange={e=>setDraft({...draft,username:e.target.value})} className="block w-full border rounded-lg p-2" autoComplete="off"/></label>
      <label className="block">{draft.id?'New password (blank keeps current)':'Password (at least 12 characters)'}<input type="password" required={!draft.id} minLength={12} maxLength={256} value={draft.password} onChange={e=>setDraft({...draft,password:e.target.value})} className="block w-full border rounded-lg p-2" autoComplete="new-password"/></label>
      <label className="block">Role<select className="block w-full border rounded-lg p-2" value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value as 'Boss'|'Staff'})}><option>Staff</option><option>Boss</option></select></label>
      <label className="block">Phone<input value={draft.phone||''} onChange={e=>setDraft({...draft,phone:e.target.value})} className="block w-full border rounded-lg p-2"/></label>
      {draft.role==='Staff'&&<label className="block">Credit permissions<select className="block w-full border rounded-lg p-2" value={draft.canManageCredit===undefined?'inherit':draft.canManageCredit?'allow':'deny'} onChange={e=>setDraft({...draft,canManageCredit:e.target.value==='inherit'?undefined:e.target.value==='allow'})}><option value="inherit">Use staff default</option><option value="deny">View only</option><option value="allow">Allow credit modifications</option></select></label>}
      <label className="flex items-center gap-2"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/>Active account</label>
      <div className="flex gap-3"><button disabled={dataStatus==='saving'} type="submit" className="bg-amber-600 text-white px-4 py-2 rounded-lg font-bold cursor-pointer">Save account</button><button type="button" onClick={()=>setDraft(blank())} className="border px-4 py-2 rounded-lg cursor-pointer">New account</button></div>
      {message&&<p role="status" className="text-sm text-slate-700">{message}</p>}
    </form>
  </div>;
};
