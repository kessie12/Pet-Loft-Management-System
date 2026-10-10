import type { Customer, CustomerBookingInput } from '../types';

export const normalizeCustomerContact = (contact: string, countryCode = '+60'): string => {
  const value = contact.trim();
  if (!value || !/^[+\d\s()-]+$/.test(value)) throw new Error('Enter a valid customer phone number.');
  const country = countryCode.replace(/\D/g, '');
  let digits = value.replace(/\D/g, '');
  if (value.startsWith('+')) {
    // An international number already includes its country code.
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = country + digits.replace(/^0+/, '');
  } else if (!digits.startsWith(country)) {
    digits = country + digits;
  }
  if (digits.length < 8 || digits.length > 15) throw new Error('Enter a phone number with 8–15 digits including the country code.');
  return `+${digits}`;
};

export type NewCustomerInput = Pick<Customer, 'name' | 'contact'> & Partial<Pick<Customer,
  'countryCode' | 'email' | 'igHandle' | 'xhsHandle' | 'petName' | 'petBreed' | 'vaxExpiryDate' | 'notes'>>;

export const buildCustomerRecord = (input: NewCustomerInput, customers: Customer[], id: string, modifier: string): Customer => {
  const name = input.name.trim();
  if (!name) throw new Error('Enter the customer name.');
  const contact = normalizeCustomerContact(input.contact, input.countryCode);
  if (customers.some(c => c.contact.replace(/\D/g, '') === contact.replace(/\D/g, ''))) {
    throw new Error('A customer with this phone number already exists. Open their profile to edit it.');
  }
  const now = new Date();
  return { ...input, name, contact, countryCode: input.countryCode || '+60', id, storeCredit: 0,
    createdAt: now.toISOString().slice(0, 10), lastModifiedBy: modifier, lastModifiedAt: now.toISOString() };
};

export const validateManualBooking = (data: CustomerBookingInput, depositRequired?: number) => {
  if (!data.customerName.trim()) throw new Error('Enter the customer name.');
  normalizeCustomerContact(data.customerContact, data.countryCode);
  const date = Date.parse(data.checkInDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.checkInDate) || !Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== data.checkInDate) {
    throw new Error('Select a valid service date.');
  }
  if (!data.checkInTime?.trim()) throw new Error('Enter the arrival or appointment time.');
  if (!data.pets.length || data.numberOfPets !== data.pets.length) throw new Error('Add at least one pet and check the pet count.');
  if (!['Boarding', 'Grooming', 'Pet Sitting', 'Day Care', 'Pet Taxi'].includes(data.primaryService)) throw new Error('Select a valid service.');
  if (data.pets.some(p => !['Dog', 'Cat', 'Rabbit', 'Hamster', 'Bird'].includes(p.species) || !['< 5kg', '6 - 12 kg', '13 - 20 kg', '21 - 30 kg', '> 30 kg'].includes(p.weightBracket))) {
    throw new Error('Select a valid species and weight for every pet.');
  }
  if (data.primaryService === 'Boarding' && !data.checkOutDate) throw new Error('Select a boarding check-out date.');
  if (data.primaryService === 'Boarding' && data.pets.some(p => (p.species === 'Dog' || p.species === 'Cat') && !p.preferredRoomType)) {
    throw new Error('Select a room type for each dog or cat.');
  }
  if (data.primaryService === 'Boarding' && data.boardingBreakdown?.arrangement === 'shared' && data.pets.some(p => p.species !== data.pets[0].species || p.preferredRoomType !== data.pets[0].preferredRoomType)) {
    throw new Error('Pets sharing one room must have the same species and room type. Choose separate rooms instead.');
  }
  const total = data.totalAmountOverride;
  if (total === undefined || !Number.isFinite(total) || total < 0 || Math.abs(total * 100 - Math.round(total * 100)) > 0.00001) {
    throw new Error('Enter a valid quoted total with no more than two decimal places.');
  }
  if (depositRequired !== undefined && (!Number.isFinite(depositRequired) || depositRequired < 0 || depositRequired > total || Math.abs(depositRequired * 100 - Math.round(depositRequired * 100)) > 0.00001)) {
    throw new Error('Required deposit must be between zero and the quoted total, with no more than two decimal places.');
  }
};
