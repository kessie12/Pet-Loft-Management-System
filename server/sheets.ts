import type { Booking, BookingPet, Customer, StoreCreditRecord } from '../src/types';
import { normalizePendingDeposit } from '../src/lib/bookingLogic';
import { normalizeCustomerContact } from '../src/lib/manualEntry';
import { Env, HttpError, requireValue } from './platform';
export const SHEET_LAYOUT = {
  bookings:{title:'Master Booking',header:1,start:2,columns:39,meta:39,expected:{0:'Booking Date',1:'Status',2:'Service',5:'Contact',15:'Total Amount'}},
  customers:{title:'Customer & Pet Directory',header:6,start:7,columns:21,meta:21,expected:{1:'Owner Name',2:'Contact Number',3:'Pet Name'}},
  credits:{title:'Store Credit',header:1,start:2,columns:19,meta:19,expected:{0:'Top-Up Date',1:'Contact',3:'Cash In',6:'Total Credit'}},
} as const;
export const META_HEADERS=['MPL_ID','MPL_DATA','MPL_LAST_OPERATION','MPL_DELETED','MPL_SCHEMA'];
type Kind=keyof typeof SHEET_LAYOUT;
type Cell=string|number|boolean|null;
export interface SheetData { bookings:Booking[]; customers:Customer[]; storeCredits:StoreCreditRecord[] }
export interface SheetDocument {
  data:SheetData; rows:Record<Kind,Cell[][]>; formulas:Record<Kind,Cell[][]>;
  properties:Record<string,{sheetId:number;gridProperties:{rowCount:number;columnCount:number}}>; prepared:boolean;
}
interface ValueRange { values?:Cell[][] }
const string=(v:Cell|undefined)=>v===undefined||v===null?'':String(v);
const number=(v:Cell|undefined)=>{const value=Number(string(v).replace(/,/g,''));return Number.isFinite(value)?value:0;};
const round=(n:number)=>Math.round(n*100)/100;
export const columnName=(n:number)=>{let out='';for(let i=n+1;i>0;i=Math.floor((i-1)/26))out=String.fromCharCode(65+(i-1)%26)+out;return out;};
const sheetRange=(title:string,a1:string)=>`'${title.replace(/'/g,"''")}'!${a1}`;
export const sheetIdFromUrl=(url:string)=>{const match=url.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);if(!match)throw new HttpError(400,'Enter a valid Google Sheets link.');return match[1];};
export const sheetDate=(value:Cell|undefined):string=>{
  if(value===undefined||value===null||value==='')return '';
  if(typeof value==='number')return new Date(Date.UTC(1899,11,30)+Math.round(value)*86400000).toISOString().slice(0,10);
  const text=String(value);if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text;
  const parts=text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);if(parts)return `${parts[3]}-${parts[2].padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
  throw new HttpError(422,'A spreadsheet date needs review. Use a real date or YYYY-MM-DD.');
};
const serialDate=(value:string|undefined):number|string=>value?Math.round((Date.parse(value)-Date.UTC(1899,11,30))/86400000):'';
const contact=(value:Cell|undefined)=>{const raw=string(value).trim();const match=raw.match(/\+?\d[\d \t()-]{6,}\d/);if(!match)return '';try{return normalizeCustomerContact(match[0]);}catch{return '';}};
const inferredSpecies=(breed:string,room:string):BookingPet['species']=>/^C-/i.test(room)||/cat|domestic|british|persian|ragdoll|maine|bengal|siamese/i.test(breed)?'Cat':/rabbit/i.test(breed)?'Rabbit':/hamster/i.test(breed)?'Hamster':/bird/i.test(breed)?'Bird':'Dog';
const weight=(v:Cell|undefined):BookingPet['weightBracket']=>{
  const text=string(v);if(['< 5kg','6 - 12 kg','13 - 20 kg','21 - 30 kg','> 30 kg'].includes(text))return text as BookingPet['weightBracket'];
  const n=number(v);return n<=5?'< 5kg':n<=12?'6 - 12 kg':n<=20?'13 - 20 kg':n<=30?'21 - 30 kg':'> 30 kg';
};
const metadata=<T>(row:Cell[],offset:number):Partial<T>=>{
  const text=string(row[offset+1]);if(!text)return {};
  try{const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{throw new HttpError(422,'A hidden MPL_DATA cell is invalid. Restore that cell before saving.');}
};
export const decodeDocument=(rows:Record<Kind,Cell[][]>):SheetData=>{
  const bookings:Booking[]=[];const customers:Customer[]=[];const storeCredits:StoreCreditRecord[]=[];
  rows.bookings.forEach((row,index)=>{
    if(index<1||!row[0]||row[42]===true||row[42]==='true')return;
    const extra=metadata<Booking>(row,39);const id=string(row[39])||`legacy-book-${index+1}`;
    const service=string(row[2]);const mapped=service==='Hotel'?'Boarding':service==='Home Feeding'?'Pet Sitting':service;
    if(!['Boarding','Grooming','Pet Sitting','Day Care','Pet Taxi'].includes(mapped))throw new HttpError(422,`Master Booking row ${index+1} has an unsupported service (${service}). Review it before connecting.`);
    let pets:BookingPet[]=extra.pets?.length?structuredClone(extra.pets):[{petName:string(row[7]),breed:string(row[8]),species:inferredSpecies(string(row[8]),string(row[10])),weightBracket:weight(row[9])}];
    const names=string(row[7]).split(' | '),breeds=string(row[8]).split(' | '),weights=string(row[9]).split(' | '),rooms=string(row[10]).split(' | ');
    pets=pets.map((pet,i)=>({...pet,petName:names[i]??pet.petName,breed:breeds[i]??pet.breed,weightBracket:weights[i]===undefined?pet.weightBracket:weight(weights[i]),assignedRoom:rooms[i]||undefined,...(i===0?{vaxExpiryDate:sheetDate(row[11])||undefined,characteristics:string(row[13]),allergiesNotes:string(row[14])}:{})}));
    const depositPaid=number(row[17]),finalPaid=number(row[20]),totalAmount=number(row[15]),totalPaid=round(depositPaid+finalPaid),balanceDue=round(Math.max(0,totalAmount-totalPaid));
    const status=string(row[1])||'Booked';const pending=status==='Deposit Verification Pending'||extra.paymentStatus==='Deposit Verification Pending'&&depositPaid===0;
    const method=(v:Cell|undefined)=>string(v)==='Credit Wallet (ledger)'?'Store Credit':string(v)||undefined;
    bookings.push(normalizePendingDeposit({...extra,id,bookingReference:extra.bookingReference||`LEGACY-${String(index+1).padStart(6,'0')}`,bookingDate:sheetDate(row[0]),primaryService:mapped as Booking['primaryService'],checkInDate:sheetDate(row[3]),checkOutDate:sheetDate(row[4])||undefined,customerContact:contact(row[5]),customerName:string(row[6]),pets,numberOfPets:pets.length,status,operationalAlert:extra.operationalAlert||'Imported from Sheet',roomAlert:extra.roomAlert||string(row[27]),groomingAlert:extra.groomingAlert||string(row[28]),feedingTaxiAlert:extra.feedingTaxiAlert||string(row[29]),staffAssigned:string(row[12]),totalAmount,depositRequired:row[16]===undefined||row[16]===''?extra.depositRequired??0:number(row[16]),depositPaid,depositDate:sheetDate(row[18])||undefined,depositMethod:method(row[19]),finalPaid,finalDate:sheetDate(row[21])||undefined,finalMethod:method(row[22]),totalPaid,balanceDue,paymentStatus:status==='Cancelled'?'Cancelled':pending?'Deposit Verification Pending':balanceDue===0?'Paid':depositPaid>0?'Deposit Paid':'Outstanding',invoiceNo:string(row[35])||extra.invoiceNo||undefined,depositReceiptNo:string(row[36])||extra.depositReceiptNo||undefined,finalReceiptNo:string(row[37])||extra.finalReceiptNo||undefined,calendarEventId:string(row[38])||undefined} as Booking));
  });
  rows.customers.forEach((row,index)=>{
    if(index<6||!row[1]||row[24]===true||row[24]==='true')return;
    const extra=metadata<Customer>(row,21);const phone=contact(row[2]);const id=string(row[21])||(phone?`legacy-customer-${phone.replace(/\D/g,'')}`:`legacy-customer-row-${index+1}`);
    const pet:BookingPet={...(extra.pets?.find(p=>p.petName===string(row[3]))||{}),petName:string(row[3]),breed:string(row[4]),weightBracket:weight(row[5]),species:extra.pets?.find(p=>p.petName===string(row[3]))?.species||inferredSpecies(string(row[4]),''),vaxExpiryDate:sheetDate(row[6])||undefined,characteristics:string(row[7]),allergiesNotes:string(row[8]),birthDate:sheetDate(row[9])||undefined};
    const existing=customers.find(c=>c.id===id||phone&&c.contact===phone);
    if(existing){if(pet.petName&&!existing.pets?.some(p=>p.petName===pet.petName&&p.breed===pet.breed))existing.pets?.push(pet);return;}
    requireValue(!string(row[10]).startsWith('#'),`Customer credit formula on row ${index+1} needs repair.`,422);
    const balance=number(row[10]);customers.push({...extra,id,name:string(row[1]),contact:phone,storeCredit:balance,unusedBalance:balance,petName:pet.petName,petBreed:pet.breed,vaxExpiryDate:pet.vaxExpiryDate,pets:pet.petName?[pet]:[],createdAt:extra.createdAt||'Imported'});
  });
  rows.credits.forEach((row,index)=>{
    if(index<1||!row[0]||!row[1]||row[22]===true||row[22]==='true')return;
    const extra=metadata<StoreCreditRecord>(row,19);storeCredits.push({...extra,id:string(row[19])||`legacy-credit-${index+1}`,topUpDate:sheetDate(row[0]),contact:contact(row[1]),ownerName:string(row[2]),cashIn:number(row[3]),paymentMethod:string(row[4]),bonusGift:number(row[5]),totalCredit:extra.totalCredit??number(row[6]),remark:string(row[7]),receiptNo:string(row[8])||undefined});
  });
  for(const kind of ['bookings','storeCredits'] as const){if(new Set((kind==='bookings'?bookings:storeCredits).map(x=>x.id)).size!==(kind==='bookings'?bookings:storeCredits).length)throw new HttpError(422,'Duplicate hidden IDs found in the Sheet. Review copied rows before saving.');}
  return {bookings,customers,storeCredits};
};
let tokenCache:{email:string;key:string;token:string;until:number}|undefined;
const b64url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const accessToken=async(env:Env):Promise<string>=>{
  requireValue(env.GOOGLE_SERVICE_ACCOUNT_EMAIL&&env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,'Configure the Google service account in Cloudflare secrets.',503);
  if(tokenCache&&tokenCache.email===env.GOOGLE_SERVICE_ACCOUNT_EMAIL&&tokenCache.key===env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY&&tokenCache.until>Date.now())return tokenCache.token;
  const header=b64url(new TextEncoder().encode(JSON.stringify({alg:'RS256',typ:'JWT'})));const now=Math.floor(Date.now()/1000);
  const claim=b64url(new TextEncoder().encode(JSON.stringify({iss:env.GOOGLE_SERVICE_ACCOUNT_EMAIL,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})));
  const pem=env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g,'\n').replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
  const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=b64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(header+'.'+claim))));
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:header+'.'+claim+'.'+signature}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new HttpError(503,'Google authentication failed. Check the service-account secrets.');
  const value=await response.json() as {access_token:string;expires_in:number};
  tokenCache={email:env.GOOGLE_SERVICE_ACCOUNT_EMAIL,key:env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,token:value.access_token,until:Date.now()+Math.max(0,value.expires_in-120)*1000};return value.access_token;
};
export class SheetsRepository {
  constructor(private env:Env,public sheetId:string,private transport?: (path:string,init?:RequestInit)=>Promise<unknown>) {}
  async request(path:string,init:RequestInit={}):Promise<unknown>{
    if(this.transport)return this.transport(path,init);
    const token=await accessToken(this.env);
    // Writes are never retried blindly: an ambiguous response must be reconciled by operation ID.
    const read=!init.method||init.method==='GET';const attempts=read?3:1;
    for(let i=0;i<attempts;i++){
      let response:Response;
      try{response=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}${path}`,{...init,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000)});}catch{throw new HttpError(503,read?'Google Sheets is unavailable. No local replacement database was used.':'Google Sheets did not confirm this save. Retry the same operation; do not submit a new payment.');}
      if(response.ok)return response.json();
      if(read&&(response.status===429||response.status>=500)&&i<attempts-1){await new Promise(resolve=>setTimeout(resolve,300*2**i));continue;}
      throw new HttpError(response.status===403?403:503,response.status===403?'Share this spreadsheet with the service-account email as Editor.':'Google Sheets rejected the request. Check access, headers and protected cells.');
    }throw new HttpError(503,'Google Sheets is unavailable.');
  }
  async read():Promise<SheetDocument>{
    const info=await this.request('?fields=sheets(properties(sheetId,title,gridProperties))') as {sheets:{properties:{sheetId:number;title:string;gridProperties:{rowCount:number;columnCount:number}}}[]};
    const properties=Object.fromEntries(info.sheets.map(x=>[x.properties.title,x.properties]));
    for(const item of Object.values(SHEET_LAYOUT))requireValue(properties[item.title],`The Sheet needs the existing “${item.title}” tab.`,422);
    requireValue(properties['Unpaid Balance'],'The Sheet needs the existing “Unpaid Balance” tab.',422);
    const kinds=Object.keys(SHEET_LAYOUT) as Kind[];
    const query=new URLSearchParams({valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER'});
    kinds.forEach(kind=>{const l=SHEET_LAYOUT[kind];query.append('ranges',sheetRange(l.title,`A1:${columnName(properties[l.title].gridProperties.columnCount-1)}${properties[l.title].gridProperties.rowCount}`));});
    const result=await this.request('/values:batchGet?'+query) as {valueRanges:ValueRange[]};
    const rows=Object.fromEntries(kinds.map((kind,i)=>[kind,result.valueRanges[i].values||[]])) as Record<Kind,Cell[][]>;
    for(const kind of kinds){const l=SHEET_LAYOUT[kind];for(const [index,expected] of Object.entries(l.expected))requireValue(string(rows[kind][l.header-1]?.[Number(index)]).trim()===expected,`Unexpected ${l.title} header at ${columnName(Number(index))}${l.header}. Expected “${expected}”.`,422);}
    const fq=new URLSearchParams({valueRenderOption:'FORMULA'});kinds.forEach(kind=>{const l=SHEET_LAYOUT[kind];fq.append('ranges',sheetRange(l.title,`A1:${columnName(l.columns-1)}${Math.max(l.header,rows[kind].length)}`));});
    const raw=await this.request('/values:batchGet?'+fq) as {valueRanges:ValueRange[]};
    const formulas=Object.fromEntries(kinds.map((kind,i)=>[kind,raw.valueRanges[i].values||[]])) as Record<Kind,Cell[][]>;
    const prepared=kinds.every(kind=>{const l=SHEET_LAYOUT[kind];return META_HEADERS.every((header,i)=>rows[kind][l.header-1]?.[l.meta+i]===header);});
    return {data:decodeDocument(rows),rows,formulas,properties,prepared};
  }
  async batch(requests:unknown[]){if(requests.length)await this.request(':batchUpdate',{method:'POST',body:JSON.stringify({requests})});}
  async prepare(document:SheetDocument){
    const requests:unknown[]=[];
    for(const kind of Object.keys(SHEET_LAYOUT) as Kind[]){const l=SHEET_LAYOUT[kind];const p=document.properties[l.title];
      if(p.gridProperties.columnCount<l.meta+5)requests.push({appendDimension:{sheetId:p.sheetId,dimension:'COLUMNS',length:l.meta+5-p.gridProperties.columnCount}});
      for(let i=0;i<5;i++){const current=document.rows[kind][l.header-1]?.[l.meta+i];requireValue(!current||current===META_HEADERS[i],`Reserved columns in ${l.title} contain existing information. Move it before connecting.`,422);requests.push(cellUpdate(p.sheetId,l.header-1,l.meta+i,META_HEADERS[i]));}
      requests.push({updateDimensionProperties:{range:{sheetId:p.sheetId,dimension:'COLUMNS',startIndex:l.meta,endIndex:l.meta+5},properties:{hiddenByUser:true},fields:'hiddenByUser'}});
      // Assign IDs without touching any existing values or formulas.
      const entities=kind==='bookings'?document.data.bookings:kind==='customers'?document.data.customers:document.data.storeCredits;
      for(const entity of entities){const indices=this.rowIndices(document,kind,entity.id);for(const row of indices)if(!document.rows[kind][row]?.[l.meta])requests.push(cellUpdate(p.sheetId,row,l.meta,entity.id));}
    }
    const unpaid=document.properties['Unpaid Balance'];
    const q=new URLSearchParams({ranges:sheetRange('Unpaid Balance','A1'),valueRenderOption:'FORMULA'});
    const read=await this.request('/values:batchGet?'+q) as {valueRanges:ValueRange[]};const formula=string(read.valueRanges[0]?.values?.[0]?.[0]);
    if(/WHERE X > 0/i.test(formula)&&formula.startsWith('=QUERY('))requests.push(cellUpdate(unpaid.sheetId,0,0,formula.replace(/WHERE X > 0/i,"WHERE Y > 0 AND B <> 'Cancelled'"),true));
    // Keep existing document/date formulas as fallbacks, but let app-issued
    // numbers and booking-specific deposit terms take precedence for app rows.
    const master=document.properties['Master Booking'];
    for(const [col,field,title,numeric] of [[16,'depositRequired','Deposit Required',true],[35,'invoiceNo','Invoice No',false],[36,'depositReceiptNo','Deposit Receipt No',false],[37,'finalReceiptNo','Final Receipt No',false]] as const){
      const original=string(document.formulas.bookings[0]?.[col]);
      if(original.startsWith('=')&&!original.startsWith('=LET(mpl_legacy,'))requests.push(cellUpdate(master.sheetId,0,col,metadataFallbackFormula(original,field,title,numeric),true));
    }
    const next=preparationData(document.data);
    await this.save({...document,prepared:true},next,'prepare-'+crypto.randomUUID(),requests);
  }
  rowIndices(document:SheetDocument,kind:Kind,id:string):number[]{
    const l=SHEET_LAYOUT[kind];return document.rows[kind].map((row,i)=>{
      if(i<l.start-1)return -1;
      const legacy=kind==='bookings'?`legacy-book-${i+1}`:kind==='credits'?`legacy-credit-${i+1}`:row[1]?(contact(row[2])?`legacy-customer-${contact(row[2]).replace(/\D/g,'')}`:`legacy-customer-row-${i+1}`):'';
      return (string(row[l.meta])||legacy)===id?i:-1;
    }).filter(i=>i>=0);
  }
  hasOperation(document:SheetDocument,operation:string){return (Object.keys(SHEET_LAYOUT) as Kind[]).some(kind=>document.rows[kind].some(row=>row[SHEET_LAYOUT[kind].meta+2]===operation));}
  async save(before:SheetDocument,after:SheetData,operation:string,prefixRequests:unknown[]=[]){
    requireValue(before.prepared,'The boss must prepare the spreadsheet connection before records can be saved.',409);
    const requests:unknown[]=[...prefixRequests];
    for(const kind of Object.keys(SHEET_LAYOUT) as Kind[]){const l=SHEET_LAYOUT[kind],p=before.properties[l.title];
      const previous=kind==='bookings'?before.data.bookings:kind==='customers'?before.data.customers:before.data.storeCredits;
      const next=kind==='bookings'?after.bookings:kind==='customers'?after.customers:after.storeCredits;
      let lastUsed=l.start-2;before.rows[kind].forEach((row,i)=>{if(i>=l.start-1&&(row[kind==='customers'?1:0]||row[l.meta]))lastUsed=i;});let cursor=lastUsed+1;
      for(const entity of next){const old=previous.find(x=>x.id===entity.id);if(old&&JSON.stringify(old)===JSON.stringify(entity))continue;
        const entries=encodeEntity(kind,entity);const oldEntries=old?encodeEntity(kind,old):[];const existing=this.rowIndices(before,kind,entity.id);
        entries.forEach((cells,index)=>{const row=existing[index]??cursor++;if(row>=p.gridProperties.rowCount)throw new HttpError(422,`Add more rows to ${l.title} before saving.`);
          for(const [col,value] of cells){const migrateCredit=kind==='bookings'&&(col===19||col===22)&&(entity as Booking).creditLedgerMigrated&&!((old as Booking|undefined)?.creditLedgerMigrated)&&/^Store Credit/i.test(string(before.rows[kind][row]?.[col]));
            if(oldEntries[index]?.get(col)===value&&!migrateCredit)continue;const formula=string(before.formulas[kind][row]?.[col]);
            // Keep prefilled lookup formulas for new rows and array-derived columns.
            // An explicit edit to an existing input cell replaces its lookup formula.
            if((formula.startsWith('=')&&!old)||string(before.formulas[kind][l.header-1]?.[col]).startsWith('='))continue;
            requests.push(cellUpdate(p.sheetId,row,col,value));
          }
          const payload=JSON.stringify(entity);requireValue(payload.length<45000,'Record details exceed the spreadsheet cell limit.');
          [entity.id,payload,operation,false,1].forEach((value,i)=>requests.push(cellUpdate(p.sheetId,row,l.meta+i,value)));
          if(kind==='customers'&&!string(before.formulas[kind][row]?.[10]).startsWith('='))requests.push(cellUpdate(p.sheetId,row,10,creditBalanceFormula(row+1),true));
          if(kind==='credits'&&!string(before.formulas[kind][row]?.[6]).startsWith('='))requests.push(cellUpdate(p.sheetId,row,6,`=IF(D${row+1}="","",N(D${row+1})+N(F${row+1}))`,true));
        });
        // Keep rows stable for formulas and history; unused pet rows are tombstones.
        for(const row of existing.slice(entries.length)){requests.push(cellUpdate(p.sheetId,row,l.meta+3,true));requests.push(cellUpdate(p.sheetId,row,l.meta+2,operation));requests.push(cellUpdate(p.sheetId,row,1,''));}
      }
      for(const removed of previous.filter(x=>!next.some(y=>y.id===x.id))){for(const row of this.rowIndices(before,kind,removed.id)){requests.push(cellUpdate(p.sheetId,row,l.meta+3,true));requests.push(cellUpdate(p.sheetId,row,l.meta+2,operation));if(kind==='bookings')requests.push(cellUpdate(p.sheetId,row,1,'Cancelled'));}}
    }
    // All customer, payment and credit changes use ONE atomic Sheets batch.
    await this.batch(requests);
  }
}
export const cellUpdate=(sheetId:number,row:number,col:number,value:unknown,formula=false)=>({updateCells:{range:{sheetId,startRowIndex:row,endRowIndex:row+1,startColumnIndex:col,endColumnIndex:col+1},rows:[{values:[{userEnteredValue:formula?{formulaValue:String(value)}:typeof value==='number'?{numberValue:value}:typeof value==='boolean'?{boolValue:value}:{stringValue:value===undefined||value===null?'':String(value)}}]}],fields:'userEnteredValue'}});
export const creditBalanceFormula=(row:number)=>`=IF(B${row}="","",SUMIF('Store Credit'!B$2:B,C${row},'Store Credit'!G$2:G)-SUMIFS('Master Booking'!R$2:R,'Master Booking'!F$2:F,C${row},'Master Booking'!T$2:T,"Store Credit*")-SUMIFS('Master Booking'!U$2:U,'Master Booking'!F$2:F,C${row},'Master Booking'!W$2:W,"Store Credit*"))`;
export const encodeEntity=(kind:Kind,entity:Booking|Customer|StoreCreditRecord):Map<number,unknown>[]=>{
  if(kind==='bookings'){const b=entity as Booking;const method=(m?:string)=>m==='Store Credit'?'Credit Wallet (ledger)':m||'';
    return [new Map<number,unknown>([[0,serialDate(b.bookingDate)],[1,b.status],[2,b.primaryService],[3,serialDate(b.checkInDate)],[4,serialDate(b.checkOutDate)],[5,b.customerContact.replace(/\D/g,'')],[6,b.customerName],[7,b.pets.map(p=>p.petName||'').join(' | ')],[8,b.pets.map(p=>p.breed||'').join(' | ')],[9,b.pets.map(p=>p.weightBracket).join(' | ')],[10,b.pets.map(p=>p.assignedRoom||'').join(' | ')],[11,serialDate(b.pets[0]?.vaxExpiryDate)],[12,b.staffAssigned||''],[13,b.pets[0]?.characteristics||''],[14,b.pets[0]?.allergiesNotes||''],[15,b.totalAmount],[16,b.depositRequired],[17,b.depositPaid],[18,serialDate(b.depositDate)],[19,method(b.depositMethod)],[20,b.finalPaid],[21,serialDate(b.finalDate)],[22,method(b.finalMethod)],[23,b.totalPaid],[24,b.balanceDue],[25,b.paymentStatus],[26,b.serviceMonth||''],[27,b.roomAlert||''],[28,b.groomingAlert||''],[29,b.feedingTaxiAlert||''],[33,b.depositMonth||''],[34,b.finalMonth||''],[35,b.invoiceNo||''],[36,b.depositReceiptNo||''],[37,b.finalReceiptNo||''],[38,b.calendarEventId||'']])];
  }
  if(kind==='customers'){const c=entity as Customer;const pets=c.pets?.length?c.pets:[{petName:c.petName,breed:c.petBreed,vaxExpiryDate:c.vaxExpiryDate}];return pets.map(p=>new Map<number,unknown>([[1,c.name],[2,c.contact.replace(/\D/g,'')],[3,p.petName||''],[4,p.breed||''],[5,'weightBracket'in p?p.weightBracket:''],[6,serialDate(p.vaxExpiryDate)],[7,'characteristics'in p?p.characteristics||'':''],[8,'allergiesNotes'in p?p.allergiesNotes||'':c.notes||''],[9,serialDate('birthDate'in p?p.birthDate as string:undefined)]]));}
  const c=entity as StoreCreditRecord;return [new Map<number,unknown>([[0,serialDate(c.topUpDate)],[1,c.contact.replace(/\D/g,'')],[2,c.ownerName],[3,c.cashIn],[4,c.paymentMethod],[5,c.bonusGift],[7,c.remark],[8,c.receiptNo||'']])];
};

export const metadataFallbackFormula=(original:string,field:string,title:string,numeric:boolean)=>{
  const extraction=`REGEXEXTRACT(INDEX($AO$2:$AO,r),"""${field}"":${numeric?'([0-9.]+)':'""([^""]+)""'}")`;
  const value=numeric?`VALUE(${extraction})`:extraction;
  return `=LET(mpl_legacy,${original.slice(1)},IF(ROWS(mpl_legacy)=1,"${title}",VSTACK("${title}",MAP(SEQUENCE(ROWS(mpl_legacy)-1),LAMBDA(r,IFERROR(${value},INDEX(mpl_legacy,r+1,1)))))))`;
};
export const preparationData=(source:SheetData):SheetData=>{
  const next=structuredClone(source);const today=new Date().toISOString().slice(0,10);
  for(const customer of next.customers){
    const delta=next.storeCredits.filter(c=>c.contact===customer.contact).reduce((sum,c)=>sum+c.cashIn+c.bonusGift,0);
    const legacyUsed=next.bookings.filter(b=>b.customerContact===customer.contact&&!b.creditLedgerMigrated).reduce((sum,b)=>sum+(/^Store Credit/i.test(b.depositMethod||'')?b.depositPaid:0)+(/^Store Credit/i.test(b.finalMethod||'')?b.finalPaid:0),0);
    const difference=round(customer.storeCredit-(delta-legacyUsed));
    const openingId='opening-'+customer.id;
    if(difference!==0&&!next.storeCredits.some(c=>c.id===openingId))next.storeCredits.push({id:openingId,topUpDate:today,contact:customer.contact,ownerName:customer.name,cashIn:difference,bonusGift:0,totalCredit:customer.storeCredit,paymentMethod:'Opening balance reconciliation',remark:'Preserves the directory balance when connecting the existing tracker.'});
  }
  for(const booking of next.bookings){
    if(booking.creditLedgerMigrated)continue;
    for(const [field,amount,date,label] of [['depositMethod',booking.depositPaid,booking.depositDate,'deposit'],['finalMethod',booking.finalPaid,booking.finalDate,'final']] as const){
      const id=`legacy-credit-${booking.id}-${label}`;
      if(/^Store Credit/i.test(booking[field]||'')&&amount>0&&!next.storeCredits.some(c=>c.id===id)){
        next.storeCredits.push({id,topUpDate:date||booking.bookingDate,contact:booking.customerContact,ownerName:booking.customerName,cashIn:-amount,bonusGift:0,totalCredit:next.customers.find(c=>c.contact===booking.customerContact)?.storeCredit||0,paymentMethod:'Store Credit Redemption',remark:`Existing ${label} credit payment for ${booking.bookingReference}`,receiptNo:label==='deposit'?booking.depositReceiptNo:booking.finalReceiptNo});
        booking[field]='Store Credit';
      }
    }
    booking.creditLedgerMigrated=true;
  }
  return next;
};
