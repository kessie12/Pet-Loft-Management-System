import type { Booking, CustomerBoardingRoom, Room, SystemConfig, UserRole } from '../types';

export const MAX_RECEIPT_BYTES = 1_000_000;
const receiptTypes = new Set(['image/png', 'image/jpeg', 'application/pdf']);
export const validateReceiptFile = (file: { size: number; type: string }) => {
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_RECEIPT_BYTES) {
    throw new Error('Receipt must be no larger than 1 MB (1,000,000 bytes) and cannot be empty.');
  }
  if (!receiptTypes.has(file.type)) throw new Error('Choose a PNG, JPG or PDF receipt.');
};
export const validateReceiptDataUrl = (value?: string) => {
  if (!value) return;
  const match = /^data:(image\/png|image\/jpeg|application\/pdf);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  if (!match || match[2].length > Math.ceil(MAX_RECEIPT_BYTES / 3) * 4) throw new Error('Choose a valid PNG, JPG or PDF receipt no larger than 1 MB.');
  let bytes: string;
  try { bytes = atob(match[2]); } catch { throw new Error('The receipt file could not be read.'); }
  validateReceiptFile({ size: bytes.length, type: match[1] });
};

export const canManageCredit = (role: UserRole, bossLoggedIn: boolean, staffLoggedIn: boolean, staffAllowed: boolean) =>
  (role === 'boss' && bossLoggedIn) || (role === 'staff' && staffLoggedIn && staffAllowed);

// Room types are the source of pricing and capacity; physical room IDs stay stable.
export const resolveRoomInventory = (inventory: Room[], types: CustomerBoardingRoom[]): Room[] => inventory.map(room => {
  const type = types.find(option => option.id === room.category && option.species === room.species);
  if (!type) return { ...room, active: false };
  return { ...room, categoryTitle: type.title, basePrice: type.price, maxCapacity: type.capacity,
    description: type.desc, active: type.active !== false && room.enabled !== false };
});

export const validateGroomingCapacity = (candidate: Booking, existing: Booking[], config: SystemConfig['groomingCapacity']) => {
  if (candidate.primaryService !== 'Grooming' || candidate.status === 'Cancelled') return;
  const date = Date.parse(candidate.checkInDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate.checkInDate) || !Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== candidate.checkInDate) {
    throw new Error('Select a valid grooming date.');
  }
  const day = new Date(`${candidate.checkInDate}T12:00:00Z`).getUTCDay();
  if (!config.activeDays.includes(day)) throw new Error('Grooming is closed on this date. Choose an active grooming day.');
  const dogs = candidate.pets.filter(pet => pet.species === 'Dog').length;
  const occupied = existing.filter(booking => booking.id !== candidate.id && booking.primaryService === 'Grooming' &&
    booking.checkInDate === candidate.checkInDate && booking.status !== 'Cancelled')
    .reduce((count, booking) => count + booking.pets.filter(pet => pet.species === 'Dog').length, 0);
  if (dogs > 0 && (!Number.isInteger(config.maxDogsPerDay) || config.maxDogsPerDay < 1 || occupied + dogs > config.maxDogsPerDay)) {
    throw new Error('Dog grooming is at capacity on this date. Choose another date.');
  }
};
