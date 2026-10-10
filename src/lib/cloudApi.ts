import type { Booking, Customer, Room, ServiceItem, StaffAccount, StoreCreditRecord, SystemConfig } from '../types';
export const cloudMode = import.meta.env.VITE_DATA_MODE !== 'demo';
export interface CloudSnapshot {
  systemConfig?:SystemConfig; rooms?:Room[]; services?:ServiceItem[];staffMembers?:StaffAccount[];
  bookings?:Booking[];customers?:Customer[];storeCredits?:StoreCreditRecord[];
  account?:{id:string;name:string;role:'Boss'|'Staff';username:string;canManageCredit:boolean}|null;
  revision?:number;prepared?:boolean;
}
export const cloudRequest = async <T>(path:string,body?:unknown,method=body===undefined?'GET':'POST'):Promise<T> => {
  const response=await fetch('/api/'+path,{method,credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
  const type=response.headers.get('Content-Type')||'';
  if(!type.includes('application/json'))throw new Error('The Cloudflare API is not running. Start the Cloudflare preview or configure the deployed backend.');
  const result=await response.json();if(!response.ok)throw new Error(result.error||'The save failed.');return result as T;
};
const keyFor=async(body:unknown)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(body)))),b=>b.toString(16).padStart(2,'0')).join('');
export const cloudCommand=async<T>(action:string,payload:Record<string,unknown>):Promise<CloudSnapshot&{result:T}>=>{
  const body={action,...payload};const key='mpl_pending_'+await keyFor(body);
  // Keep only a retry ID in session storage, never customer data or credentials.
  const requestId=sessionStorage.getItem(key)||crypto.randomUUID();sessionStorage.setItem(key,requestId);
  const result=await cloudRequest<CloudSnapshot&{result:T}>('commands',{...body,requestId});sessionStorage.removeItem(key);return result;
};

export const uploadReceipt=async(dataUrl:string):Promise<string>=>{
  const key='mpl_receipt_retry_'+await keyFor(dataUrl);const existing=sessionStorage.getItem(key);if(existing)return existing;
  const result=await cloudRequest<{url:string}>('receipts',{dataUrl});sessionStorage.setItem(key,result.url);return result.url;
};
