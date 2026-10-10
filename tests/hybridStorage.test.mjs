import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadServer} from './serverLoader.mjs';
const {applyBusinessCommand}=await loadServer('server/business.ts');
const {decodeDocument,encodeEntity,SheetsRepository,META_HEADERS,SHEET_LAYOUT,sheetDate,preparationData,metadataFallbackFormula}=await loadServer('server/sheets.ts');
const {validateSettings,clientConfig}=await loadServer('server/settings.ts');
const {quoteBooking,quoteDeposit,defaultGroomingPricing,defaultReceiptConfig}=await loadServer('src/lib/pricing.ts');
const {initialSystemConfig,initialRooms,initialServices}=await loadServer('src/data/seedData.ts');
const settings=()=>({config:{...structuredClone(initialSystemConfig),groomingPricing:structuredClone(defaultGroomingPricing),receiptConfig:structuredClone(defaultReceiptConfig)},rooms:structuredClone(initialRooms),services:structuredClone(initialServices),revision:1});
const boss={id:'boss',name:'Boss',role:'Boss',username:'boss',canManageCredit:true};
const staff={id:'staff',name:'Staff',role:'Staff',username:'staff',canManageCredit:false};
const seed=()=>({customers:[{id:'c1',name:'Customer',contact:'+60123456789',storeCredit:100,createdAt:'2026-10-10'}],bookings:[],storeCredits:[]});
const input={customerName:'Customer',customerContact:'0123456789',primaryService:'Boarding',checkInDate:'2026-10-12',checkInTime:'10:00',checkOutDate:'2026-10-14',numberOfPets:1,pets:[{species:'Dog',weightBracket:'< 5kg',petName:'Pet',preferredRoomType:'Studio'}],totalAmountOverride:0};
test('public booking ignores a forged total and uses current SQL room prices',()=>{
 const config=settings();config.config.customerBoardingRooms.find(t=>t.species==='Dog'&&t.id==='Studio').price=50;
 const result=applyBusinessCommand(seed(),config,null,{action:'createCustomerBooking',data:input});
 assert.equal(result.result.totalAmount,100);assert.equal(result.result.pets[0].assignedRoom,'D-01');assert.equal(result.data.customers.length,1);assert.equal(result.data.customers[0].pets.length,1);
 assert.equal(seed().bookings.length,0);
});
test('booking creation enforces shared capacity using fresh spreadsheet records',()=>{
 const config=settings();config.rooms.push({...config.rooms.find(r=>r.species==='Dog'&&r.category==='Studio'),id:'extra-studio',roomNumber:'D-TEST'});const first=applyBusinessCommand(seed(),config,null,{action:'createCustomerBooking',data:input});
 const second=applyBusinessCommand(first.data,config,null,{action:'createCustomerBooking',data:input});
 assert.notEqual(second.result.pets[0].assignedRoom,first.result.pets[0].assignedRoom);
 const full={...first.data,bookings:config.rooms.filter(r=>r.species==='Dog'&&r.category==='Studio').map((r,i)=>({...first.result,id:'occupied-'+i,pets:[{...first.result.pets[0],assignedRoom:r.roomNumber}]}))};
 assert.throws(()=>applyBusinessCommand(full,config,null,{action:'createCustomerBooking',data:input}),/No Dog/);
});
test('server credit permission blocks staff; boss redemption updates booking, wallet and ledger together',()=>{
 const config=settings();const made=applyBusinessCommand(seed(),config,boss,{action:'createManualBooking',data:{...input,totalAmountOverride:100}});
 assert.throws(()=>applyBusinessCommand(made.data,config,staff,{action:'applyStoreCreditToBooking',id:made.result.id,amount:25}),/restricted/);
 const paid=applyBusinessCommand(made.data,config,boss,{action:'applyStoreCreditToBooking',id:made.result.id,amount:25});
 assert.equal(paid.data.customers[0].storeCredit,75);assert.equal(paid.data.bookings[0].balanceDue,75);assert.equal(paid.data.storeCredits[0].cashIn,-25);
 assert.equal(made.data.customers[0].storeCredit,100);
 const permission={...staff,canManageCredit:true};assert.doesNotThrow(()=>applyBusinessCommand(made.data,config,permission,{action:'applyStoreCreditToBooking',id:made.result.id,amount:25}));
});
test('server prevents financial forgery and accidental deletion of a paid booking',()=>{
 const config=settings();const made=applyBusinessCommand(seed(),config,boss,{action:'createManualBooking',data:{...input,totalAmountOverride:100}});
 assert.throws(()=>applyBusinessCommand(made.data,config,null,{action:'updateBooking',id:made.result.id,updates:{status:'Completed'}}),/Log in/);
 assert.throws(()=>applyBusinessCommand(made.data,config,staff,{action:'updateBooking',id:made.result.id,updates:{depositPaid:-10}}),/valid amount/);
 assert.throws(()=>applyBusinessCommand(made.data,config,staff,{action:'updateBooking',id:made.result.id,updates:{finalPaid:10,finalMethod:'Store Credit'}}),/redemption action/);
 const paid=applyBusinessCommand(made.data,config,boss,{action:'settlePickupBalance',id:made.result.id,amount:10,method:'Cash'});
 assert.throws(()=>applyBusinessCommand(paid.data,config,boss,{action:'deleteBooking',id:made.result.id}),/cancelled/);
});
test('all configured service prices participate in server quoting',()=>{
 const config=settings();config.config.groomingPricing.shortCoat[0]=77;config.config.groomingPricing.addons[0].price=9;
 const grooming={...input,primaryService:'Grooming',pets:[{...input.pets[0],groomingType:'Basic Grooming',additionalServices:['Nails Trimming & Filing']}]};
 assert.equal(quoteBooking(grooming,config.config).total,86);
 const daycare={...input,primaryService:'Day Care',dayCareFrequency:'Monthly'};config.config.dayCareConfig.tiers[0].monthlyRate=123;assert.equal(quoteBooking(daycare,config.config).total,123);
 const taxi={...input,primaryService:'Pet Taxi',petTaxiKm:5};config.config.petTaxiConfig.tiers[0].basePrice=40;config.config.petTaxiConfig.fuelChargePerKm=3;assert.equal(quoteBooking(taxi,config.config).total,55);
 const sitting={...input,primaryService:'Pet Sitting',petSittingBreakdown:{selectedAddons:[{code:'PS-W',quantity:2}]}};config.config.petSittingConfig.baseRates.small=40;config.config.petSittingConfig.addons.walkPer10Min=20;assert.equal(quoteBooking(sitting,config.config).total,80);
});
test('public settings never expose hashes, the private sheet link or staff permissions',()=>{
 const config=settings();const view=clientConfig(config,null);
 assert.equal(view.bossCredentials.passwordHash,undefined);assert.equal(view.staffCredentials.passwordHash,undefined);assert.equal(view.directGoogleSheetUrl,undefined);assert.equal(view.staffCanManageCredit,false);assert.deepEqual(view.roomAssignmentRules,[]);
});
test('SQL settings reject duplicate kennels and invalid prices or preferred room references',()=>{
 const config=settings();assert.doesNotThrow(()=>validateSettings(config));
 assert.throws(()=>validateSettings({...config,rooms:[...config.rooms,{...config.rooms[0],id:'other'}]}),/unique/);
 const invalid=settings();invalid.config.groomingPricing.shortCoat[0]=-1;assert.throws(()=>validateSettings(invalid),/zero or greater/);
 const rule=settings();rule.config.roomAssignmentRules[0].preferredRooms=['UNKNOWN'];assert.throws(()=>validateSettings(rule),/existing kennels/);
});
test('spreadsheet dates, multi-pet details and direct cell edits decode without losing identity',()=>{
 assert.equal(sheetDate(46205),'2026-07-02');
 const made=applyBusinessCommand(seed(),settings(),boss,{action:'createManualBooking',data:{...input,totalAmountOverride:100}}).result;
 made.pets.push({...made.pets[0],petName:'Second',assignedRoom:'D-02'});made.numberOfPets=2;
 const row=[];for(const [col,value] of encodeEntity('bookings',made)[0])row[col]=value;row[39]=made.id;row[40]=JSON.stringify(made);row[15]=125;
 const rows={bookings:[['Booking Date'],row],customers:Array.from({length:6},()=>[]),credits:[[]]};const decoded=decodeDocument(rows);
 assert.equal(decoded.bookings[0].id,made.id);assert.equal(decoded.bookings[0].pets.length,2);assert.equal(decoded.bookings[0].totalAmount,125);assert.equal(decoded.bookings[0].balanceDue,125);
});
test('one atomic Sheets batch saves redemption and preserves computed columns and formula-safe strings',async()=>{
 const config=settings();const made=applyBusinessCommand(seed(),config,boss,{action:'createManualBooking',data:{...input,totalAmountOverride:100}});
 const beforeRows={bookings:[[]],customers:Array.from({length:6},()=>[]),credits:[[]]};
 const entries={bookings:made.data.bookings,customers:made.data.customers,credits:made.data.storeCredits};
 for(const kind of Object.keys(SHEET_LAYOUT)){const l=SHEET_LAYOUT[kind];beforeRows[kind][l.header-1]||=[];META_HEADERS.forEach((h,i)=>beforeRows[kind][l.header-1][l.meta+i]=h);for(const entity of entries[kind]){const row=[];for(const [col,value] of encodeEntity(kind,entity)[0])row[col]=value;row[l.meta]=entity.id;row[l.meta+1]=JSON.stringify(entity);beforeRows[kind].push(row);}}
 const formulas=structuredClone(beforeRows);formulas.customers[6][10]='=KEEP_CREDIT_FORMULA';
 const document={rows:beforeRows,formulas,data:made.data,prepared:true,properties:Object.fromEntries(Object.values(SHEET_LAYOUT).map((l,i)=>[l.title,{sheetId:i,gridProperties:{rowCount:1000,columnCount:50}}]))};
 const paid=applyBusinessCommand(made.data,config,boss,{action:'applyStoreCreditToBooking',id:made.result.id,amount:25});paid.data.customers[0].name='=IMPORTXML("unsafe")';
 const writes=[];const repo=new SheetsRepository({},'test',async(path,init)=>{writes.push({path,body:JSON.parse(init.body)});return {};});
 await repo.save(document,paid.data,'retry-1');assert.equal(writes.length,1);assert.equal(writes[0].path,':batchUpdate');
 const requests=writes[0].body.requests;assert.ok(requests.some(r=>r.updateCells.range.sheetId===0));assert.ok(requests.some(r=>r.updateCells.range.sheetId===1));assert.ok(requests.some(r=>r.updateCells.range.sheetId===2));
 assert.ok(!requests.some(r=>r.updateCells.range.sheetId===1&&r.updateCells.range.startColumnIndex===10));
 const unsafe=requests.find(r=>r.updateCells.range.sheetId===1&&r.updateCells.range.startColumnIndex===1);assert.equal(unsafe.updateCells.rows[0].values[0].userEnteredValue.stringValue,'=IMPORTXML("unsafe")');
 const method=requests.find(r=>r.updateCells.range.sheetId===0&&r.updateCells.range.startColumnIndex===22);assert.equal(method.updateCells.rows[0].values[0].userEnteredValue.stringValue,'Credit Wallet (ledger)');
});

