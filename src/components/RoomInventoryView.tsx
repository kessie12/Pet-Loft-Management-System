import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { staysOverlap } from '../lib/bookingLogic';
import { Home, Dog, Cat, ArrowRightLeft, LayoutGrid, List } from 'lucide-react';

export const RoomInventoryView: React.FC = () => {
  const { rooms, bookings, assignRoomToPet } = useApp();
  const [speciesFilter, setSpeciesFilter] = useState<'All' | 'Dog' | 'Cat'>('All');
  const [occupancyDate, setOccupancyDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('list');
  const [reassignModal, setReassignModal] = useState<{
    bookingId: string;
    petIndex: number;
    currentRoom: string;
    petName: string;
  } | null>(null);

  const activeBoardingBookings = bookings.filter(
    (b) => b.primaryService === 'Boarding' && b.status !== 'Cancelled' && b.status !== 'Completed'
  );

  const getPetsInRoom = (roomNumber: string) => {
    const list: Array<{ bookingId: string; petIndex: number; petName: string; species: string; dates: string }> = [];
    activeBoardingBookings.forEach((b) => {
      const followingDay = new Date(`${occupancyDate}T00:00:00Z`);
      followingDay.setUTCDate(followingDay.getUTCDate() + 1);
      if (!staysOverlap(b, { checkInDate: occupancyDate, checkOutDate: followingDay.toISOString().slice(0, 10) })) return;
      b.pets.forEach((p, idx) => {
        if (p.assignedRoom === roomNumber) {
          list.push({
            bookingId: b.id,
            petIndex: idx,
            petName: p.petName || 'Unnamed Pet',
            species: p.species,
            dates: `${b.checkInDate} to ${b.checkOutDate || 'TBD'}`,
          });
        }
      });
    });
    return list;
  };

  const filteredRooms = rooms.filter((r) => speciesFilter === 'All' || r.species === speciesFilter);

  return (
    <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Home className="w-6 h-6 text-amber-600" />
            Boarding Rooms &amp; Kennels Matrix
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Physical kennels use the capacity, rates and descriptions saved in Service Settings → Boarding Rooms. Auto-room weight rules may impose a lower limit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle: Card vs List */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'card' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Card View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'list' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List View
            </button>
          </div>

          {/* Species Filter */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setSpeciesFilter('All')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                speciesFilter === 'All' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({rooms.length})
            </button>
            <button
              onClick={() => setSpeciesFilter('Dog')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                speciesFilter === 'Dog' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Dog className="w-3.5 h-3.5" /> Dog ({rooms.filter(r => r.species === 'Dog').length})
            </button>
            <button
              onClick={() => setSpeciesFilter('Cat')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                speciesFilter === 'Cat' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Cat className="w-3.5 h-3.5" /> Cat ({rooms.filter(r => r.species === 'Cat').length})
            </button>
          </div>
        </div>
      </div>

      <label className="block text-sm font-bold">Occupancy date
        <input type="date" value={occupancyDate} onChange={e => setOccupancyDate(e.target.value || occupancyDate)} className="ml-3 border border-slate-300 rounded-lg p-2" />
      </label>
      {assignmentError && <p role="alert" className="text-sm text-rose-700">{assignmentError}</p>}
      {/* Render either List View or Card Grid */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Room #</th>
                <th className="py-3 px-3">Category &amp; Description</th>
                <th className="py-3 px-3">Species</th>
                <th className="py-3 px-3">Capacity</th>
                <th className="py-3 px-3">Rate / Night</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Current Residents</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRooms.map((room) => {
                const occupants = getPetsInRoom(room.roomNumber);
                const isOccupied = occupants.length > 0;
                const isFull = occupants.length >= room.maxCapacity;

                return (
                  <tr key={room.id} className="hover:bg-amber-50/30 transition-colors">
                    {/* Room # */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-slate-900 text-white">
                        {room.roomNumber}
                      </span>
                    </td>

                    {/* Category & Description */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{room.categoryTitle || room.category}</div>
                      <div className="text-[11px] text-slate-500">{room.description}</div>
                    </td>

                    {/* Species */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] border ${
                        room.species === 'Dog'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-purple-50 text-purple-800 border-purple-200'
                      }`}>
                        {room.species === 'Dog' ? <Dog className="w-3 h-3" /> : <Cat className="w-3 h-3" />}
                        {room.species}
                      </span>
                    </td>

                    {/* Capacity */}
                    <td className="py-3 px-3 whitespace-nowrap text-slate-700">
                      Max {room.maxCapacity} {room.species === 'Dog' ? 'dogs' : 'cats'}
                    </td>

                    {/* Rate / Night */}
                    <td className="py-3 px-3 whitespace-nowrap font-bold text-slate-900">
                      RM {room.basePrice}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                        isFull
                          ? 'bg-rose-100 text-rose-800 border-rose-200'
                          : isOccupied
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}>
                        {room.active === false ? 'Disabled' : room.status === 'cleaning' ? 'Cleaning' : isFull ? 'Full' : isOccupied ? `${occupants.length}/${room.maxCapacity} Occupied` : 'Available'}
                      </span>
                    </td>

                    {/* Current Residents */}
                    <td className="py-3 px-3">
                      {occupants.length === 0 ? (
                        <span className="text-slate-400 italic text-[11px]">No pet assigned</span>
                      ) : (
                        <div className="space-y-1">
                          {occupants.map((occ, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">{occ.petName}</span>
                              <span className="text-[10px] text-slate-500">({occ.dates})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 whitespace-nowrap text-right">
                      {occupants.length > 0 && (
                        <button
                          onClick={() =>
                            setReassignModal({
                              bookingId: occupants[0].bookingId,
                              petIndex: occupants[0].petIndex,
                              currentRoom: room.roomNumber,
                              petName: occupants[0].petName,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <ArrowRightLeft className="w-3 h-3 text-amber-600" />
                          Reassign
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid of Rooms */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRooms.map((room) => {
            const occupants = getPetsInRoom(room.roomNumber);
            const isOccupied = occupants.length > 0;
            const isFull = occupants.length >= room.maxCapacity;

            return (
              <div
                key={room.id}
                className={`rounded-2xl border p-5 transition-all bg-white shadow-xs flex flex-col justify-between ${
                  isFull
                    ? 'border-amber-300 ring-2 ring-amber-100'
                    : isOccupied
                    ? 'border-blue-200'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-base font-black px-2.5 py-1 rounded-lg bg-slate-900 text-white">
                      {room.roomNumber}
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      isFull
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : isOccupied
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {room.active === false ? 'Disabled' : room.status === 'cleaning' ? 'Cleaning' : isFull ? 'Full' : isOccupied ? `${occupants.length}/${room.maxCapacity} Occupied` : 'Available'}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm">{room.categoryTitle || room.category}</h3>
                  <p className="text-xs text-slate-500 mb-2">{room.description}</p>
                  <div className="text-xs font-semibold text-amber-800 mb-3">
                    RM {room.basePrice} / night • Max {room.maxCapacity} pets
                  </div>

                  {/* Occupants list */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 min-h-[60px] text-xs">
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Current Residents:</div>
                    {occupants.length === 0 ? (
                      <span className="text-slate-400 italic">No pet assigned currently</span>
                    ) : (
                      <div className="space-y-1.5">
                        {occupants.map((occ, i) => (
                          <div key={i} className="flex items-center justify-between text-slate-800 bg-white p-1.5 rounded-lg border border-slate-200">
                            <div>
                              <span className="font-bold">{occ.petName}</span>
                              <span className="text-[10px] text-slate-500 block">{occ.dates}</span>
                            </div>
                            <button
                              onClick={() =>
                                setReassignModal({
                                  bookingId: occ.bookingId,
                                  petIndex: occ.petIndex,
                                  currentRoom: room.roomNumber,
                                  petName: occ.petName,
                                })
                              }
                              title="Reassign to another room"
                              className="p-1 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reassign Modal */}
      {reassignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-amber-600" />
              Reassign Room for {reassignModal.petName}
            </h3>
            <p className="text-xs text-slate-500">
              Current Room: <strong>{reassignModal.currentRoom}</strong>
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select New Room:</label>
              <select
                id="select-new-room"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                defaultValue=""
              >
                <option value="" disabled>Choose room...</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.roomNumber} disabled={r.active === false || r.status === 'cleaning'}>
                    {r.roomNumber} - {r.categoryTitle || r.category} ({r.species}) - RM {r.basePrice}/night
                  </option>
                ))}
              </select>
            </div>

            {assignmentError && <p role="alert" className="text-sm text-rose-700">{assignmentError}</p>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setReassignModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
    try {

                  const selectEl = document.getElementById('select-new-room') as HTMLSelectElement;
                  if (selectEl && selectEl.value) {
                    try {
                      await assignRoomToPet(reassignModal.bookingId, reassignModal.petIndex, selectEl.value);
                      setAssignmentError(null);
                      setReassignModal(null);
                    } catch (error) {
                      setAssignmentError(error instanceof Error ? error.message : 'Unable to assign room.');
                    }
                  }
                
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                Save Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
