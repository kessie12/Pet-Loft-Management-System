import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/lib/manualEntry.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { normalizeCustomerContact, buildCustomerRecord, validateManualBooking } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const customer = { name: ' Test Customer ', contact: '0123456789', countryCode: '+60', petName: 'Test Pet', notes: 'Independent profile' };
const booking = { customerName: 'Test Customer', customerContact: '+60123456789', primaryService: 'Boarding', checkInDate: '2026-10-20', checkOutDate: '2026-10-21', checkInTime: '10:00', numberOfPets: 1, pets: [{ species: 'Dog', weightBracket: '< 5kg', preferredRoomType: 'Superior Room' }], totalAmountOverride: 65 };
test('local and international contact formats match', () => {
  for (const phone of ['0123456789', '+60 12-345 6789', '60123456789', '0060123456789']) assert.equal(normalizeCustomerContact(phone), '+60123456789');
  assert.equal(normalizeCustomerContact('81234567', '+65'), '+6581234567');
  assert.throws(() => normalizeCustomerContact('letters')); assert.throws(() => normalizeCustomerContact('123'));
});
test('independent customer carries optional pet data and no booking or opening credit', () => {
  const inputCustomers = [];
  const record = buildCustomerRecord(customer, inputCustomers, 'customer-new', 'Staff');
  assert.equal(record.name, 'Test Customer'); assert.equal(record.petName, 'Test Pet');
  assert.equal(record.storeCredit, 0); assert.equal(record.lastModifiedBy, 'Staff');
  assert.equal(inputCustomers.length, 0); assert.equal('bookingReference' in record, false);
});
test('duplicate contacts are rejected regardless of formatting', () => {
  const previous = buildCustomerRecord(customer, [], 'original', 'Boss');
  assert.throws(() => buildCustomerRecord({ ...customer, contact: '+60 12-345 6789' }, [previous], 'duplicate', 'Staff'), /already exists/);
  assert.throws(() => buildCustomerRecord({ ...customer, name: ' ' }, [], 'empty', 'Staff'));
});
test('manual quotes and deposit bounds are checked before persistence', () => {
  assert.doesNotThrow(() => validateManualBooking(booking, 30));
  assert.doesNotThrow(() => validateManualBooking({ ...booking, totalAmountOverride: 0 }, 0));
  for (const total of [-1, NaN, Infinity, undefined, 10.123]) assert.throws(() => validateManualBooking({ ...booking, totalAmountOverride: total }, 0));
  for (const deposit of [-1, NaN, 66, 0.123]) assert.throws(() => validateManualBooking(booking, deposit));
});
test('manual booking requires service date, time, pets and boarding checkout', () => {
  for (const change of [{ checkInDate: '2026-02-30' }, { checkInTime: '' }, { pets: [] }, { numberOfPets: 2 }, { checkOutDate: '' }, { customerName: ' ' }]) {
    assert.throws(() => validateManualBooking({ ...booking, ...change }, 30));
  }
  assert.doesNotThrow(() => validateManualBooking({ ...booking, primaryService: 'Pet Sitting', checkOutDate: undefined }, 30));
});
test('shared housing rejects mixed species and purchased categories', () => {
  const shared = { ...booking, numberOfPets: 2, boardingBreakdown: { arrangement: 'shared' } };
  assert.throws(() => validateManualBooking({ ...shared, pets: [booking.pets[0], { ...booking.pets[0], species: 'Cat' }] }));
  assert.throws(() => validateManualBooking({ ...shared, pets: [booking.pets[0], { ...booking.pets[0], preferredRoomType: 'Suite' }] }));
  assert.doesNotThrow(() => validateManualBooking({ ...shared, pets: [booking.pets[0], booking.pets[0]] }));
});
