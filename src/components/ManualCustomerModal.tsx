import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Customer } from '../types';
import type { NewCustomerInput } from '../lib/manualEntry';
import { ShopEntryModal } from './ShopEntryModal';
import { entryInputClass } from './entryStyles';

export const ManualCustomerModal: React.FC<{ onClose: () => void; onCreated: (customer: Customer) => void }> = ({ onClose, onCreated }) => {
  const { createCustomer } = useApp();
  const [draft, setDraft] = useState<NewCustomerInput>({ name: '', contact: '', countryCode: '+60', email: '', petName: '', petBreed: '', vaxExpiryDate: '', notes: '' });
  const [error, setError] = useState('');
  const update = (field: keyof NewCustomerInput, value: string) => setDraft(prev => ({ ...prev, [field]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try { onCreated(await createCustomer(draft)); } catch (error) { setError(error instanceof Error ? error.message : 'Unable to add customer.'); }
  };
  return (
    <ShopEntryModal title="Add Customer" onClose={onClose}>
      <p className="text-sm text-slate-600 mb-4">Save a customer profile now. A booking is not required.</p>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-semibold">
          <label>Customer name *<input autoFocus required value={draft.name} onChange={e => update('name', e.target.value)} className={entryInputClass} /></label>
          <label>Country code<select value={draft.countryCode} onChange={e => update('countryCode', e.target.value)} className={entryInputClass}>{['+60', '+65', '+62', '+86', '+852', '+91', '+44', '+1', '+61'].map(code => <option key={code}>{code}</option>)}</select></label>
          <label>Phone / WhatsApp *<input type="tel" required value={draft.contact} placeholder="Local or full international number" onChange={e => update('contact', e.target.value)} className={entryInputClass} /></label>
          <label>Email<input type="email" value={draft.email} onChange={e => update('email', e.target.value)} className={entryInputClass} /></label>
          <label>Pet name (optional)<input value={draft.petName} onChange={e => update('petName', e.target.value)} className={entryInputClass} /></label>
          <label>Pet breed (optional)<input value={draft.petBreed} onChange={e => update('petBreed', e.target.value)} className={entryInputClass} /></label>
          <label>Vaccination expiry (optional)<input type="date" value={draft.vaxExpiryDate} onChange={e => update('vaxExpiryDate', e.target.value)} className={entryInputClass} /></label>
        </div>
        <label className="block text-sm font-semibold">Customer / pet notes<textarea value={draft.notes} onChange={e => update('notes', e.target.value)} className={entryInputClass} rows={3} /></label>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-600 cursor-pointer">Cancel</button><button type="submit" className="px-5 py-2 rounded-lg bg-amber-600 text-white font-bold cursor-pointer">Save Customer</button></div>
      </form>
    </ShopEntryModal>
  );
};
