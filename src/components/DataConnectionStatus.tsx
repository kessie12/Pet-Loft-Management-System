import { useApp } from '../context/AppContext';
export const DataConnectionStatus = () => {
  const { dataMode,dataStatus,dataError,refreshData,dismissDataError }=useApp();
  if(dataMode==='demo')return <div className="bg-amber-50 text-amber-900 px-4 py-2 text-center text-xs font-semibold">Demo preview — records stay in this browser. This preview does not write to Google Sheets or SQL.</div>;
  if(!dataError&&dataStatus==='ready')return null;
  return <div role={dataError?'alert':'status'} className={`px-4 py-3 text-sm flex flex-wrap justify-center items-center gap-3 ${dataError?'bg-rose-50 text-rose-900':'bg-emerald-50 text-emerald-900'}`}>
    <span>{dataError|| (dataStatus==='saving'?'Saving to the shared database…':'Connecting to the shared database…')}</span>
    {dataError&&<><button className="font-bold underline cursor-pointer" onClick={()=>void refreshData()}>Refresh connection</button><button className="underline cursor-pointer" onClick={dismissDataError}>Dismiss</button></>}
  </div>;
};
