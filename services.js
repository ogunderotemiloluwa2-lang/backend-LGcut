// LG CUT Backend - Business Logic
// Pricing, availability, booking calculations, and validation helpers

const {
  services,
  locations,
  serviceZones,
  addOns,
  bookings,
  mockExistingBookings,
  blockedDates,
  blockedTimes,
  businessConfig,
  findById,
  findOne,
  find,
} = require('./models');

// ===== TIME UTILITIES =====

// All bookings that occupy the calendar: pre-existing mock appointments plus
// any bookings created through the app. Conflict checks must consider both.
const getAllBookings = () => [...mockExistingBookings, ...bookings];

// Validate a "HH:MM" 24-hour time string (00:00–23:59)
const isValidTimeFormat = (timeStr) => {
  if (typeof timeStr !== 'string') return false;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeStr.trim());
  return match !== null;
};

// Convert "HH:MM" to minutes since midnight
const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// Convert minutes since midnight to "HH:MM"
const minutesToTime = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Get day of week name (lowercase) from a date string "YYYY-MM-DD"
const getDayOfWeek = (dateStr) => {
  const d = new Date(dateStr);
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[d.getDay()];
};

// Get today's date as "YYYY-MM-DD"
const getTodayDate = () => {
  return new Date().toISOString().split('T')[0];
};

// Get current time as minutes since midnight (in the configured timezone)
const getCurrentTimeMinutes = () => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  return h * 60 + m;
};

// ===== BOOKING ID GENERATION =====
const generateBookingId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'LG-';
  for (let i = 0; i < 5; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

// ===== PRICE CALCULATION =====
// Never trust frontend price — always calculate from service + appointment type + fees
const calculatePrice = ({ serviceId, appointmentType, locationId, serviceZoneId, addOnIds }) => {
  const service = findById(services, serviceId);
  if (!service) {
    throw new Error('Service not found');
  }

  let basePrice;
  if (appointmentType === 'visit') {
    basePrice = service.visitPrice;
  } else if (appointmentType === 'home') {
    basePrice = service.homePrice;
  } else {
    throw new Error('Invalid appointment type');
  }

  let locationAdjustment = 0;
  let travelFee = 0;

  if (appointmentType === 'visit' && locationId) {
    const location = findById(locations, locationId);
    if (location) {
      locationAdjustment = location.priceAdjustment || 0;
    }
  }

  if (appointmentType === 'home' && serviceZoneId) {
    const zone = findById(serviceZones, serviceZoneId);
    if (zone) {
      travelFee = zone.travelFee;
    }
  }

  // Add-ons (e.g. dye / tint) — priced from the server catalogue, never the client.
  const selectedAddOns = (Array.isArray(addOnIds) ? addOnIds : [])
    .map((id) => findById(addOns, id))
    .filter((a) => a && a.active);
  const addOnsTotal = selectedAddOns.reduce((sum, a) => sum + a.price, 0);

  const totalPrice = basePrice + locationAdjustment + travelFee + addOnsTotal;

  return {
    basePrice,
    locationAdjustment,
    travelFee,
    addOnsTotal,
    addOns: selectedAddOns.map((a) => ({ id: a.id, name: a.name, price: a.price })),
    totalPrice,
  };
};

// ===== SERVICE AREA VALIDATION =====
// Home service covers the whole of Ogun State. The service zones are only used
// to estimate the travel fee/ETA — they do NOT restrict where we can go.
const normalizePlace = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+state$/, '');

// Determine if a customer's address is within a configured service area
const validateServiceArea = (address) => {
  if (!address || !address.city || !address.state) {
    return { valid: false, zone: null, message: 'City and state are required for home service' };
  }

  // Only Ogun State is served — anywhere in Ogun is fine.
  if (normalizePlace(address.state) !== 'ogun') {
    return { valid: false, zone: null, message: "Home service isn't available in this area." };
  }

  // Pick the closest matching zone for travel fee/ETA. If the city/area isn't
  // one we have a specific rate for, fall back to the first active zone so the
  // booking still goes through.
  const city = normalizePlace(address.city);
  const area = normalizePlace(address.area);
  const candidates = [city, area].filter(Boolean);

  const matched = find(serviceZones, (z) => {
    if (!z.active) return false;
    const zoneNames = [z.city, ...(z.aliases || [])].map(normalizePlace);
    return candidates.some((c) => zoneNames.includes(c));
  });

  const zone = matched[0] || serviceZones.find((z) => z.active) || null;
  if (!zone) {
    return { valid: false, zone: null, message: "Home service isn't available in this area." };
  }

  return { valid: true, zone, message: null };
};

