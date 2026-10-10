import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
const load = async name => {
  const source = fs.readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};
const { validateReceiptFile, validateReceiptDataUrl, resolveRoomInventory, validateGroomingCapacity, canManageCredit, MAX_RECEIPT_BYTES } = await load('systemRules');
const { allocateBoardingRooms } = await load('bookingLogic');
const dog = {species:'Dog',weightBracket:'< 5kg',preferredRoomType:'Studio'};
const booking = changes => ({id:'new',primaryService:'Grooming',checkInDate:'2026-10-12',pets:[dog],status:'Booked',...changes});
const config = {activeDays:[1],maxDogsPerDay:2};
test('grooming rejects closed days, invalid dates and multi-dog overbooking', () => {
  assert.throws(()=>validateGroomingCapacity(booking({checkInDate:'2026-10-13'}),[],config),/closed/);
  assert.throws(()=>validateGroomingCapacity(booking({checkInDate:'2026-02-30'}),[],config),/valid/);
  assert.throws(()=>validateGroomingCapacity(booking({pets:[dog,dog]}),[booking({id:'other'})],config),/capacity/);
  assert.throws(()=>validateGroomingCapacity(booking(),[],{...config,maxDogsPerDay:0}),/capacity/);
});
test('rescheduling excludes itself but checks other reservations and reactivation', () => {
  const previous = booking({id:'new',pets:[dog,dog]});
  assert.doesNotThrow(()=>validateGroomingCapacity(previous,[previous],config));
  assert.throws(()=>validateGroomingCapacity(previous,[previous,booking({id:'other'})],config),/capacity/);
  assert.doesNotThrow(()=>validateGroomingCapacity(previous,[booking({id:'other',status:'Cancelled'})],config));
  assert.doesNotThrow(()=>validateGroomingCapacity(booking({status:'Cancelled',checkInDate:'2026-10-13'}),[],config));
});
test('cat grooming also respects active days without consuming dog capacity',()=>{
  assert.throws(()=>validateGroomingCapacity(booking({checkInDate:'2026-10-13',pets:[{species:'Cat'}]}),[],config),/closed/);
  assert.doesNotThrow(()=>validateGroomingCapacity(booking({pets:[{species:'Cat'}]}),[booking({id:'other',pets:[dog,dog]})],config));
});
test('receipt permits exactly one MB and rejects larger, empty and unsupported files',()=>{
  assert.doesNotThrow(()=>validateReceiptFile({size:MAX_RECEIPT_BYTES,type:'application/pdf'}));
  for(const size of [MAX_RECEIPT_BYTES+1,0,-1,Infinity,NaN]) assert.throws(()=>validateReceiptFile({size,type:'image/png'}));
  assert.throws(()=>validateReceiptFile({size:1,type:'text/html'}));
});
test('booking validation enforces decoded proof size and base64 structure',()=>{
  const prefix='data:image/png;base64,';
  assert.doesNotThrow(()=>validateReceiptDataUrl(prefix+Buffer.alloc(MAX_RECEIPT_BYTES).toString('base64')));
  assert.throws(()=>validateReceiptDataUrl(prefix+Buffer.alloc(MAX_RECEIPT_BYTES+1).toString('base64')));
  for(const value of [prefix+'!',prefix,'data:text/html;base64,YQ==','https://bad.example/proof']) assert.throws(()=>validateReceiptDataUrl(value));
});
test('staff credit access is opt-in and requires an authenticated shop role',()=>{
  assert.equal(canManageCredit('boss',true,false,false),true);
  assert.equal(canManageCredit('boss',false,true,true),false);
  assert.equal(canManageCredit('staff',true,true,false),false);
  assert.equal(canManageCredit('staff',false,true,true),true);
  assert.equal(canManageCredit('staff',true,false,true),false);
  assert.equal(canManageCredit('customer',true,true,true),false);
});
test('room changes update capacity, price, description and title without inventing physical rooms',()=>{
  const physical=[{id:'room1',roomNumber:'D-01',species:'Dog',category:'Studio',maxCapacity:1,basePrice:20,description:'old',status:'available'}];
  const types=[{id:'Studio',species:'Dog',title:'Updated Studio',price:99,capacity:3,desc:'updated',active:true}];
  const resolved=resolveRoomInventory(physical,types);
  assert.equal(resolved.length,1);assert.equal(resolved[0].maxCapacity,3);assert.equal(resolved[0].basePrice,99);
  assert.equal(resolved[0].categoryTitle,'Updated Studio');assert.equal(resolved[0].description,'updated');assert.equal(physical[0].maxCapacity,1);
  const b=booking({primaryService:'Boarding',checkOutDate:'2026-10-13',pets:[dog,dog],boardingBreakdown:{arrangement:'shared'}});
  assert.doesNotThrow(()=>allocateBoardingRooms(b,[],resolved,[]));
  assert.throws(()=>allocateBoardingRooms(b,[],resolved,[{species:'Dog',weightBracket:'< 5kg',preferredRooms:['D-01'],maxPetsPerRoom:1}]),/available/);
});
test('deleted or disabled room types cannot accept new reservations',()=>{
  const physical=[{roomNumber:'D-01',species:'Dog',category:'Studio',maxCapacity:1,status:'available'}];
  const b=booking({primaryService:'Boarding',checkOutDate:'2026-10-13'});
  assert.throws(()=>allocateBoardingRooms(b,[],resolveRoomInventory(physical,[]),[]),/available/);
  assert.throws(()=>allocateBoardingRooms(b,[],resolveRoomInventory(physical,[{id:'Studio',species:'Dog',capacity:2,active:false}]),[]),/available/);
});
