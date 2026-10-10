import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Clock } from 'lucide-react';

export const MyBookingLookup: React.FC = () => {
  const { systemConfig,lookupBooking } = useApp();
  const [searchTerm,setSearchTerm]=useState('');
  const [contact,setContact]=useState('');
  const [matchedBookings,setMatchedBookings]=useState<import('../types').Booking[]>([]);
  const [searched,setSearched]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const search=async()=>{setBusy(true);setError('');try{setMatchedBookings(await lookupBooking(searchTerm,contact));setSearched(true);}catch(error){setError(error instanceof Error?error.message:'Unable to look up booking.');}finally{setBusy(false);}};

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <span className="text-xs uppercase font-bold tracking-widest text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
          Customer Portal
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 mt-2">Check Your Booking Status</h1>
        <p className="text-sm text-slate-600 mt-1">
          Enter your full booking reference and WhatsApp number, including country code.
        </p>
      </div>

      <label className="block text-sm font-semibold mb-3">WhatsApp number (including country code)<input type="tel" value={contact} onChange={e=>setContact(e.target.value)} placeholder="e.g. +60123456789" className="block w-full bg-white border rounded-xl p-3 mt-1"/></label>
      {error&&<p role="alert" className="text-sm text-rose-700 mb-3">{error}</p>}
      {/* Search Input */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-8 flex gap-3">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Full booking reference"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void search()}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-amber-600 focus:outline-hidden"
          />
        </div>
        <button
          disabled={busy}
          onClick={()=>void search()}
          className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          Lookup
        </button>
      </div>

      {/* Search Results */}
      {searched && (
        <div className="space-y-4">
          {matchedBookings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="font-bold text-slate-800">No Bookings Found</h3>
              <p className="text-xs text-slate-500 mt-1">
                Please double check your phone number or contact our store directly via WhatsApp ({systemConfig.phone}).
              </p>
            </div>
          ) : (
            matchedBookings.map((b) => (
              <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {b.bookingReference}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">
                      {b.primaryService} for {b.customerName}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      b.status === 'Completed'
                        ? 'bg-slate-100 text-slate-800'
                        : b.status === 'Cancelled'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {b.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs mb-4">
                  <div>
                    <span className="text-slate-400 block">Check-In Date:</span>
                    <span className="font-bold text-slate-800">{b.checkInDate}</span>
                  </div>
                  {b.checkOutDate && (
                    <div>
                      <span className="text-slate-400 block">Check-Out Date:</span>
                      <span className="font-bold text-slate-800">{b.checkOutDate}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400 block">Deposit Status:</span>
                    <span className="font-bold text-amber-800">{b.paymentStatus}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">In-Store Balance Due:</span>
                    <span className="font-black text-slate-900 text-sm">RM {b.balanceDue}</span>
                  </div>
                </div>

                {/* Pets summary */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                  <span className="font-bold text-slate-700 block mb-1">
                    Pets Registered ({b.numberOfPets}):
                  </span>
                  <div className="space-y-1">
                    {b.pets.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between text-slate-600">
                        <span>
                          🐾 {p.species} • {p.petName || 'Unnamed'} ({p.weightBracket})
                        </span>
                        {p.assignedRoom && (
                          <span className="font-bold text-amber-700 bg-amber-100/60 px-1.5 py-0.5 rounded text-[11px]">
                            Room: {p.assignedRoom}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {b.petSittingBreakdown && (
                  <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/70 text-xs text-amber-950 space-y-1">
                    <span className="font-bold text-amber-900 block text-[11px] uppercase tracking-wider">
                      Pet Sitting Plan Breakdown
                    </span>
                    <div className="text-[11px] text-slate-700">
                      • 1st Pet Base ({b.petSittingBreakdown.firstPetWeightBracket}): <strong>RM {b.petSittingBreakdown.firstPetBaseRate}</strong>
                    </div>
                    {b.petSittingBreakdown.extraPetsList.length > 0 && (
                      <div className="text-[11px] text-slate-700">
                        • {b.petSittingBreakdown.extraPetsList.length} Extra Pet(s): <strong>RM {b.petSittingBreakdown.extraPetsList.reduce((s, p) => s + p.extraPetFee, 0)}</strong>
                      </div>
                    )}
                    {b.petSittingBreakdown.selectedAddons.length > 0 && (
                      <div className="text-[11px] text-slate-700">
                        • Add-on Services: {b.petSittingBreakdown.selectedAddons.map(a => `${a.name} (x${a.quantity})`).join(', ')} (<strong>RM {b.petSittingBreakdown.totalAddonsCost}</strong>)
                      </div>
                    )}
                    {b.petSittingBreakdown.peakSurcharge > 0 && (
                      <div className="text-[11px] text-slate-700">
                        • Peak Period Surcharge: <strong>RM {b.petSittingBreakdown.peakSurcharge}</strong>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Care Alert: <strong className="text-slate-800">{b.operationalAlert}</strong></span>
                  <span>Store WhatsApp: <strong className="text-slate-800">{systemConfig.phone}</strong></span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
