import type { Booking, BookingPet, Room, RoomAssignmentRule } from '../types';

export const normalizePendingDeposit = (booking: Booking): Booking => {
  if (booking.paymentStatus !== 'Deposit Verification Pending') return booking;
  return { ...booking, depositPaid: 0, totalPaid: booking.finalPaid,
    balanceDue: Math.max(0, booking.totalAmount - booking.finalPaid),
    depositDate: undefined, depositReceiptNo: undefined };
};

const validateAmount = (amount: number, maximum: number) => {
  if (!Number.isFinite(amount) || amount <= 0 || amount > maximum) {
    throw new Error(`Enter an amount greater than zero and no more than RM ${maximum.toFixed(2)}.`);
  }
};

export const reviewDeposit = (booking: Booking, approved: boolean, amount: number,
  receiptNo: string, date: string, reviewer: string): Booking => {
  if (booking.status === 'Cancelled' || booking.status === 'Completed') {
    throw new Error('This booking is closed.');
  }
  if (booking.depositPaid > 0 && booking.paymentStatus !== 'Deposit Verification Pending') {
    throw new Error('This deposit has already been verified.');
  }
  const current = normalizePendingDeposit(booking);
  if (approved) validateAmount(amount, current.totalAmount - current.finalPaid);
  const depositPaid = approved ? amount : 0;
  const totalPaid = depositPaid + current.finalPaid;
  return { ...current, depositPaid, totalPaid,
    balanceDue: Math.max(0, current.totalAmount - totalPaid),
    paymentStatus: totalPaid >= current.totalAmount ? 'Paid' : depositPaid > 0 ? 'Deposit Paid' : 'Outstanding',
    status: current.status === 'Deposit Verification Pending' ? 'Booked' : current.status,
    depositDate: approved ? date : undefined,
    depositReceiptNo: approved ? receiptNo : undefined,
    depositMethod: approved ? (current.depositMethod || 'Bank Transfer / DuitNow QR') : undefined,
    depositReceiptUrl: approved ? current.depositReceiptUrl : undefined,
    lastModifiedBy: reviewer, lastModifiedAt: new Date().toISOString(),
    notes: approved ? current.notes : `${current.notes ? current.notes + ' | ' : ''}Deposit proof rejected; contact the shop to resubmit.`,
  };
};

export const recordSettlement = (booking: Booking, method: string, amount: number,
  receiptNo: string, date: string): Booking => {
  if (booking.paymentStatus === 'Deposit Verification Pending') {
    throw new Error('Approve or reject the pending deposit before settling this booking.');
  }
  if (booking.status === 'Cancelled' || booking.status === 'Completed') throw new Error('This booking is closed.');
  validateAmount(amount, booking.balanceDue);
  const finalPaid = booking.finalPaid + amount;
  const totalPaid = booking.depositPaid + finalPaid;
  const balanceDue = Math.max(0, Math.round((booking.totalAmount - totalPaid) * 100) / 100);
  return { ...booking, finalPaid, totalPaid, balanceDue, finalMethod: method, finalDate: date,
    finalReceiptNo: receiptNo, paymentStatus: balanceDue === 0 ? 'Paid' : booking.depositPaid > 0 ? 'Deposit Paid' : 'Outstanding',
    status: balanceDue === 0 ? 'Completed' : booking.status,
    operationalAlert: balanceDue === 0 ? 'Completed' : booking.operationalAlert };
};

// Boarding uses [check-in, check-out): the room can be reused on checkout day.
export const boardingInterval = (booking: Pick<Booking, 'checkInDate' | 'checkOutDate'>): [number, number] => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.checkInDate) || (booking.checkOutDate && !/^\d{4}-\d{2}-\d{2}$/.test(booking.checkOutDate))) {
    throw new Error('Use valid boarding dates in YYYY-MM-DD format.');
  }
  const start = Date.parse(booking.checkInDate);
  const end = booking.checkOutDate ? Date.parse(booking.checkOutDate) : Infinity;
  if (!Number.isFinite(start) || Number.isNaN(end) || end <= start ||
      new Date(start).toISOString().slice(0, 10) !== booking.checkInDate ||
      (Number.isFinite(end) && new Date(end).toISOString().slice(0, 10) !== booking.checkOutDate)) {
    throw new Error('Select a valid check-out date after the check-in date.');
  }
  return [start, end];
};

export const staysOverlap = (first: Pick<Booking, 'checkInDate' | 'checkOutDate'>,
  second: Pick<Booking, 'checkInDate' | 'checkOutDate'>): boolean => {
  try {
    const [a, b] = boardingInterval(first);
    const [c, d] = boardingInterval(second);
    return a < d && c < b;
  } catch {
    // An imported stay with invalid dates needs staff review before its room is reused.
    return true;
  }
};