test('preparation preserves opening credit and migrates old redemption exactly once',async()=>{
 const made=applyBusinessCommand(seed(),settings(),boss,{action:'createManualBooking',data:{...input,totalAmountOverride:100}});
 made.data.customers[0].storeCredit=70;made.data.bookings[0].finalPaid=30;made.data.bookings[0].finalMethod='Store Credit';
 made.data.storeCredits=[{id:'legacy-credit-2',topUpDate:'2026-10-10',contact:made.data.customers[0].contact,ownerName:'Customer',cashIn:100,bonusGift:0,totalCredit:100,paymentMethod:'Cash',remark:''}];
 const prepared=preparationData(made.data);assert.equal(prepared.storeCredits.length,2);assert.equal(prepared.storeCredits.reduce((sum,c)=>sum+c.cashIn+c.bonusGift,0),70);assert.equal(prepared.customers[0].storeCredit,70);assert.deepEqual(preparationData(prepared),prepared);
 const rows={bookings:[[]],customers:Array.from({length:6},()=>[]),credits:[[]]};
 for(const kind of Object.keys(SHEET_LAYOUT))for(const entity of kind==='bookings'?made.data.bookings:kind==='customers'?made.data.customers:made.data.storeCredits){const row=[];for(const [col,value]of encodeEntity(kind,entity)[0])row[col]=value;row[SHEET_LAYOUT[kind].meta]=entity.id;rows[kind].push(row);}
 rows.bookings[1][22]='Store Credit';rows.customers[6][2]='60123456789 (owner contact)';
 const document={rows,formulas:structuredClone(rows),data:made.data,prepared:false,properties:Object.fromEntries([...Object.values(SHEET_LAYOUT).map((l,i)=>[l.title,{sheetId:i,gridProperties:{rowCount:1000,columnCount:50}}]),['Unpaid Balance',{sheetId:3,gridProperties:{rowCount:1000,columnCount:26}}]])};
 document.formulas.bookings[0][16]='=VSTACK("Deposit Required",{30})';
 const writes=[];const repo=new SheetsRepository({},'test',async(path,init)=>{if(!init?.method)return {valueRanges:[{values:[['=QUERY(\'Master Booking\'!A:AD,"SELECT D WHERE X > 0",1)']]}]};writes.push(JSON.parse(init.body));return {};});
 await repo.prepare(document);assert.equal(writes.length,1);const requests=writes[0].requests;
 assert.ok(requests.some(r=>r.updateCells?.range.sheetId===0&&r.updateCells.range.startColumnIndex===22&&r.updateCells.rows[0].values[0].userEnteredValue.stringValue==='Credit Wallet (ledger)'));
 assert.ok(!requests.some(r=>r.updateCells?.range.sheetId===1&&r.updateCells.range.startColumnIndex===2));
 const unpaid=requests.find(r=>r.updateCells?.range.sheetId===3);assert.match(unpaid.updateCells.rows[0].values[0].userEnteredValue.formulaValue,/WHERE Y > 0 AND B <> 'Cancelled'/);
 const wrapped=requests.find(r=>r.updateCells?.range.sheetId===0&&r.updateCells.range.startColumnIndex===16);assert.match(wrapped.updateCells.rows[0].values[0].userEnteredValue.formulaValue,/LET\(mpl_legacy,VSTACK/);
 const formula=metadataFallbackFormula('=VSTACK("Invoice No",{"INV-old"})','invoiceNo','Invoice No',false);assert.match(formula,/REGEXEXTRACT/);assert.ok(formula.includes('INV-old'));
});
test('grooming quotes use each pet weight and derive special breed pricing on the server',()=>{
 const config=settings().config;const grooming={...input,primaryService:'Grooming',numberOfPets:2,pets:[{...input.pets[0],isSpecialBreed:true},{...input.pets[0],weightBracket:'21 - 30 kg'}]};
 assert.equal(quoteBooking(grooming,config).total,38+68);
 grooming.pets[0].breed='Standard Poodle';grooming.pets[0].isSpecialBreed=false;assert.equal(quoteBooking(grooming,config).total,120+68);
});

test('deposit quotes match cents and never exceed the booking total',()=>{const config=settings().config.depositConfig;assert.equal(quoteDeposit(164,config),49.2);assert.equal(quoteDeposit(10,config),10);});