// ===== WORKING HOURS HELPERS =====

// Get working hours for a given date
const getWorkingHoursForDate = (dateStr) => {
  const day = getDayOfWeek(dateStr);
  const hours = businessConfig.workingHours[day];
  if (!hours || hours.closed) {
    return null;
  }
  return {
    open: hours.open,
    close: hours.close,
    openMinutes: timeToMinutes(hours.open),
    closeMinutes: timeToMinutes(hours.close),
  };
};

// Check if a date is blocked (holiday, maintenance, etc.)
const isDateBlocked = (dateStr) => {
  return blockedDates.includes(dateStr);
};

// Check if a time range is blocked on a given date
const isTimeBlocked = (dateStr, startTime, endTime) => {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  return blockedTimes.some((bt) => {
    if (bt.date !== dateStr) return false;
    const btStart = timeToMinutes(bt.startTime);
    const btEnd = timeToMinutes(bt.endTime);
    // Check for overlap
    return startMin < btEnd && endMin > btStart;
  });
};

// ===== MINIMUM NOTICE CHECK =====
// Returns the earliest valid start time (in minutes) for a given date and appointment type
const getEarliestStartTime = (dateStr, appointmentType) => {
  const today = getTodayDate();
  const nowMinutes = getCurrentTimeMinutes();

  // If the date is today, apply minimum notice
  if (dateStr === today) {
    const minNoticeHours = businessConfig.minNotice[appointmentType] || 2;
    const minNoticeMinutes = minNoticeHours * 60;
    // Round up to the next 15-minute slot boundary so the offered slot is
    // always at least the full notice period away (avoids a race where a slot
    // shown as available is rejected moments later when the user submits).
    const slotInterval = 15;
    return Math.ceil((nowMinutes + minNoticeMinutes) / slotInterval) * slotInterval;
  }

  // For future dates, the earliest start is the opening time
  const wh = getWorkingHoursForDate(dateStr);
  if (!wh) return null;
  return wh.openMinutes;
};

// ===== AVAILABILITY CALCULATION =====
// Generate available time slots for a given date, service, and appointment type
const calculateAvailability = ({ serviceId, appointmentType, date, locationId, serviceZoneId }) => {
  const service = findById(services, serviceId);
  if (!service) {
    throw new Error('Service not found');
  }

  // Check if date is blocked
  if (isDateBlocked(date)) {
    return { available: false, slots: [], message: 'This date is not available' };
  }

  // Check working hours
  const wh = getWorkingHoursForDate(date);
  if (!wh) {
    return { available: false, slots: [], message: 'No working hours on this day' };
  }

  // Determine service duration
  const serviceDuration = service.duration;

  // For home service, add travel time
  let totalDuration = serviceDuration;
  let travelFee = 0;
  let travelTimeMinutes = 0;

  if (appointmentType === 'home') {
    if (!serviceZoneId) {
      return { available: false, slots: [], message: 'Service zone is required for home service' };
    }
    const zone = findById(serviceZones, serviceZoneId);
    if (!zone) {
      return { available: false, slots: [], message: 'Service zone not found' };
    }
    travelFee = zone.travelFee;
    travelTimeMinutes = zone.travelTimeMinutes || businessConfig.travelBuffer;
    totalDuration = serviceDuration + travelTimeMinutes;
  }

  // Calculate earliest start time (minimum notice + opening time)
  const earliestStart = getEarliestStartTime(date, appointmentType);
  if (earliestStart === null) {
    return { available: false, slots: [], message: 'No working hours on this day' };
  }

  // Latest valid start time = closing time - total duration - buffer
  const bufferMinutes = businessConfig.bufferTime;
  const latestStart = wh.closeMinutes - totalDuration - bufferMinutes;

  if (earliestStart > latestStart) {
    return { available: false, slots: [], message: 'No available time slots for this service on this date' };
  }

  // Generate 15-minute interval slots
  const slotInterval = 15;
  const slots = [];
  let currentStart = earliestStart;

  while (currentStart <= latestStart) {
    const currentEnd = currentStart + totalDuration;

    // Check if this slot is blocked
    const slotStartStr = minutesToTime(currentStart);
    const slotEndStr = minutesToTime(currentEnd);

    if (!isTimeBlocked(date, slotStartStr, slotEndStr)) {
      // Check for conflicts with existing bookings
      const hasConflict = getAllBookings().some((b) => {
        if (b.date !== date) return false;
        if (!['pending', 'confirmed'].includes(b.status)) return false;

        // Match on location or service zone
        if (appointmentType === 'visit' && locationId) {
          if (b.appointmentType !== 'visit' || b.locationId !== locationId) return false;
        }
        if (appointmentType === 'home' && serviceZoneId) {
          if (b.appointmentType !== 'home' || b.serviceZoneId !== serviceZoneId) return false;
        }

        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);

        // Check for overlap
        return currentStart < bEnd && currentEnd > bStart;
      });

      if (!hasConflict) {
        slots.push({
          startTime: slotStartStr,
          endTime: slotEndStr,
          duration: totalDuration,
        });
      }
    }

    currentStart += slotInterval;
  }

  return {
    available: true,
    slots,
    message: slots.length > 0 ? null : 'No available time slots for this date',
  };
};