const reservesRoom = (b: Booking) => b.primaryService === 'Boarding' && b.status !== 'Cancelled' && b.status !== 'Completed';
const ruleFor = (pet: BookingPet, rules: RoomAssignmentRule[]) => rules.find(r => r.species === pet.species && r.weightBracket === pet.weightBracket);
const roomLimit = (room: Room, pets: BookingPet[], rules: RoomAssignmentRule[]) =>
  Math.min(room.maxCapacity, ...pets.map(p => ruleFor(p, rules)?.maxPetsPerRoom ?? room.maxCapacity));

export const validateRoomAssignments = (booking: Booking, existing: Booking[], rooms: Room[], rules: RoomAssignmentRule[]) => {
  if (!reservesRoom(booking)) return;
  boardingInterval(booking);
  for (const roomNumber of new Set(booking.pets.map(p => p.assignedRoom).filter(Boolean))) {
    const room = rooms.find(r => r.roomNumber === roomNumber);
    const pets = booking.pets.filter(p => p.assignedRoom === roomNumber);
    if (!room || room.status === 'cleaning' || room.active === false || pets.some(p => p.species !== room.species)) {
      throw new Error(`Room ${roomNumber} is unavailable or unsuitable for this species.`);
    }
    if (booking.boardingBreakdown?.arrangement === 'separate' && pets.length > 1) {
      throw new Error('Separate-room bookings require a different room for every pet.');
    }
    if (pets.length > roomLimit(room, pets, rules)) throw new Error(`Room ${roomNumber} exceeds its capacity or weight rule.`);
    if (existing.some(b => b.id !== booking.id && reservesRoom(b) && staysOverlap(booking, b) && b.pets.some(p => p.assignedRoom === roomNumber))) {
      throw new Error(`Room ${roomNumber} is already reserved during this stay.`);
    }
  }
};

export const allocateBoardingRooms = (booking: Booking, existing: Booking[], rooms: Room[], rules: RoomAssignmentRule[]): BookingPet[] => {
  boardingInterval(booking);
  const pets = booking.pets.map(p => ({ ...p, assignedRoom: undefined as string | undefined }));
  const groups: number[][] = [];
  const allocation = booking.boardingBreakdown?.allocatedRooms;
  const managed = pets.map((p, i) => p.species === 'Dog' || p.species === 'Cat' ? i : -1).filter(i => i >= 0);
  if (allocation?.length) {
    let offset = 0;
    for (const item of allocation) {
      if (!Number.isInteger(item.petsCount) || item.petsCount < 1) throw new Error('Invalid room allocation.');
      const group = managed.slice(offset, offset + item.petsCount);
      group.forEach(i => { pets[i].preferredRoomType = item.roomId; });
      groups.push(group);
      offset += item.petsCount;
    }
    if (offset !== managed.length) throw new Error('Allocate every pet to a room.');
  } else if (booking.boardingBreakdown?.arrangement === 'shared') {
    groups.push(managed);
  } else {
    // A single pet, separate rooms, or a legacy booking with no allocation information.
    groups.push(...managed.map(i => [i]));
  }
  const used = new Set<string>();
  for (const indices of groups) {
    if (!indices.length) continue;
    const group = indices.map(i => pets[i]);
    const first = group[0];
    const preferred = ruleFor(first, rules)?.preferredRooms || [];
    const candidates = rooms.filter(r => r.species === first.species && r.status !== 'cleaning' && r.active !== false &&
      (!first.preferredRoomType || r.category === first.preferredRoomType) && !used.has(r.roomNumber) &&
      group.every(p => p.species === r.species) && group.length <= roomLimit(r, group, rules));
    candidates.sort((a, b) => {
      const rank = (r: Room) => { const i = preferred.indexOf(r.roomNumber); return i < 0 ? Infinity : i; };
      return rank(a) - rank(b);
    });
    const room = candidates.find(r => !existing.some(b => reservesRoom(b) && b.id !== booking.id && staysOverlap(booking, b) && b.pets.some(p => p.assignedRoom === r.roomNumber)));
    if (!room) throw new Error(`No ${first.species} ${first.preferredRoomType || 'room'} is available for this stay and pet group. Contact the shop or choose different dates/rooms.`);
    used.add(room.roomNumber);
    indices.forEach(i => { pets[i].assignedRoom = room.roomNumber; });
  }
  return pets;
};
