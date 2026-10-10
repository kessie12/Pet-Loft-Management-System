import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
// Load the actual TypeScript implementation without adding another test dependency.
const source = fs.readFileSync(new URL('../src/lib/bookingLogic.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { normalizePendingDeposit, reviewDeposit, recordSettlement, allocateBoardingRooms, validateRoomAssignments, staysOverlap, boardingInterval } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const pet = { species: 'Dog', weightBracket: '< 5kg', preferredRoomType: 'Superior Room' };
const booking = (updates = {}) => ({ id: 'new', primaryService: 'Boarding', checkInDate: '2026-10-10', checkOutDate: '2026-10-13',
  pets: [{ ...pet }], status: 'Booked', operationalAlert: 'Ready for Pick-Up', totalAmount: 100, depositRequired: 30,
  depositPaid: 0, finalPaid: 0, totalPaid: 0, balanceDue: 100, paymentStatus: 'Outstanding', ...updates });
const room = (roomNumber, updates = {}) => ({ roomNumber, species: 'Dog', category: 'Superior Room', maxCapacity: 2, status: 'available', ...updates });
const inventory = [room('D-02'), room('D-05'), room('C-01', { species: 'Cat' }), room('D-04', { category: 'Suite' })];
const rules = [{ species: 'Dog', weightBracket: '< 5kg', preferredRooms: ['D-02', 'D-05'], maxPetsPerRoom: 2 }];
const pending = () => booking({ paymentStatus: 'Deposit Verification Pending', status: 'Deposit Verification Pending', depositPaid: 30, totalPaid: 30, balanceDue: 70, depositReceiptUrl: 'proof' });
test('legacy pending proof is excluded from payments', () => {
  const b = normalizePendingDeposit(pending());
  assert.equal(b.depositPaid, 0); assert.equal(b.totalPaid, 0); assert.equal(b.balanceDue, 100);
});
test('approval records actual amount and issues receipt', () => {
  const b = reviewDeposit(pending(), true, 25, 'R01', '2026-10-09', 'Boss');
  assert.equal(b.depositPaid, 25); assert.equal(b.balanceDue, 75); assert.equal(b.depositReceiptNo, 'R01');
  assert.equal(b.paymentStatus, 'Deposit Paid'); assert.equal(b.lastModifiedBy, 'Boss'); assert.equal(b.status, 'Booked');
});
test('shop can record a verified deposit without uploaded proof', () => {
  assert.equal(reviewDeposit(booking(), true, 100, 'R01', 'today', 'Boss').paymentStatus, 'Paid');
});
test('rejection preserves other payments and clears pending deposit', () => {
  const b = reviewDeposit({ ...pending(), finalPaid: 20 }, false, 0, '', 'today', 'Boss');
  assert.equal(b.totalPaid, 20); assert.equal(b.balanceDue, 80); assert.equal(b.depositPaid, 0);
  assert.equal(b.depositReceiptUrl, undefined); assert.equal(b.status, 'Booked');
});
test('invalid approval and duplicate approval are rejected', () => {
  for (const amount of [0, -1, NaN, Infinity, 101]) assert.throws(() => reviewDeposit(pending(), true, amount, 'R01', 'today', 'Boss'));
  assert.throws(() => reviewDeposit(booking({ depositPaid: 30, paymentStatus: 'Deposit Paid' }), true, 30, 'R01', 'today', 'Boss'));
});
test('pending deposits cannot be settled', () => {
  assert.throws(() => recordSettlement(pending(), 'Cash', 70, 'R02', 'today'), /pending deposit/);
});
test('partial settlement keeps care status; full settlement completes', () => {
  const partial = recordSettlement(booking(), 'Cash', 20, 'R02', 'today');
  assert.equal(partial.balanceDue, 80); assert.equal(partial.operationalAlert, 'Ready for Pick-Up');
  const full = recordSettlement(partial, 'Cash', 80, 'R02', 'today');
  assert.equal(full.status, 'Completed'); assert.equal(full.paymentStatus, 'Paid');
  for (const amount of [0, -1, NaN, 101]) assert.throws(() => recordSettlement(booking(), 'Cash', amount, 'R02', 'today'));
});
test('dates are valid, ordered, and checkout day may be reused', () => {
  assert.equal(staysOverlap(booking(), booking({ checkInDate: '2026-10-13', checkOutDate: '2026-10-14' })), false);
  assert.equal(staysOverlap(booking(), booking({ checkInDate: '2026-10-12', checkOutDate: '2026-10-14' })), true);
  for (const date of ['2026-10-10', '2026-10-09', '2026-02-30', 'invalid']) assert.throws(() => boardingInterval(booking({ checkOutDate: date })));
});
test('overlapping stays use another room of purchased category', () => {
  const occupied = booking({ id: 'old', pets: [{ ...pet, assignedRoom: 'D-02' }] });
  assert.equal(allocateBoardingRooms(booking(), [occupied], inventory, rules)[0].assignedRoom, 'D-05');
});
test('non-overlapping, cancelled and completed stays release a room', () => {
  for (const update of [{ checkOutDate: '2026-10-10', checkInDate: '2026-10-09' }, { status: 'Cancelled' }, { status: 'Completed' }]) {
    const old = booking({ id: 'old', pets: [{ ...pet, assignedRoom: 'D-02' }], ...update });
    assert.equal(allocateBoardingRooms(booking(), [old], inventory, rules)[0].assignedRoom, 'D-02');
  }
});
test('separate housing always reserves distinct rooms', () => {
  const pets = allocateBoardingRooms(booking({ pets: [pet, pet], boardingBreakdown: { arrangement: 'separate' } }), [], inventory, rules);
  assert.equal(new Set(pets.map(p => p.assignedRoom)).size, 2);
});
test('shared housing stays together, within physical and rule capacity', () => {
  const shared = booking({ pets: [pet, pet], boardingBreakdown: { arrangement: 'shared' } });
  const pets = allocateBoardingRooms(shared, [], inventory, rules);
  assert.equal(pets[0].assignedRoom, pets[1].assignedRoom);
  assert.throws(() => allocateBoardingRooms({ ...shared, pets: [pet, pet, pet] }, [], inventory, rules));
  assert.throws(() => allocateBoardingRooms(shared, [], inventory, [{ ...rules[0], maxPetsPerRoom: 1 }]));
});
test('two shared allocations reserve two distinct rooms', () => {
  const b = booking({ pets: [pet, pet, pet, pet], boardingBreakdown: { arrangement: 'shared', allocatedRooms: [{ roomId: 'Superior Room', petsCount: 2 }, { roomId: 'Superior Room', petsCount: 2 }] } });
  const pets = allocateBoardingRooms(b, [], inventory, rules);
  assert.equal(pets[0].assignedRoom, pets[1].assignedRoom); assert.equal(pets[2].assignedRoom, pets[3].assignedRoom);
  assert.notEqual(pets[0].assignedRoom, pets[2].assignedRoom);
});
test('full inventory does not silently downgrade or share another customer room', () => {
  const existing = ['D-02', 'D-05'].map((r, i) => booking({ id: `old-${i}`, pets: [{ ...pet, assignedRoom: r }] }));
  assert.throws(() => allocateBoardingRooms(booking(), existing, inventory, rules), /No Dog/);
});
test('manual reassignment rejects occupied, wrong species, cleaning, unknown and overcapacity rooms', () => {
  const existing = booking({ id: 'old', pets: [{ ...pet, assignedRoom: 'D-02' }] });
  for (const r of ['D-02', 'C-01', 'unknown']) assert.throws(() => validateRoomAssignments(booking({ pets: [{ ...pet, assignedRoom: r }] }), [existing], inventory, rules));
  assert.throws(() => validateRoomAssignments(booking({ pets: [{ ...pet, assignedRoom: 'D-05' }] }), [], [room('D-05', { status: 'cleaning' })], rules));
  assert.throws(() => validateRoomAssignments(booking({ pets: [pet, pet, pet].map(p => ({ ...p, assignedRoom: 'D-05' })) }), [], inventory, rules));
  assert.doesNotThrow(() => validateRoomAssignments(booking({ pets: [{ ...pet, assignedRoom: 'D-05' }] }), [existing], inventory, rules));
});
test('small pets use their own cage, without invented room numbers', () => {
  assert.equal(allocateBoardingRooms(booking({ pets: [{ species: 'Rabbit', weightBracket: '< 5kg' }] }), [], inventory, rules)[0].assignedRoom, undefined);
});
