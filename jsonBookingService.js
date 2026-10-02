const {
  services,
  locations,
  serviceZones,
  addOns,
  businessConfig,
  findById,
} = require('./models');
const { calculatePrice } = require('./services');
const { readDatabase, updateDatabase } = require('./dataStore');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const BOOKING_STATUSES = new Set(['pending', 'confirmed', 'completed', 'cancelled', 'no-show']);
const SLOT_STATUSES = new Set(['available', 'booked', 'unavailable', 'cancelled']);

function isRealDate(value) {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function validateSlotInput(input) {
  const errors = [];
  if (!isRealDate(input.date)) errors.push('A valid date is required');
  if (!TIME_RE.test(input.startTime || '')) errors.push('A valid start time is required');
  if (!TIME_RE.test(input.endTime || '')) errors.push('A valid end time is required');
  if (TIME_RE.test(input.startTime || '') && TIME_RE.test(input.endTime || '') && timeToMinutes(input.endTime) <= timeToMinutes(input.startTime)) {
    errors.push('End time must be after start time');
  }
  if (input.status && !SLOT_STATUSES.has(input.status)) errors.push('Invalid availability status');
  return errors;
}

// Accept both the canonical names (customerEmail/customerPhone) and the
// short aliases the frontend sends (email/phone).
function customerEmailOf(input) {
  return String(input.customerEmail || input.email || '').trim();
}

function customerPhoneOf(input) {
  return String(input.customerPhone || input.phone || '').trim();
}

function validateCustomerInput(input) {
  const errors = [];
  if (!input.customerName || !String(input.customerName).trim()) errors.push('Customer name is required');
  if (!/^\S+@\S+\.\S+$/.test(customerEmailOf(input))) errors.push('A valid email is required');
  if (!customerPhoneOf(input)) errors.push('Customer phone is required');
  if (!input.serviceId || !findById(services, input.serviceId)?.active) errors.push('A valid service is required');
  if (!['visit', 'home'].includes(input.appointmentType)) errors.push('Invalid appointment type');
  if (input.appointmentType === 'visit' && (!input.locationId || !findById(locations, input.locationId)?.active)) errors.push('A valid visit location is required');
  if (input.appointmentType === 'home' && (!input.serviceZoneId || !findById(serviceZones, input.serviceZoneId)?.active)) errors.push('A valid home service zone is required');
  if (Array.isArray(input.addOnIds)) {
    input.addOnIds.forEach((id) => {
      if (!findById(addOns, id)?.active) errors.push(`Add-on not available: ${id}`);
    });
  }
  return errors;
}

function validateSlotShape(slot) {
  return validateSlotInput(slot).length === 0 && SLOT_STATUSES.has(slot.status);
}

function publicSlot(slot) {
  return {
    id: slot.id,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    status: slot.status,
  };
}

// A slot is "past" once its start time has gone by. Past slots are locked:
// the admin can no longer open or close them. Compared in UTC to match the
// rest of the booking rules (getTodayDate uses UTC).
function isSlotPast(slot, now = new Date()) {
  const start = new Date(`${slot.date}T${slot.startTime}:00Z`);
  return !Number.isNaN(start.getTime()) && start.getTime() <= now.getTime();
}

// The ONLY way the admin changes availability: mark a time unavailable
// (closed) or available (open) again. There is no add or remove.
// Booked and past slots are locked.
async function setSlotStatus(slotId, status) {
  if (!['available', 'unavailable'].includes(status)) {
    throw Object.assign(new Error('Status must be available or unavailable'), { code: 'VALIDATION_ERROR' });
  }
  return updateDatabase((database) => {
    const slot = database.availability.find((item) => item.id === slotId);
    if (!slot) throw Object.assign(new Error('Availability slot not found'), { code: 'NOT_FOUND' });
    if (slot.status === 'booked') {
      throw Object.assign(new Error('This time is booked — cancel the appointment first'), { code: 'CONFLICT' });
    }
    if (isSlotPast(slot)) {
      throw Object.assign(new Error('This time has already passed'), { code: 'CONFLICT' });
    }
    slot.status = status;
    return slot;
  });
}

async function getAvailableSlots(date) {
  const database = await readDatabase();
  return database.availability.filter((slot) => slot.date === date && slot.status === 'available').map(publicSlot);
}

async function createSlot(input) {
  const errors = validateSlotInput(input);
  if (errors.length) throw Object.assign(new Error(errors.join(', ')), { code: 'VALIDATION_ERROR', details: errors });
  return updateDatabase((database) => {
    const duplicate = database.availability.some((slot) => slot.date === input.date && slot.startTime === input.startTime);
    if (duplicate) throw Object.assign(new Error('An availability slot already exists for this date and time'), { code: 'CONFLICT' });
    const slot = {
      id: input.id || `slot-${input.date}-${input.startTime.replace(':', '-')}`,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      status: input.status || 'available',
    };
    if (database.availability.some((item) => item.id === slot.id)) {
      throw Object.assign(new Error('Availability slot ID already exists'), { code: 'CONFLICT' });
    }
    database.availability.push(slot);
    return slot;
  });
}

async function updateSlot(slotId, changes) {
  return updateDatabase((database) => {
    const slot = database.availability.find((item) => item.id === slotId);
    if (!slot) throw Object.assign(new Error('Availability slot not found'), { code: 'NOT_FOUND' });
    if (changes.status && !SLOT_STATUSES.has(changes.status)) {
      throw Object.assign(new Error('Invalid availability status'), { code: 'VALIDATION_ERROR' });
    }
    if (slot.status === 'booked' && changes.status === 'available') {
      throw Object.assign(new Error('Cancel or update the booking before reopening this slot'), { code: 'CONFLICT' });
    }
    Object.assign(slot, changes);
    const errors = validateSlotInput(slot);
    if (errors.length) throw Object.assign(new Error(errors.join(', ')), { code: 'VALIDATION_ERROR', details: errors });
    return slot;
  });
}

async function createBooking(input) {
  const customerErrors = validateCustomerInput(input);
  if (customerErrors.length) throw Object.assign(new Error(customerErrors.join(', ')), { code: 'VALIDATION_ERROR', details: customerErrors });
  return updateDatabase((database) => {
    const slot = database.availability.find((item) => item.id === input.slotId);
    if (!slot) throw Object.assign(new Error('Selected availability slot was not found'), { code: 'NOT_FOUND' });
    if (slot.status !== 'available') throw Object.assign(new Error('Selected slot is no longer available'), { code: 'CONFLICT' });

    const service = findById(services, input.serviceId);
    const slotMinutes = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
    if (service.duration > slotMinutes) {
      throw Object.assign(new Error('This slot is too short for the selected service'), { code: 'VALIDATION_ERROR', details: ['This slot is too short for the selected service'] });
    }

    const priceInfo = calculatePrice({
      serviceId: input.serviceId,
      appointmentType: input.appointmentType,
      locationId: input.locationId,
      serviceZoneId: input.serviceZoneId,
      addOnIds: input.addOnIds,
    });
    const booking = {
      id: makeId('booking'),
      bookingId: makeId('LG'),
      slotId: slot.id,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      duration: slotMinutes,
      customerName: String(input.customerName).trim(),
      customerEmail: customerEmailOf(input),
      customerPhone: customerPhoneOf(input),
      serviceId: service.id,
      service: service.name,
      customStyleName: input.customStyleName || '',
      appointmentType: input.appointmentType,
      locationId: input.locationId || null,
      serviceZoneId: input.serviceZoneId || null,
      address: input.address || null,
      addOnIds: Array.isArray(input.addOnIds) ? input.addOnIds : [],
      addOns: priceInfo.addOns || [],
      notes: input.notes ? String(input.notes).trim() : '',
      price: priceInfo.totalPrice,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };
    slot.status = 'booked';
    database.bookings.push(booking);
    return { booking, priceInfo };
  });
}

async function updateBooking(bookingId, changes) {
  return updateDatabase((database) => {
    const booking = database.bookings.find((item) => item.id === bookingId || item.bookingId === bookingId);
    if (!booking) throw Object.assign(new Error('Booking not found'), { code: 'NOT_FOUND' });
    if (changes.status && !BOOKING_STATUSES.has(changes.status)) throw Object.assign(new Error('Invalid booking status'), { code: 'VALIDATION_ERROR' });
    const previousStatus = booking.status;
    Object.assign(booking, changes);
    const slot = database.availability.find((item) => item.id === booking.slotId);
    if (slot && changes.status === 'cancelled' && previousStatus === 'confirmed') slot.status = 'available';
    if (slot && changes.status === 'completed') slot.status = 'booked';
    return booking;
  });
}

async function archiveBooking(bookingId) {
  return updateDatabase((database) => {
    const index = database.bookings.findIndex((item) => item.id === bookingId || item.bookingId === bookingId);
    if (index === -1) throw Object.assign(new Error('Booking not found'), { code: 'NOT_FOUND' });
    const booking = database.bookings[index];
    if (!['cancelled', 'completed', 'no-show'].includes(booking.status)) {
      throw Object.assign(new Error('Only cancelled, completed, or no-show bookings can be archived'), { code: 'CONFLICT' });
    }
    database.bookings.splice(index, 1);
    database.archivedBookings.push({ ...booking, archivedAt: new Date().toISOString() });
    return booking;
  });
}

async function deleteBooking(bookingId) {
  return updateDatabase((database) => {
    const index = database.bookings.findIndex((item) => item.id === bookingId || item.bookingId === bookingId);
    if (index === -1) throw Object.assign(new Error('Booking not found'), { code: 'NOT_FOUND' });
    const booking = database.bookings[index];
    if (!['cancelled', 'completed', 'no-show'].includes(booking.status)) {
      throw Object.assign(new Error('Active or upcoming bookings must be cancelled before deletion'), { code: 'CONFLICT' });
    }
    database.bookings.splice(index, 1);
    return booking;
  });
}

async function deleteArchivedBooking(bookingId) {
  return updateDatabase((database) => {
    const index = database.archivedBookings.findIndex((item) => item.id === bookingId || item.bookingId === bookingId);
    if (index === -1) throw Object.assign(new Error('Archived booking not found'), { code: 'NOT_FOUND' });
    return database.archivedBookings.splice(index, 1)[0];
  });
}

async function bulkArchiveBookings(ids) {
  if (!Array.isArray(ids) || ids.length === 0) throw Object.assign(new Error('Select at least one booking'), { code: 'VALIDATION_ERROR' });
  return updateDatabase((database) => {
    const selected = database.bookings.filter((booking) => ids.includes(booking.id) || ids.includes(booking.bookingId));
    if (selected.some((booking) => !['cancelled', 'completed', 'no-show'].includes(booking.status))) {
      throw Object.assign(new Error('Only cancelled, completed, or no-show bookings can be archived'), { code: 'CONFLICT' });
    }
    database.bookings = database.bookings.filter((booking) => !selected.includes(booking));
    database.archivedBookings.push(...selected.map((booking) => ({ ...booking, archivedAt: new Date().toISOString() })));
    return { count: selected.length };
  });
}

async function bulkDeleteBookings(ids) {
  if (!Array.isArray(ids) || ids.length === 0) throw Object.assign(new Error('Select at least one booking'), { code: 'VALIDATION_ERROR' });
  return updateDatabase((database) => {
    const selected = database.bookings.filter((booking) => ids.includes(booking.id) || ids.includes(booking.bookingId));
    if (selected.some((booking) => !['cancelled', 'completed', 'no-show'].includes(booking.status))) {
      throw Object.assign(new Error('Active or upcoming bookings must be cancelled before deletion'), { code: 'CONFLICT' });
    }
    database.bookings = database.bookings.filter((booking) => !selected.includes(booking));
    return { count: selected.length };
  });
}

async function cleanupBookings(beforeDate, archive = true) {
  if (!isRealDate(beforeDate)) throw Object.assign(new Error('A valid before date is required'), { code: 'VALIDATION_ERROR' });
  return updateDatabase((database) => {
    const stale = database.bookings.filter((booking) => booking.date < beforeDate && ['cancelled', 'completed', 'no-show'].includes(booking.status));
    database.bookings = database.bookings.filter((booking) => !stale.includes(booking));
    if (archive) database.archivedBookings.push(...stale.map((booking) => ({ ...booking, archivedAt: new Date().toISOString() })));
    return { count: stale.length };
  });
}

module.exports = {
  BOOKING_STATUSES,
  SLOT_STATUSES,
  isRealDate,
  validateSlotInput,
  validateCustomerInput,
  validateSlotShape,
  isSlotPast,
  setSlotStatus,
  getAvailableSlots,
  createSlot,
  updateSlot,
  createBooking,
  updateBooking,
  archiveBooking,
  deleteBooking,
  deleteArchivedBooking,
  cleanupBookings,
  bulkArchiveBookings,
  bulkDeleteBookings,
  publicSlot,
};