// ===== BOOKING VALIDATION =====
const validateBooking = (bookingData) => {
  const errors = [];

  // Validate service exists and is active
  const service = findById(services, bookingData.serviceId);
  if (!service) {
    errors.push('Service not found');
  } else if (!service.active) {
    errors.push('Service is not available');
  }

  // Validate appointment type
  if (!['visit', 'home'].includes(bookingData.appointmentType)) {
    errors.push('Invalid appointment type');
  }

  // Validate location for visit
  if (bookingData.appointmentType === 'visit') {
    if (!bookingData.locationId) {
      errors.push('Location is required for visit appointments');
    } else {
      const location = findById(locations, bookingData.locationId);
      if (!location) {
        errors.push('Location not found');
      } else if (!location.active) {
        errors.push('Location is not available');
      }
    }
  }

  // Validate address for home service
  if (bookingData.appointmentType === 'home') {
    if (!bookingData.address || !bookingData.address.street || !bookingData.address.city || !bookingData.address.state) {
      errors.push('Full address is required for home service');
    }
    if (!bookingData.serviceZoneId) {
      errors.push('Service zone is required for home service');
    } else {
      const zone = findById(serviceZones, bookingData.serviceZoneId);
      if (!zone) {
        errors.push('Service zone not found');
      } else if (!zone.active) {
        errors.push('Service zone is not available');
      }
    }
  }

  // Validate date
  if (!bookingData.date) {
    errors.push('Date is required');
  }

  // Validate time
  if (!bookingData.startTime) {
    errors.push('Start time is required');
  }

  // Validate customer details
  if (!bookingData.customerName || !bookingData.customerName.trim()) {
    errors.push('Customer name is required');
  }
  if (!bookingData.phone || !bookingData.phone.trim()) {
    errors.push('Phone number is required');
  }
  if (!bookingData.email || !bookingData.email.trim()) {
    errors.push('Email is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
    service,
  };
};

// ===== COMPREHENSIVE BOOKING VALIDATION =====
// Full server-side validation including working hours, notice, conflicts, etc.
const validateBookingFull = (bookingData) => {
  const errors = [];

  // --- Basic field validation ---
  const service = findById(services, bookingData.serviceId);
  if (!service) {
    errors.push('Service not found');
  } else if (!service.active) {
    errors.push('Service is not available');
  }

  if (!['visit', 'home'].includes(bookingData.appointmentType)) {
    errors.push('Invalid appointment type');
  }

  if (bookingData.appointmentType === 'visit') {
    if (!bookingData.locationId) {
      errors.push('Location is required for visit appointments');
    } else {
      const location = findById(locations, bookingData.locationId);
      if (!location) {
        errors.push('Location not found');
      } else if (!location.active) {
        errors.push('Location is not available');
      }
    }
  }

  if (bookingData.appointmentType === 'home') {
    if (!bookingData.address || !bookingData.address.street || !bookingData.address.city || !bookingData.address.state) {
      errors.push('Full address is required for home service');
    }
    if (!bookingData.serviceZoneId) {
      errors.push('Service zone is required for home service');
    } else {
      const zone = findById(serviceZones, bookingData.serviceZoneId);
      if (!zone) {
        errors.push('Service zone not found');
      } else if (!zone.active) {
        errors.push('Service zone is not available');
      }
    }
  }

  if (!bookingData.customerName || !bookingData.customerName.trim()) {
    errors.push('Customer name is required');
  }
  if (!bookingData.phone || !bookingData.phone.trim()) {
    errors.push('Phone number is required');
  }
  if (!bookingData.email || !bookingData.email.trim()) {
    errors.push('Email is required');
  }

  // Validate add-ons (optional) — every supplied id must exist and be active.
  if (Array.isArray(bookingData.addOnIds)) {
    bookingData.addOnIds.forEach((id) => {
      const addOn = findById(addOns, id);
      if (!addOn || !addOn.active) {
        errors.push(`Add-on not available: ${id}`);
      }
    });
  }

  // If basic validation failed, return early
  if (errors.length > 0) {
    return { isValid: false, errors, service: service || null };
  }

  // --- Date validation ---
  if (!bookingData.date) {
    errors.push('Date is required');
  } else {
    const today = getTodayDate();
    if (bookingData.date < today) {
      errors.push('Cannot book an appointment in the past');
    }

    const maxWindow = businessConfig.maxBookingWindow;
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + maxWindow);
    const maxDateStr = maxDate.toISOString().split('T')[0];
    if (bookingData.date > maxDateStr) {
      errors.push(`Cannot book more than ${maxWindow} days in advance`);
    }

    if (isDateBlocked(bookingData.date)) {
      errors.push('This date is not available');
    }

    const wh = getWorkingHoursForDate(bookingData.date);
    if (!wh) {
      errors.push('No working hours on this day');
    }
  }

  // --- Time validation ---
  if (!bookingData.startTime) {
    errors.push('Start time is required');
  } else if (!isValidTimeFormat(bookingData.startTime)) {
    errors.push('Invalid start time format');
  } else {
    const startMin = timeToMinutes(bookingData.startTime);

    // Minimum notice check
    const earliestStart = getEarliestStartTime(bookingData.date, bookingData.appointmentType);
    if (earliestStart !== null && startMin < earliestStart) {
      const minNoticeHours = businessConfig.minNotice[bookingData.appointmentType];
      errors.push(`Minimum ${minNoticeHours} hours advance notice required for ${bookingData.appointmentType === 'visit' ? 'visit' : 'home service'} appointments`);
    }

    // Working hours check
    const wh = getWorkingHoursForDate(bookingData.date);
    if (wh) {
      if (startMin < wh.openMinutes) {
        errors.push(`Appointment must start at or after ${wh.open}`);
      }

      // Service duration + buffer must fit before closing
      let totalDuration = service.duration;
      if (bookingData.appointmentType === 'home') {
        const zone = findById(serviceZones, bookingData.serviceZoneId);
        if (zone) {
          totalDuration += zone.travelTimeMinutes || businessConfig.travelBuffer;
        }
      }
      const bufferMinutes = businessConfig.bufferTime;
      const endMin = startMin + totalDuration + bufferMinutes;
      if (endMin > wh.closeMinutes) {
        errors.push('Service duration does not fit within working hours');
      }
    }
  }

  // --- Conflict check ---
  if (bookingData.date && bookingData.startTime && bookingData.endTime) {
    const startMin = timeToMinutes(bookingData.startTime);
    const endMin = timeToMinutes(bookingData.endTime);

    const hasConflict = getAllBookings().some((b) => {
      if (b.date !== bookingData.date) return false;
      if (!['pending', 'confirmed'].includes(b.status)) return false;

      if (bookingData.appointmentType === 'visit' && bookingData.locationId) {
        if (b.appointmentType !== 'visit' || b.locationId !== bookingData.locationId) return false;
      }
      if (bookingData.appointmentType === 'home' && bookingData.serviceZoneId) {
        if (b.appointmentType !== 'home' || b.serviceZoneId !== bookingData.serviceZoneId) return false;
      }

      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);

      return startMin < bEnd && endMin > bStart;
    });

    if (hasConflict) {
      errors.push('Selected time slot conflicts with an existing booking');
    }

    // Check blocked times
    if (isTimeBlocked(bookingData.date, bookingData.startTime, bookingData.endTime)) {
      errors.push('Selected time slot is not available');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    service,
  };
};

