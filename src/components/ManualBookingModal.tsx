import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Booking, BookingPet, ServiceType, SpeciesType, WeightBracket } from '../types';
import { ShopEntryModal } from './ShopEntryModal';
import { entryInputClass } from './entryStyles';

const newPet = (): BookingPet => ({ petName: '', breed: '', species: 'Dog', weightBracket: '< 5kg', preferredRoomType: 'Superior Room' });
const species: SpeciesType[] = ['Dog', 'Cat', 'Rabbit', 'Hamster', 'Bird'];
const weights: WeightBracket[] = ['< 5kg', '6 - 12 kg', '13 - 20 kg', '21 - 30 kg', '> 30 kg'];
const serviceTypes: ServiceType[] = ['Boarding', 'Grooming', 'Pet Sitting', 'Day Care', 'Pet Taxi'];

export const ManualBookingModal: React.FC<{ onClose: () => void; onCreated: (booking: Booking) => void }> = ({ onClose, onCreated }) => {
  const { customers, createManualBooking, staffMembers, systemConfig, rooms } = useApp();
  const [customerId, setCustomerId] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [countryCode, setCountryCode] = useState('+60');
  const [service, setService] = useState<ServiceType>('Boarding');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [time, setTime] = useState('');
  const [pets, setPets] = useState<BookingPet[]>([newPet()]);
  const [housing, setHousing] = useState<'separate' | 'shared'>('separate');
  const [total, setTotal] = useState('');
  const [deposit, setDeposit] = useState('');
  const [assignedStaff, setAssignedStaff] = useState(staffMembers.find(s => s.active)?.name || '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const chooseCustomer = (id: string) => {
    setCustomerId(id);
    const customer = customers.find(c => c.id === id);
    setName(customer?.name || ''); setContact(customer?.contact || ''); setCountryCode(customer?.countryCode || '+60');
    setPets([{ ...newPet(), petName: customer?.petName || '', breed: customer?.petBreed || '', vaxExpiryDate: customer?.vaxExpiryDate }]);
  };
  const updatePet = (index: number, update: Partial<BookingPet>) => setPets(prev => prev.map((pet, i) => i === index ? { ...pet, ...update } : pet));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    try {
      if (!total.trim()) throw new Error('Enter the quoted booking total.');
      const quote = Number(total);
      const booking = await createManualBooking({
        customerName: name, customerContact: contact, countryCode, primaryService: service,
        checkInDate: checkIn, checkOutDate: service === 'Boarding' ? checkOut : undefined, checkInTime: time,
        numberOfPets: pets.length, pets, totalAmountOverride: quote,
        depositRequiredOverride: deposit.trim() ? Number(deposit) : undefined, staffAssigned: assignedStaff, notes,
        boardingBreakdown: service === 'Boarding' ? {
          arrangement: housing, roomType: pets.map(p => p.preferredRoomType || 'Own Cage').join(', '),
          roomPricePerNight: 0, nights: Math.max(1, Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000)),
          petsPerRoom: housing === 'shared' ? pets.length : 1, extraPetsCount: 0, extraPetPricePerNight: 0,
          totalRoomCost: quote, totalExtraPetsCost: 0, roomsCount: housing === 'shared' ? 1 : pets.length,
        } : undefined,
      });
      onCreated(booking);
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to add booking.'); }
  };
  return (
    <ShopEntryModal title="Add Booking" onClose={onClose}>
      <p className="text-sm text-slate-600 mb-4">Record a phone, WhatsApp or walk-in booking directly. Confirm received deposits separately after saving.</p>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-semibold">
          <label className="sm:col-span-2">Customer<select autoFocus value={customerId} onChange={e => chooseCustomer(e.target.value)} className={entryInputClass}>
            <option value="">New customer / enter details</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name} — {customer.contact}</option>)}
          </select></label>
          <label>Customer name *<input required readOnly={Boolean(customerId)} value={name} onChange={e => setName(e.target.value)} className={entryInputClass} /></label>
          <label>Phone / WhatsApp *<input required type="tel" readOnly={Boolean(customerId)} value={contact} onChange={e => setContact(e.target.value)} className={entryInputClass} /></label>
          <label>Country code<select disabled={Boolean(customerId)} value={countryCode} onChange={e => setCountryCode(e.target.value)} className={entryInputClass}>{['+60', '+65', '+62', '+86', '+852', '+91', '+44', '+1', '+61'].map(code => <option key={code}>{code}</option>)}</select></label>
          <label>Service *<select value={service} onChange={e => setService(e.target.value as ServiceType)} className={entryInputClass}>{serviceTypes.map(s => <option key={s}>{s}</option>)}</select></label>
          <label>Service / check-in date *<input required type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className={entryInputClass} /></label>
          <label>Arrival / appointment time *<input required type="time" value={time} onChange={e => setTime(e.target.value)} className={entryInputClass} /></label>
          {service === 'Boarding' && <>
            <label>Check-out date *<input required type="date" min={checkIn || undefined} value={checkOut} onChange={e => setCheckOut(e.target.value)} className={entryInputClass} /></label>
            <label>Housing<select value={housing} onChange={e => setHousing(e.target.value as 'separate' | 'shared')} className={entryInputClass}><option value="separate">Separate room for each pet</option><option value="shared">Share one room (same species and room type)</option></select></label>
          </>}
        </div>
        <div className="space-y-3">
          {pets.map((pet, index) => {
            const options = (systemConfig.customerBoardingRooms || []).filter(r => r.species === pet.species && r.active !== false && rooms.some(room => room.species === pet.species && room.category === r.id));
            return <fieldset key={index} className="p-4 border border-slate-200 rounded-xl">
              <legend className="text-sm font-bold px-1">Pet {index + 1}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-semibold">
                <label>Pet name<input value={pet.petName || ''} onChange={e => updatePet(index, { petName: e.target.value })} className={entryInputClass} /></label>
                <label>Breed<input value={pet.breed || ''} onChange={e => updatePet(index, { breed: e.target.value })} className={entryInputClass} /></label>
                <label>Species *<select value={pet.species} onChange={e => updatePet(index, { species: e.target.value as SpeciesType, preferredRoomType: (systemConfig.customerBoardingRooms || []).find(r => r.species === e.target.value && r.active !== false)?.id })} className={entryInputClass}>{species.map(s => <option key={s}>{s}</option>)}</select></label>
                <label>Weight *<select value={pet.weightBracket} onChange={e => updatePet(index, { weightBracket: e.target.value as WeightBracket })} className={entryInputClass}>{weights.map(w => <option key={w}>{w}</option>)}</select></label>
                {service === 'Boarding' && (pet.species === 'Dog' || pet.species === 'Cat') && <label>Room type *<select required value={pet.preferredRoomType || ''} onChange={e => updatePet(index, { preferredRoomType: e.target.value })} className={entryInputClass}><option value="">Choose room type</option>{options.map(r => <option key={r.id} value={r.id}>{r.title} — RM {r.price}/night</option>)}</select></label>}
                <label>Care notes<input value={pet.allergiesNotes || ''} onChange={e => updatePet(index, { allergiesNotes: e.target.value })} className={entryInputClass} /></label>
              </div>
              {pets.length > 1 && <button type="button" onClick={() => setPets(prev => prev.filter((_, i) => i !== index))} className="text-sm text-rose-700 mt-3 cursor-pointer">Remove pet {index + 1}</button>}
            </fieldset>;
          })}
          <button type="button" onClick={() => setPets(prev => [...prev, newPet()])} className="text-sm font-bold text-amber-800 cursor-pointer">+ Add another pet</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-semibold">
          <label>Quoted total (RM) *<input required type="number" min="0" step="0.01" value={total} onChange={e => setTotal(e.target.value)} className={entryInputClass} /></label>
          <label>Required deposit (RM)<input type="number" min="0" step="0.01" max={total || undefined} placeholder="Use configured deposit formula" value={deposit} onChange={e => setDeposit(e.target.value)} className={entryInputClass} /></label>
          <label>Assigned staff<select value={assignedStaff} onChange={e => setAssignedStaff(e.target.value)} className={entryInputClass}>{staffMembers.filter(s => s.active).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></label>
        </div>
        <label className="block text-sm font-semibold">Booking notes<textarea value={notes} onChange={e => setNotes(e.target.value)} className={entryInputClass} rows={2} /></label>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-600 cursor-pointer">Cancel</button><button type="submit" className="px-5 py-2 rounded-lg bg-amber-600 text-white font-bold cursor-pointer">Save Booking</button></div>
      </form>
    </ShopEntryModal>
  );
};
