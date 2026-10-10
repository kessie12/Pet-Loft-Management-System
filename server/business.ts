import type { Booking, Customer, StoreCreditRecord, ManualBookingInput } from '../src/types';
import { allocateBoardingRooms, normalizePendingDeposit, recordSettlement, reviewDeposit, validateRoomAssignments } from '../src/lib/bookingLogic';
import { buildCustomerRecord, normalizeCustomerContact, validateManualBooking, NewCustomerInput } from '../src/lib/manualEntry';
import { resolveRoomInventory, validateGroomingCapacity } from '../src/lib/systemRules';
import { defaultReceiptConfig, quoteBooking, quoteDeposit } from '../src/lib/pricing';
import type { Actor } from './auth';
import { requireShop } from './auth';
import { HttpError, requireValue } from './platform';
import type { Settings } from './settings';
import type { SheetData } from './sheets';
export interface BusinessCommand { action:string; data?:unknown; id?:string; updates?:unknown; amount?:number; method?:string; approved?:boolean; petIndex?:number; roomNumber?:string }
const amount=(value:number)=>{requireValue(Number.isFinite(value)&&value>=0&&value<=1000000&&Math.abs(value*100-Math.round(value*100))<0.00001,'Enter a valid amount with at most two decimal places.');return value;};
const creditAccess=(actor:Actor|null)=>{requireShop(actor);if(!actor!.canManageCredit)throw new HttpError(403,'Credit changes are restricted to the boss unless staff access is explicitly enabled.');};
const audit=(actor:Actor|null)=>({lastModifiedBy:actor?.name||'Customer',lastModifiedAt:new Date().toISOString()});
const numberFor=(prefix:string)=>`${prefix}-${new Date().toISOString().slice(0,7).replace('-','')}-${crypto.randomUUID().replace(/-/g,'').slice(0,12).toUpperCase()}`;
const allowedKeys=(value:unknown,keys:string[])=>{
  requireValue(value&&typeof value==='object'&&!Array.isArray(value),'Invalid record update.');
  requireValue(Object.keys(value as object).every(key=>keys.includes(key)),'This field cannot be changed through this action.');
};
export const applyBusinessCommand=(source:SheetData,settings:Settings,actor:Actor|null,command:BusinessCommand):{data:SheetData;result:Booking|Customer|StoreCreditRecord|boolean;recordId:string}=>{
  const data=structuredClone(source);const config=settings.config;const rooms=resolveRoomInventory(settings.rooms,config.customerBoardingRooms||[]);
  const findBooking=()=>{const b=data.bookings.find(x=>x.id===command.id);requireValue(b,'Booking not found.',404);return b;};
  const replace=(booking:Booking)=>{booking={...booking,...audit(actor)};data.bookings=data.bookings.map(b=>b.id===booking.id?booking:b);return booking;};
  const recordCredit=(input:Omit<StoreCreditRecord,'id'>,adjustment=false)=>{
    creditAccess(actor);const phone=normalizeCustomerContact(input.contact);const customer=data.customers.find(c=>c.contact===phone);requireValue(customer,'Choose an existing customer before recording credit.');
    requireValue(Number.isFinite(input.cashIn)&&Number.isFinite(input.bonusGift)&&Math.abs(input.cashIn*100-Math.round(input.cashIn*100))<0.00001&&Math.abs(input.bonusGift*100-Math.round(input.bonusGift*100))<0.00001,'Invalid credit amounts.');
    requireValue(adjustment||(input.cashIn>=0&&input.bonusGift>=0),'Top-up amounts must be zero or greater.');
    const balance=Math.round((customer.storeCredit+input.cashIn+input.bonusGift)*100)/100;requireValue(balance>=0,'Credit cannot be reduced below zero.');
    const record:StoreCreditRecord={...input,id:'cr-'+crypto.randomUUID(),contact:customer.contact,ownerName:customer.name,totalCredit:balance};data.storeCredits.push(record);customer.storeCredit=balance;customer.unusedBalance=balance;Object.assign(customer,audit(actor));return record;
  };
  if(command.action==='createCustomer'){
    requireShop(actor);allowedKeys(command.data,['name','contact','countryCode','email','igHandle','xhsHandle','petName','petBreed','vaxExpiryDate','notes']);
    const customer=buildCustomerRecord(command.data as NewCustomerInput,data.customers,'cust-'+crypto.randomUUID(),actor!.name);data.customers.push(customer);return {data,result:customer,recordId:customer.id};
  }
  if(command.action==='createCustomerBooking'||command.action==='createManualBooking'){
    const manual=command.action==='createManualBooking';if(manual)requireShop(actor);
    const input=command.data as ManualBookingInput;requireValue(input&&typeof input.customerName==='string'&&Array.isArray(input.pets),'Invalid booking.');
    const quoted=manual?null:quoteBooking(input,config);
    const totalAmount=manual?amount(input.totalAmountOverride!):amount(quoted!.total);
    validateManualBooking({...input,totalAmountOverride:totalAmount},manual?input.depositRequiredOverride:undefined);
    if(!manual)requireValue(!input.depositReceiptUrl||config.onlinePaymentEnabled,'Payment-proof uploads are currently closed.');
    const receivedProof=input.depositReceiptUrl;
    requireValue(!receivedProof||receivedProof.startsWith('/api/receipts/'),'Upload a valid receipt first.');
    const deposit=manual&&input.depositRequiredOverride!==undefined?input.depositRequiredOverride:quoteDeposit(totalAmount,config.depositConfig);
    const receipt=config.receiptConfig||defaultReceiptConfig;const id='book-'+crypto.randomUUID();const now=new Date().toISOString();
    const booking:Booking={id,bookingReference:'MPL-'+crypto.randomUUID().replace(/-/g,'').slice(0,16).toUpperCase(),bookingDate:now.slice(0,10),primaryService:input.primaryService,checkInDate:input.checkInDate,checkInTime:input.checkInTime,checkOutDate:input.checkOutDate,customerName:input.customerName.trim(),customerContact:normalizeCustomerContact(input.customerContact,input.countryCode),countryCode:input.countryCode||'+60',numberOfPets:input.pets.length,pets:structuredClone(input.pets),boardingBreakdown:quoted?.boardingBreakdown||input.boardingBreakdown,groomingBreakdown:quoted?.groomingBreakdown||input.groomingBreakdown,petSittingBreakdown:quoted?.petSittingBreakdown||input.petSittingBreakdown,dayCareFrequency:input.dayCareFrequency,petTaxiKm:input.petTaxiKm,status:receivedProof?'Deposit Verification Pending':'Booked',operationalAlert:'Pending WhatsApp',staffAssigned:manual?input.staffAssigned:undefined,totalAmount,depositRequired:deposit,depositPaid:0,depositReceiptUrl:receivedProof,depositMethod:receivedProof?'Bank Transfer / DuitNow QR':undefined,finalPaid:0,totalPaid:0,balanceDue:totalAmount,paymentStatus:receivedProof?'Deposit Verification Pending':totalAmount===0?'Paid':'Outstanding',invoiceNo:numberFor(receipt.invoicePrefix),notes:input.notes,...audit(actor)};
    validateGroomingCapacity(booking,data.bookings,config.groomingCapacity);if(booking.primaryService==='Boarding')booking.pets=allocateBoardingRooms(booking,data.bookings,rooms,config.roomAssignmentRules||[]);
    data.bookings.push(booking);
    let customer=data.customers.find(c=>c.contact===booking.customerContact);
    if(!customer){customer={id:'cust-'+crypto.randomUUID(),name:booking.customerName,contact:booking.customerContact,countryCode:booking.countryCode,storeCredit:0,unusedBalance:0,createdAt:now.slice(0,10),petName:booking.pets[0]?.petName,petBreed:booking.pets[0]?.breed,vaxExpiryDate:booking.pets[0]?.vaxExpiryDate,pets:[],...audit(actor)};data.customers.push(customer);}
    customer.pets||=[];for(const pet of booking.pets){const existing=customer.pets.findIndex(p=>p.petName===pet.petName&&p.species===pet.species);if(existing<0)customer.pets.push({...pet,assignedRoom:undefined});else customer.pets[existing]={...customer.pets[existing],...pet,assignedRoom:undefined};}
    return {data,result:booking,recordId:id};
  }
  requireShop(actor);
  if(command.action==='updateBooking'||command.action==='assignRoomToPet'){
    const current=findBooking();let updates=command.updates as Partial<Booking>;
    if(command.action==='assignRoomToPet'){requireValue(Number.isInteger(command.petIndex)&&current.pets[command.petIndex!]&&command.roomNumber,'Choose a valid pet and kennel.');updates={pets:current.pets.map((p,i)=>i===command.petIndex?{...p,assignedRoom:command.roomNumber}:p)};}
    allowedKeys(updates,['customerName','customerContact','pets','checkInDate','checkInTime','checkOutDate','status','operationalAlert','roomAlert','groomingAlert','feedingTaxiAlert','staffAssigned','totalAmount','depositRequired','depositPaid','depositDate','depositMethod','finalPaid','finalDate','finalMethod','totalPaid','balanceDue','paymentStatus','notes','lastModifiedBy','lastModifiedAt']);
    if(updates.customerContact)updates.customerContact=normalizeCustomerContact(updates.customerContact,current.countryCode);
    const candidate={...current,...updates};
    for(const value of [candidate.totalAmount,candidate.depositRequired,candidate.depositPaid,candidate.finalPaid])amount(value);
    requireValue(candidate.depositPaid+candidate.finalPaid<=candidate.totalAmount,'Paid amounts cannot exceed the booking total.');
    const financeChanged=candidate.depositPaid!==current.depositPaid||candidate.finalPaid!==current.finalPaid;
    requireValue(!(financeChanged&&(candidate.depositMethod==='Store Credit'||candidate.finalMethod==='Store Credit')),'Use the credit redemption action to change a credit payment.');
    if(current.paymentStatus==='Deposit Verification Pending')requireValue(!financeChanged&&candidate.status!=='Completed','Approve or reject the pending deposit first.');
    candidate.totalPaid=Math.round((candidate.depositPaid+candidate.finalPaid)*100)/100;candidate.balanceDue=Math.round((candidate.totalAmount-candidate.totalPaid)*100)/100;
    candidate.paymentStatus=current.paymentStatus==='Deposit Verification Pending'?'Deposit Verification Pending':candidate.status==='Cancelled'?'Cancelled':candidate.balanceDue===0?'Paid':candidate.depositPaid>0?'Deposit Paid':'Outstanding';
    requireValue(candidate.status!=='Completed'||candidate.balanceDue===0,'Record the outstanding payment before completing the booking.');
    if(updates.pets||updates.checkInDate||updates.checkOutDate||updates.status){validateRoomAssignments(candidate,data.bookings,rooms,config.roomAssignmentRules||[]);validateGroomingCapacity(candidate,data.bookings,config.groomingCapacity);}
    const result=replace(normalizePendingDeposit(candidate));return {data,result,recordId:result.id};
  }
  if(command.action==='deleteBooking'){
    const current=findBooking();requireValue(current.depositPaid===0&&current.finalPaid===0,'Bookings with recorded payments must be cancelled, not deleted.');data.bookings=data.bookings.filter(b=>b.id!==current.id);return {data,result:true,recordId:current.id};
  }
  if(command.action==='verifyDeposit'){
    const current=findBooking();const result=replace(reviewDeposit(current,Boolean(command.approved),command.amount??current.depositRequired,numberFor((config.receiptConfig||defaultReceiptConfig).depositPrefix),new Date().toISOString().slice(0,10),actor!.name));return {data,result,recordId:result.id};
  }
  if(command.action==='settlePickupBalance'){
    requireValue(command.method&&command.method!=='Store Credit','Use the credit redemption action for Store Credit.');const current=findBooking();const result=replace(recordSettlement(current,command.method,command.amount!,numberFor((config.receiptConfig||defaultReceiptConfig).finalPrefix),new Date().toISOString().slice(0,10)));return {data,result,recordId:result.id};
  }
  if(command.action==='applyStoreCreditToBooking'){
    creditAccess(actor);const booking=findBooking();const customer=data.customers.find(c=>c.contact===booking.customerContact);requireValue(customer&&customer.storeCredit>=command.amount!,'Insufficient customer credit.');
    booking.creditLedgerMigrated=true;
    const result=replace(recordSettlement(booking,'Store Credit',command.amount!,numberFor((config.receiptConfig||defaultReceiptConfig).finalPrefix),new Date().toISOString().slice(0,10)));
    recordCredit({topUpDate:new Date().toISOString().slice(0,10),contact:customer.contact,ownerName:customer.name,cashIn:-command.amount!,paymentMethod:'Store Credit Redemption',bonusGift:0,totalCredit:0,remark:`Applied to booking ${booking.bookingReference}`,receiptNo:result.finalReceiptNo},true);return {data,result:true,recordId:booking.id};
  }
  if(command.action==='addStoreCreditRecord'){const result=recordCredit(command.data as Omit<StoreCreditRecord,'id'>);return {data,result,recordId:result.id};}
  if(command.action==='updateStoreCreditRecord'){
    creditAccess(actor);allowedKeys(command.updates,['remark','receiptNo']);const result=data.storeCredits.find(c=>c.id===command.id);requireValue(result,'Credit record not found.',404);Object.assign(result,command.updates);return {data,result,recordId:result.id};
  }
  if(command.action==='updateCustomer'){
    const updates=command.updates as Partial<Customer>;allowedKeys(updates,['name','contact','countryCode','email','igHandle','xhsHandle','storeCredit','unusedBalance','unusedBalanceReason','petName','petBreed','vaxExpiryDate','notes','pets','lastModifiedBy','lastModifiedAt']);
    const customer=data.customers.find(c=>c.id===command.id);requireValue(customer,'Customer not found.',404);
    if(updates.unusedBalanceReason!==undefined&&updates.unusedBalanceReason!==customer.unusedBalanceReason)creditAccess(actor);
    const balance=updates.storeCredit??updates.unusedBalance;if(balance!==undefined&&balance!==customer.storeCredit)recordCredit({contact:customer.contact,ownerName:customer.name,topUpDate:new Date().toISOString().slice(0,10),cashIn:amount(balance)-customer.storeCredit,bonusGift:0,totalCredit:0,paymentMethod:'Shop Adjustment',remark:updates.unusedBalanceReason||'Profile credit adjustment'},true);
    if(updates.contact){const phone=normalizeCustomerContact(updates.contact,updates.countryCode||customer.countryCode);requireValue(!data.customers.some(c=>c.id!==customer.id&&c.contact===phone),'Another customer uses this phone number.');if(phone!==customer.contact){for(const b of data.bookings)if(b.customerContact===customer.contact)b.customerContact=phone;for(const c of data.storeCredits)if(c.contact===customer.contact)c.contact=phone;}updates.contact=phone;}
    Object.assign(customer,updates,audit(actor));if(updates.petName!==undefined||updates.petBreed!==undefined||updates.vaxExpiryDate!==undefined){customer.pets||=[];const primary=customer.pets[0];if(primary)Object.assign(primary,{petName:customer.petName,breed:customer.petBreed,vaxExpiryDate:customer.vaxExpiryDate});}
    return {data,result:customer,recordId:customer.id};
  }
  throw new HttpError(400,'Unknown record action.');
};
