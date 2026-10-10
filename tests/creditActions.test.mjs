import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
const load=async file=>{
 const source=fs.readFileSync(new URL(file,import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};
const {canManageCredit}=await load('../src/lib/systemRules.ts');
const {normalizeCustomerContact}=await load('../src/lib/manualEntry.ts');
const {recordSettlement}=await load('../src/lib/bookingLogic.ts');
const source=fs.readFileSync(new URL('../src/context/AppContext.tsx',import.meta.url),'utf8');
const tree=ts.createSourceFile('AppContext.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const selected=new Map();
const names=['requireShop','requireCreditAccess','recordCreditChange','addStoreCreditRecord','updateStoreCreditRecord','applyStoreCreditToBooking','updateCustomer'];
const visit=node=>{
 if(ts.isVariableDeclaration(node)&&names.includes(node.name.getText(tree))) selected.set(node.name.getText(tree),`const ${node.getText(tree)};`);
 ts.forEachChild(node,visit);
};
visit(tree);
assert.equal(selected.size,names.length);
const implementation=ts.transpileModule(names.map(name=>selected.get(name)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const harness=(role='staff',allowed=false)=>{
 const state={customers:[{id:'c1',name:'Test',contact:'+60123456789',countryCode:'+60',storeCredit:100}],credits:[],bookings:[{id:'b1',bookingReference:'TEST',customerContact:'+60123456789',status:'Booked',paymentStatus:'Outstanding',totalAmount:100,depositPaid:0,finalPaid:0,totalPaid:0,balanceDue:100}]};
 const customersRef={current:state.customers},bookingsRef={current:state.bookings};
 const setter=(name,ref)=>(action)=>{state[name]=action(state[name]);if(ref)ref.current=state[name];};
 const factory=new Function('role','isBossLoggedIn','isStaffLoggedIn','systemConfig','customersRef','bookingsRef','setCustomers','setStoreCredits','setBookings','canManageCredit','normalizeCustomerContact','recordSettlement','generateSeqNumber',`${implementation}\nreturn {addStoreCreditRecord,updateStoreCreditRecord,applyStoreCreditToBooking,updateCustomer};`);
 const actions=factory(role,role==='boss',role==='staff',{staffCanManageCredit:allowed},customersRef,bookingsRef,setter('customers',customersRef),setter('credits'),setter('bookings',bookingsRef),canManageCredit,normalizeCustomerContact,recordSettlement,()=> 'TEST-R02');
 return {state,...actions};
};
const topup={contact:'0123456789',ownerName:'Test',cashIn:10,bonusGift:5,totalCredit:999,paymentMethod:'Cash',topUpDate:'2026-10-09',remark:'Test'};
test('default staff cannot change credit through ledger, redemption or customer profile',()=>{
 const h=harness();
 assert.throws(()=>h.addStoreCreditRecord(topup),/restricted/);
 assert.throws(()=>h.updateStoreCreditRecord('credit',{remark:'edited'}),/restricted/);
 assert.throws(()=>h.applyStoreCreditToBooking('b1',10),/restricted/);
 assert.throws(()=>h.updateCustomer('c1',{storeCredit:200}),/restricted/);
 assert.doesNotThrow(()=>h.updateCustomer('c1',{notes:'care note'}));
 assert.equal(h.state.customers[0].storeCredit,100);assert.equal(h.state.credits.length,0);
});
test('explicit staff grant permits one validated top-up and redemption debit',()=>{
 const h=harness('staff',true);
 h.addStoreCreditRecord(topup);
 assert.equal(h.state.customers[0].storeCredit,115);assert.equal(h.state.credits[0].totalCredit,115);
 assert.equal(h.applyStoreCreditToBooking('b1',25),true);
 assert.equal(h.state.customers[0].storeCredit,90);assert.equal(h.state.bookings[0].balanceDue,75);
 assert.equal(h.state.credits[0].cashIn,-25);
});
test('boss credit adjustments create a ledger entry and invalid top-ups make no changes',()=>{
 const h=harness('boss');
 assert.throws(()=>h.addStoreCreditRecord({...topup,cashIn:-1}),/non-negative/);
 assert.throws(()=>h.addStoreCreditRecord({...topup,contact:'0199999999'}),/existing customer/);
 assert.throws(()=>h.updateStoreCreditRecord('x',{cashIn:200}),/cannot be overwritten/);
 h.updateCustomer('c1',{storeCredit:60,unusedBalance:60});
 assert.equal(h.state.customers[0].storeCredit,60);assert.equal(h.state.credits[0].cashIn,-40);
 assert.equal(h.state.credits[0].paymentMethod,'Shop Adjustment');
});