// ===== AVAILABILITY CHECK =====
// Check if a time slot conflicts with existing bookings
const checkAvailability = ({ date, startTime, endTime, appointmentType, locationId, serviceZoneId }) => {
  const conflicts = getAllBookings().filter((booking) => {
    if (booking.date !== date) return false;
    if (!['pending', 'confirmed'].includes(booking.status)) return false;

    // Time overlap check
    const overlaps =
      (booking.startTime < endTime && booking.endTime > startTime) ||
      (booking.startTime <= startTime && booking.endTime >= endTime);

    if (!overlaps) return false;

    // Match on location or service zone depending on appointment type
    if (appointmentType === 'visit' && locationId) {
      return booking.locationId === locationId;
    }
    if (appointmentType === 'home' && serviceZoneId) {
      return booking.serviceZoneId === serviceZoneId;
    }
    return true;
  });

  return conflicts.length === 0;
};

// ===== BOOKING CREATION =====
const createBooking = (bookingData) => {
  // Recalculate duration and end time from server config — never trust the client.
  const service = findById(services, bookingData.serviceId);
  let travelTimeMinutes = 0;
  if (bookingData.appointmentType === 'home' && bookingData.serviceZoneId) {
    const zone = findById(serviceZones, bookingData.serviceZoneId);
    if (zone) travelTimeMinutes = zone.travelTimeMinutes || businessConfig.travelBuffer;
  }
  const duration = service ? service.duration + travelTimeMinutes : 0;
  const endTime = bookingData.startTime
    ? minutesToTime(timeToMinutes(bookingData.startTime) + duration)
    : null;

  // Override client-supplied duration/endTime with server-authoritative values
  // so validation and conflict checks use the real appointment range.
  const normalized = {
    ...bookingData,
    endTime,
    duration,
  };

  // Full server-side validation
  const { isValid, errors } = validateBookingFull(normalized);
  if (!isValid) {
    const err = new Error(errors.join(', '));
    err.code = 'VALIDATION_ERROR';
    err.details = errors;
    throw err;
  }

  // Calculate price (never trust frontend price)
  const priceInfo = calculatePrice({
    serviceId: normalized.serviceId,
    appointmentType: normalized.appointmentType,
    locationId: normalized.locationId,
    serviceZoneId: normalized.serviceZoneId,
    addOnIds: normalized.addOnIds,
  });

  // Check availability (final conflict check)
  const isAvailable = checkAvailability({
    date: normalized.date,
    startTime: normalized.startTime,
    endTime: normalized.endTime,
    appointmentType: normalized.appointmentType,
    locationId: normalized.locationId,
    serviceZoneId: normalized.serviceZoneId,
  });

  if (!isAvailable) {
    const err = new Error('Selected time slot is not available');
    err.code = 'CONFLICT';
    throw err;
  }

  // Generate booking ID
  const bookingId = generateBookingId();

  // Determine location name for response
  let locationName = null;
  if (normalized.appointmentType === 'visit' && normalized.locationId) {
    const loc = findById(locations, normalized.locationId);
    if (loc) locationName = loc.name;
  }

  // Create booking (server-authoritative fields override any client values)
  const booking = {
    ...normalized,
    bookingId,
    addOnIds: Array.isArray(normalized.addOnIds) ? normalized.addOnIds : [],
    addOns: priceInfo.addOns,
    price: priceInfo.totalPrice,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };

  bookings.push(booking);

  return {
    bookingId,
    booking,
    priceInfo,
    locationName,
  };
};

module.exports = {
  // Time utilities
  timeToMinutes,
  minutesToTime,
  getDayOfWeek,
  getTodayDate,
  getCurrentTimeMinutes,

  // Core functions
  generateBookingId,
  calculatePrice,
  validateServiceArea,
  getWorkingHoursForDate,
  isDateBlocked,
  isTimeBlocked,
  getEarliestStartTime,
  calculateAvailability,
  validateBooking,
  validateBookingFull,
  checkAvailability,
  createBooking,
};
