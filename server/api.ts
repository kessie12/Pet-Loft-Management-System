import { FunctionContext, Env, HttpError, json, requireValue, digest } from './platform';
import { initialize, loadSettings, clientConfig, listAccounts, saveSettings, saveAccount, Settings } from './settings';
import { login, logout, requestActor, requireBoss, requireShop, rateLimit, AccountRow, Actor } from './auth';
import { SheetsRepository, sheetIdFromUrl } from './sheets';
import { applyBusinessCommand, BusinessCommand } from './business';
import { resolveRoomInventory, validateReceiptDataUrl, validateGroomingCapacity } from '../src/lib/systemRules';
import { validateRoomAssignments } from '../src/lib/bookingLogic';
import type { Room, SystemConfig } from '../src/types';
interface RequestRecord { id:string;digest:string;state:'pending'|'done'|'uncertain';record_id:string|null;created_at:number }
const originCheck=(request:Request)=>{
  if(['GET','HEAD'].includes(request.method))return;
  const origin=request.headers.get('Origin');const url=new URL(request.url);
  requireValue(origin===url.origin,'This request must come from the shop website.',403);
};
const readBody=async(request:Request,max=1500000)=>{
  requireValue(request.headers.get('Content-Type')?.includes('application/json'),'Send JSON data.',415);
  const reader=request.body?.getReader();requireValue(reader,'Request body missing.');let total=0;const parts:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();throw new HttpError(413,'The request is too large. Receipts must be at most 1 MB.');}parts.push(value);}
  const bytes=new Uint8Array(total);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new HttpError(400,'Invalid JSON request.');}
};
export const withShopLock=async<T>(env:Env,callback:()=>Promise<T>):Promise<T>=>{
  const owner=crypto.randomUUID();const now=Date.now();
  const row=await env.DB.prepare("INSERT INTO app_sheet_locks(sheet_id,owner,expires_at) VALUES('shop',?,?) ON CONFLICT(sheet_id) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE app_sheet_locks.expires_at<? RETURNING owner").bind(owner,now+300000,now).first<{owner:string}>();
  if(row?.owner!==owner)throw new HttpError(409,'Another save is in progress. Wait and retry the same action.');
  try{return await callback();}finally{await env.DB.prepare("DELETE FROM app_sheet_locks WHERE sheet_id='shop' AND owner=?").bind(owner).run();}
};
const repository=(env:Env,settings:Settings)=>{requireValue(settings.config.directGoogleSheetUrl,'The boss must configure the spreadsheet link.',503);return new SheetsRepository(env,sheetIdFromUrl(settings.config.directGoogleSheetUrl));};
const snapshot=async(env:Env,settings:Settings,actor:Actor|null,includeRecords=true)=>{
  const document=actor&&includeRecords?await repository(env,settings).read():undefined;
  return {systemConfig:clientConfig(settings,actor),rooms:settings.rooms,services:settings.services,staffMembers:actor?await listAccounts(env):[],account:actor?{id:actor.id,name:actor.name,role:actor.role,username:actor.username,canManageCredit:actor.canManageCredit}:null,revision:settings.revision,prepared:document?.prepared??false,...(includeRecords?(document?document.data:{bookings:[],customers:[],storeCredits:[]}):{}),mode:'cloud'};
};
const roomChanges=(updates:Record<string,unknown>)=>['customerBoardingRooms','roomAssignmentRules','groomingCapacity'].some(k=>k in updates);
const validateRoomChanges=async(env:Env,previous:Settings,next:Settings)=>{
  const document=await repository(env,previous).read();const rooms=resolveRoomInventory(next.rooms,next.config.customerBoardingRooms||[]);
  for(const booking of document.data.bookings){if(['Completed','Cancelled'].includes(booking.status))continue;validateRoomAssignments(booking,document.data.bookings,rooms,next.config.roomAssignmentRules||[]);validateGroomingCapacity(booking,document.data.bookings,next.config.groomingCapacity);}
};
const patchSettings=async(env:Env,actor:Actor|null,input:{revision:number;updates?:Record<string,unknown>;rooms?:Room[]})=>{
  requireBoss(actor);const previous=await loadSettings(env);requireValue(input.revision===previous.revision,'Settings changed on another device. Refresh first.',409);
  const updates=input.updates||{};requireValue(updates&&typeof updates==='object'&&!Array.isArray(updates),'Invalid settings.');
  const allowed=Object.keys(previous.config).filter(k=>!['staffCredentials','bossCredentials','directGoogleSheetUrl'].includes(k));
  requireValue(Object.keys(updates).every(k=>allowed.includes(k)||k==='receiptConfig'||k==='groomingPricing'),'Use the dedicated connection or account action for this setting.');
  const next={...previous,config:{...previous.config,...updates} as SystemConfig,rooms:input.rooms||previous.rooms};
  if(input.rooms||roomChanges(updates))await validateRoomChanges(env,previous,next);
  await saveSettings(env,next,previous.revision);return snapshot(env,await loadSettings(env),actor,false);
};
const commandAction=async(request:Request,env:Env,actor:Actor|null,input:BusinessCommand&{requestId:string})=>{
  requireValue(/^[a-f0-9-]{36}$/.test(input.requestId||''),'A request ID is required.');
  if(input.action!=='createCustomerBooking')requireShop(actor);
  const scoped=(actor?.id||'public')+':'+input.requestId;const requestDigest=await digest(JSON.stringify({...input,requestId:undefined}));
  return withShopLock(env,async()=>{
    const settings=await loadSettings(env);actor=await requestActor(request,env,Boolean(settings.config.staffCanManageCredit));
    if(input.action!=='createCustomerBooking')requireShop(actor);
    const repo=repository(env,settings);
    const uncertain=await env.DB.prepare("SELECT * FROM app_requests WHERE state='uncertain' ORDER BY created_at LIMIT 1").first<RequestRecord>();
    let document=await repo.read();
    if(uncertain){const op=uncertain.id;const confirmed=repo.hasOperation(document,op);
      if(confirmed)await env.DB.prepare("UPDATE app_requests SET state='done' WHERE id=?").bind(op).run();
      else if(Date.now()-uncertain.created_at<240000)throw new HttpError(409,'A previous save is awaiting Google confirmation. Wait four minutes before retrying; no new payment was recorded.');
      else await env.DB.prepare("UPDATE app_requests SET state='pending' WHERE id=?").bind(op).run();
    }
    const existing=await env.DB.prepare('SELECT * FROM app_requests WHERE id=?').bind(scoped).first<RequestRecord>();
    if(existing)requireValue(existing.digest===requestDigest,'This request ID belongs to a different change.',409);
    const duplicate=existing?.state==='done'||repo.hasOperation(document,scoped);
    if(duplicate){if(existing?.state!=='done')await env.DB.prepare("UPDATE app_requests SET state='done' WHERE id=?").bind(scoped).run();const id=existing?.record_id;const result=input.action==='applyStoreCreditToBooking'||input.action==='deleteBooking'?true:document.data.bookings.find(b=>b.id===id)||document.data.customers.find(c=>c.id===id)||document.data.storeCredits.find(c=>c.id===id);requireValue(result,'The earlier save succeeded, but its record was removed. Refresh before making another change.',409);return {result,...(actor?document.data:{}),prepared:document.prepared};}
    requireValue(document.prepared,'The boss must prepare the spreadsheet connection before records can be saved.',409);
    const applied=applyBusinessCommand(document.data,settings,actor,input);
    await env.DB.prepare("INSERT INTO app_requests(id,account_id,action,digest,state,record_id,created_at) VALUES(?,?,?,?,'pending',?,?) ON CONFLICT(id) DO UPDATE SET state='pending',record_id=excluded.record_id,created_at=excluded.created_at").bind(scoped,actor?.id||'public',input.action,requestDigest,applied.recordId,Date.now()).run();
    // Refresh immediately before writing so a detected spreadsheet edit is never overwritten.
    const fresh=await repo.read();requireValue(JSON.stringify(fresh.data)===JSON.stringify(document.data),'The spreadsheet changed while saving. Refresh and retry.',409);document=fresh;
    try{await repo.save(document,applied.data,scoped);}catch(error){await env.DB.prepare("UPDATE app_requests SET state='uncertain' WHERE id=?").bind(scoped).run();throw error;}
    await env.DB.prepare("UPDATE app_requests SET state='done' WHERE id=?").bind(scoped).run();
    return {result:applied.result,...(actor?applied.data:{}),prepared:true};
  });
};
export const handleApi=async(context:FunctionContext):Promise<Response>=>{
  const {request,env}=context;const url=new URL(request.url);const route=url.pathname.replace(/^\/api\/?/,'').replace(/\/$/,'');
  try{
    originCheck(request);await initialize(env);const settings=await loadSettings(env);const actor=await requestActor(request,env,Boolean(settings.config.staffCanManageCredit));
    if(route==='bootstrap'&&request.method==='GET'){
      // SQL/configuration and login continue to work when Sheets is unavailable.
      return json(await snapshot(env,settings,actor,url.searchParams.get('records')!=='false'));
    }
    if(route==='login'&&request.method==='POST'){const result=await login(request,env,await readBody(request,4096));return json({account:result.account},200,{'Set-Cookie':result.cookie});}
    if(route==='logout'&&request.method==='POST')return json({ok:true},200,{'Set-Cookie':await logout(request,env)});
    if(route==='settings'&&request.method==='PATCH'){const input=await readBody(request,1500000);return json(await withShopLock(env,async()=>{const current=await loadSettings(env);return patchSettings(env,await requestActor(request,env,Boolean(current.config.staffCanManageCredit)),input);}));}
    if(route==='accounts'&&request.method==='POST'){
      requireBoss(actor);const input=await readBody(request,10000);const id=await withShopLock(env,async()=>{const current=await loadSettings(env);const freshActor=await requestActor(request,env,Boolean(current.config.staffCanManageCredit));return saveAccount(env,freshActor,input);});return json({id,staffMembers:await listAccounts(env)});
    }
    if(route==='accounts/remove'&&request.method==='POST'){
      requireBoss(actor);const input=await readBody(request,1000);
      await withShopLock(env,async()=>{const current=await loadSettings(env);const freshActor=await requestActor(request,env,Boolean(current.config.staffCanManageCredit));requireBoss(freshActor);
        const row=await env.DB.prepare('SELECT * FROM app_accounts WHERE id=?').bind(input.id).first<AccountRow>();requireValue(row,'Account not found.',404);
        await saveAccount(env,freshActor,{...row,active:false,canManageCredit:row.credit_access===null?undefined:row.credit_access===1});});
      return json({staffMembers:await listAccounts(env)});
    }
    if(route==='connection/check'&&request.method==='POST'){
      requireBoss(actor);const input=await readBody(request,2000);const repo=new SheetsRepository(env,sheetIdFromUrl(input.url));const document=await repo.read();return json({prepared:document.prepared,counts:{bookings:document.data.bookings.length,customers:document.data.customers.length,credits:document.data.storeCredits.length},serviceAccount:env.GOOGLE_SERVICE_ACCOUNT_EMAIL});
    }
    if(route==='connection'&&request.method==='POST'){
      requireBoss(actor);const input=await readBody(request,2000);
      return json(await withShopLock(env,async()=>{const current=await loadSettings(env);requireBoss(await requestActor(request,env,Boolean(current.config.staffCanManageCredit)));requireValue(input.revision===current.revision,'Settings changed. Refresh before switching the Sheet.',409);const repo=new SheetsRepository(env,sheetIdFromUrl(input.url));const document=await repo.read();if(input.prepare)await repo.prepare(document);else requireValue(document.prepared,'Prepare the existing tabs before activating this Sheet.');await saveSettings(env,{...current,config:{...current.config,directGoogleSheetUrl:input.url}},current.revision);return snapshot(env,await loadSettings(env),actor);}));
    }
    if(route==='commands'&&request.method==='POST'){
      await rateLimit(env,'command:'+await digest(actor?.id||request.headers.get('CF-Connecting-IP')||'local'),actor?40:5);return json(await commandAction(request,env,actor,await readBody(request,100000)));
    }
    if(route==='lookup'&&request.method==='POST'){
      await rateLimit(env,'lookup:'+await digest(request.headers.get('CF-Connecting-IP')||'local'),10);const input=await readBody(request,2000);requireValue(typeof input.reference==='string'&&typeof input.contact==='string','Enter your full booking reference and phone number.');const phone=input.contact.replace(/\D/g,'');requireValue(phone.length>=8,'Enter your full phone number including country code.');const document=await repository(env,settings).read();const match=document.data.bookings.find(b=>b.bookingReference.toLowerCase()===input.reference.trim().toLowerCase()&&b.customerContact.replace(/\D/g,'')===phone);return json({bookings:match?[{...match,depositReceiptUrl:undefined,notes:undefined,lastModifiedBy:undefined}]:[]});
    }
    if(route==='receipts'&&request.method==='POST'){
      await rateLimit(env,'receipt:'+await digest(actor?.id||request.headers.get('CF-Connecting-IP')||'local'),actor?30:5);requireValue(actor||settings.config.onlinePaymentEnabled,'Payment-proof uploads are currently closed.',403);requireValue(env.RECEIPTS_BUCKET,'Bind the private receipt bucket in Cloudflare.',503);const input=await readBody(request);validateReceiptDataUrl(input.dataUrl);requireValue(typeof input.dataUrl==='string','Select a receipt.');const match=input.dataUrl.match(/^data:(image\/(?:png|jpeg)|application\/pdf);base64,(.+)$/)!;const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));const signature=match[1]==='image/png'?[137,80,78,71,13,10,26,10]:match[1]==='image/jpeg'?[255,216,255]:[37,80,68,70,45];requireValue(signature.every((byte,index)=>bytes[index]===byte),'The file contents do not match its PNG, JPG or PDF type.');const id=crypto.randomUUID();await env.RECEIPTS_BUCKET.put('receipts/'+id,bytes,{httpMetadata:{contentType:match[1]}});return json({url:'/api/receipts/'+id});
    }
    if(route.startsWith('receipts/')&&request.method==='GET'){
      requireShop(actor);requireValue(env.RECEIPTS_BUCKET,'Receipt storage unavailable.',503);const id=route.split('/')[1];requireValue(/^[a-f0-9-]{36}$/.test(id),'Invalid receipt ID.');const item=await env.RECEIPTS_BUCKET.get('receipts/'+id);requireValue(item,'Receipt not found.',404);return new Response(item.body,{headers:{'Content-Type':item.httpMetadata?.contentType||'application/octet-stream','Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
    }
    throw new HttpError(404,'API route not found.');
  }catch(error){const known=error instanceof HttpError;return json({error:known?error.message:error instanceof Error&&!/D1|SQLITE|secret|PRIVATE KEY|fetch|token|crypto/i.test(error.message)?error.message:'The server connection needs attention. Check Cloudflare bindings and secrets.'},known?error.status:400);}
};
