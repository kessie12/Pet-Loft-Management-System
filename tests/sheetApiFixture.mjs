// Synthetic tracker only. No customer records or credentials from the real Sheet.
export const sheetApiFixture=()=>{
 const titles=['Master Booking','Customer & Pet Directory','Store Credit','Unpaid Balance'];
 const sheets=new Map(['test-sheet','second-sheet'].map(id=>[id,{rows:Object.fromEntries(titles.map(t=>[t,[]])),formulas:Object.fromEntries(titles.map(t=>[t,[]]))}]));
 for(const sheet of sheets.values()){
  sheet.rows['Master Booking'][0]=[];Object.assign(sheet.rows['Master Booking'][0],{0:'Booking Date',1:'Status',2:'Service',5:'Contact',15:'Total Amount'});
  sheet.rows['Customer & Pet Directory']=Array.from({length:6},()=>[]);Object.assign(sheet.rows['Customer & Pet Directory'][5],{1:'Owner Name',2:'Contact Number',3:'Pet Name'});
  sheet.rows['Store Credit'][0]=[];Object.assign(sheet.rows['Store Credit'][0],{0:'Top-Up Date',1:'Contact',3:'Cash In',6:'Total Credit'});
  sheet.formulas['Unpaid Balance'][0]=['=QUERY(\'Master Booking\'!A:AD,"SELECT D, E, F, G, B, C, X, Y WHERE X > 0",1)'];
 }
 let writes=0,failAfterCommit=false,offline=false;
 const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 const recalculate=(sheet)=>{
  for(const row of sheet.rows['Store Credit'].slice(1))if(row)row[6]=(Number(row[3])||0)+(Number(row[5])||0);
  for(const row of sheet.rows['Customer & Pet Directory'].slice(6))if(row){const phone=String(row[2]);row[10]=sheet.rows['Store Credit'].slice(1).filter(r=>r&&String(r[1])===phone).reduce((sum,r)=>sum+r[6],0);}
 };
 return {sheets,get writes(){return writes;},set failAfterCommit(v){failAfterCommit=v;},set offline(v){offline=v;},async fetch(request){
  const url=new URL(request.url);
  if(url.hostname==='oauth2.googleapis.com')return response({access_token:'synthetic-access-token',expires_in:3600});
  if(url.hostname!=='sheets.googleapis.com')throw new Error('Unexpected external request: '+url.hostname);
  if(offline)return response({error:'Synthetic outage'},503);
  const id=url.pathname.match(/\/spreadsheets\/([^/:]+)/)?.[1],sheet=sheets.get(id);if(!sheet)return response({},404);
  if(url.pathname.endsWith(':batchUpdate')){
   const body=await request.json();const changed=structuredClone(sheet);
   for(const r of body.requests){if(!r.updateCells)continue;const {range,rows}=r.updateCells;const title=titles[range.sheetId];changed.rows[title][range.startRowIndex]||=[];changed.formulas[title][range.startRowIndex]||=[];const value=rows[0].values[0].userEnteredValue;
    if('formulaValue'in value){changed.formulas[title][range.startRowIndex][range.startColumnIndex]=value.formulaValue;}else{const plain=value.stringValue??value.numberValue??value.boolValue??'';changed.rows[title][range.startRowIndex][range.startColumnIndex]=plain;changed.formulas[title][range.startRowIndex][range.startColumnIndex]=plain;}
   }
   recalculate(changed);sheets.set(id,changed);writes++;
   if(failAfterCommit){failAfterCommit=false;return response({error:'Synthetic ambiguous response'},503);}
   return response({replies:[]});
  }
  if(url.pathname.endsWith('/values:batchGet')){
   recalculate(sheet);const render=url.searchParams.get('valueRenderOption');return response({valueRanges:url.searchParams.getAll('ranges').map(range=>{const title=range.match(/^'(.+)'!/)?.[1];return {values:render==='FORMULA'?sheet.rows[title].map((row,i)=>Array.from({length:Math.max(row?.length||0,sheet.formulas[title][i]?.length||0)},(_,j)=>sheet.formulas[title][i]?.[j]??row?.[j]??'')):sheet.rows[title]};})});
  }
  return response({sheets:titles.map((title,sheetId)=>({properties:{title,sheetId,gridProperties:{rowCount:1000,columnCount:50}}}))});
 }};
};
