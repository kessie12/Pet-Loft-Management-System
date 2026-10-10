import {useState,useEffect} from 'react';
import {useApp} from '../context/AppContext';
import {defaultReceiptConfig} from '../lib/pricing';
export const ReceiptFormatSettings=()=>{
  const {systemConfig,updateSystemConfig}=useApp();const [draft,setDraft]=useState(systemConfig.receiptConfig||defaultReceiptConfig);const [message,setMessage]=useState('');
  useEffect(()=>setDraft(systemConfig.receiptConfig||defaultReceiptConfig),[systemConfig.receiptConfig]);
  const save=async()=>{try{await updateSystemConfig({receiptConfig:draft});setMessage('Receipt format saved. Existing document numbers stay the same.');}catch(error){setMessage(error instanceof Error?error.message:'Unable to save receipt format.');}};
  return <div className="border rounded-2xl bg-white p-6 space-y-4"><h2 className="font-bold text-lg">Receipt & Invoice Format</h2><p className="text-sm text-slate-600">Shop branding comes from Shop & Bank Profile. These options control printed documents. Number prefixes apply to newly issued documents.</p>
    <label className="block text-sm">Layout<select value={draft.layout} onChange={e=>setDraft({...draft,layout:e.target.value as 'standard'|'compact'})} className="block w-full max-w-sm border rounded-lg p-2"><option value="standard">Standard document</option><option value="compact">Compact document</option></select></label>
    <div className="grid sm:grid-cols-2 gap-4 text-sm">{([['invoiceTitle','Invoice heading'],['depositTitle','Deposit receipt heading'],['finalTitle','Payment receipt heading'],['invoicePrefix','Invoice number prefix'],['depositPrefix','Deposit receipt prefix'],['finalPrefix','Payment receipt prefix']] as const).map(([key,label])=><label key={key}>{label}<input value={draft[key]} maxLength={key.endsWith('Prefix')?16:100} onChange={e=>setDraft({...draft,[key]:e.target.value})} className="block w-full border rounded-lg p-2"/></label>)}</div>
    <label className="block text-sm">Closing message<textarea maxLength={500} value={draft.footer} onChange={e=>setDraft({...draft,footer:e.target.value})} className="block w-full border rounded-lg p-2"/></label>
    <div className="flex flex-wrap gap-5 text-sm">{([['showLogo','Show shop logo'],['showBankDetails','Show bank details'],['showSignature','Show signature space']] as const).map(([key,label])=><label key={key} className="flex gap-2 items-center"><input type="checkbox" checked={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.checked})}/>{label}</label>)}</div>
    <button className="bg-amber-600 text-white font-bold rounded-lg px-4 py-2 cursor-pointer" onClick={()=>void save()}>Save receipt format</button>{message&&<p role="status" className="text-sm">{message}</p>}
  </div>;
};
