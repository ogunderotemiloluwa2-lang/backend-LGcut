const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');

const databasePath = path.join(__dirname, 'data', 'database.json');
const { writeDatabase, readDatabase } = require('./dataStore');
const { createBooking, createSlot, validateSlotInput } = require('./jsonBookingService');

test.beforeEach(async () => {
  await writeDatabase({ availability: [], bookings: [], archivedBookings: [], settings: { slotDurationMinutes: 15 } });
});

test('validates slot date and time', () => {
  assert.ok(validateSlotInput({ date: '2026-02-30', startTime: '10:00', endTime: '10:30' }).length > 0);
  assert.ok(validateSlotInput({ date: '2026-09-20', startTime: '10:30', endTime: '10:00' }).length > 0);
});

test('books an available slot and marks it booked', async () => {
  const slot = await createSlot({ date: '2026-09-20', startTime: '10:00', endTime: '11:00' });
  const result = await createBooking({ slotId: slot.id, serviceId: 'taper-fade', appointmentType: 'visit', locationId: 'funaab', customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '08000000000' });
  assert.equal(result.booking.slotId, slot.id);
  assert.equal((await readDatabase()).availability[0].status, 'booked');
});

test('two booking attempts cannot claim one slot', async () => {
  const slot = await createSlot({ date: '2026-09-20', startTime: '10:00', endTime: '11:00' });
  const input = { slotId: slot.id, serviceId: 'taper-fade', appointmentType: 'visit', locationId: 'funaab', customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '08000000000' };
  await createBooking(input);
  await assert.rejects(() => createBooking({ ...input, customerEmail: 'second@example.com' }), { code: 'CONFLICT' });
});

test('rejects malformed database JSON safely', async () => {
  await fs.writeFile(databasePath, '{ malformed', 'utf8');
  await assert.rejects(() => readDatabase(), { code: 'DATABASE_INVALID' });
});

test.after(async () => {
  await fs.rm(databasePath, { force: true });
});
