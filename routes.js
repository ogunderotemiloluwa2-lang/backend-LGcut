// LG CUT Backend - API Routes
// All booking-related endpoints

const express = require('express');
const router = express.Router();

const { services, locations, serviceZones, addOns, bookings, findById, findOne } = require('./models');
const {
  createBooking: createBookingService,
  calculatePrice,
  calculateAvailability,
  validateServiceArea,
  getWorkingHoursForDate,
  isDateBlocked,
  getTodayDate,
} = require('./services');
const { getAvailableSlots, createBooking: createJsonBooking, isRealDate } = require('./jsonBookingService');
const { readDatabase } = require('./dataStore');
const { sendBookingNotifications } = require('./notifications');

// ===== HEALTH CHECK =====
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'LG CUT API is running',
  });
});

// ===== SERVICES =====
router.get('/services', (req, res) => {
  try {
    const activeServices = services.filter((s) => s.active).sort((a, b) => a.name.localeCompare(b.name));
    res.json({
      success: true,
      data: activeServices,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services',
    });
  }
});

// ===== LOCATIONS =====
router.get('/locations', (req, res) => {
  try {
    const activeLocations = locations.filter((l) => l.active).sort((a, b) => a.name.localeCompare(b.name));
    res.json({
      success: true,
      data: activeLocations,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch locations',
    });
  }
});

// ===== ADD-ONS =====
router.get('/add-ons', (req, res) => {
  try {
    const activeAddOns = addOns.filter((a) => a.active);
    res.json({
      success: true,
      data: activeAddOns,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch add-ons',
    });
  }
});

// ===== SERVICE ZONES =====
router.get('/service-zones', (req, res) => {
  try {
    const activeZones = serviceZones.filter((z) => z.active).sort((a, b) => a.name.localeCompare(b.name));
    res.json({
      success: true,
      data: activeZones,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service zones',
    });
  }
});

// ===== AVAILABILITY =====
// GET /api/availability?service=skin-fade&appointmentType=visit&date=2026-09-20&locationId=funaab
// GET /api/availability?service=skin-fade&appointmentType=home&date=2026-09-20&serviceZoneId=funaab-alabata
router.get('/availability', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      const database = await readDatabase();
      const dates = [...new Set(database.availability.filter((slot) => slot.status === 'available').map((slot) => slot.date))].sort();
      return res.json({ success: true, data: { dates } });
    }
    if (!isRealDate(date)) return res.status(400).json({ success: false, message: 'A valid date is required' });
    const slots = await getAvailableSlots(date);

    res.json({
      success: true,
      data: {
        date,
        available: slots.length > 0,
        slots,
        message: slots.length > 0 ? null : 'No available time slots for this date',
      },
    });
  } catch (err) {
    res.status(err.code === 'DATABASE_INVALID' ? 503 : 500).json({ success: false, message: err.code === 'DATABASE_INVALID' ? 'Availability data is unavailable' : 'Failed to calculate availability' });
  }
});

// ===== SERVICE AREA CHECK =====
// POST /api/service-area/check — check if an address is within service area
router.post('/service-area/check', (req, res) => {
  try {
    const { address } = req.body;

    if (!address || !address.city || !address.state) {
      return res.status(400).json({
        success: false,
        message: 'City and state are required',
      });
    }

    const result = validateServiceArea(address);

    if (!result.valid) {
      return res.json({
        success: false,
        message: result.message,
      });
    }

    res.json({
      success: true,
      data: {
        zone: result.zone,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to check service area',
    });
  }
});

// ===== GET BOOKING BY ID =====
router.get('/bookings/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const database = await readDatabase();
    const booking = database.bookings.find((b) => b.bookingId === bookingId) || database.archivedBookings.find((b) => b.bookingId === bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    res.json({
      success: true,
      data: booking,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking',
    });
  }
});

// ===== CREATE BOOKING =====
router.post('/bookings', async (req, res) => {
  try {
    const result = await createJsonBooking(req.body);

    // Resolve the human-readable location name for the notification.
    const locationName = result.booking.locationId
      ? findById(locations, result.booking.locationId)?.name
      : null;

    // Notify the company on BOTH email (Formspree) and Telegram at once.
    // Best-effort: a notification failure never blocks the booking.
    const notifications = await sendBookingNotifications(
      result.booking,
      result.priceInfo,
      locationName
    );

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: {
        bookingId: result.booking.bookingId,
        service: result.booking.service,
        appointmentType: result.booking.appointmentType,
        date: result.booking.date,
        time: result.booking.startTime,
        slotId: result.booking.slotId,
        duration: result.booking.duration,
        price: result.priceInfo.totalPrice,
        addOns: result.priceInfo.addOns || [],
        location: locationName || result.booking.locationId || null,
        notifications,
      },
    });
  } catch (err) {
    if (err.code === 'VALIDATION_ERROR') {
      return res.status(400).json({
        success: false,
        message: err.message,
        errors: err.details,
      });
    }

    if (err.code === 'CONFLICT') {
      return res.status(409).json({
        success: false,
        message: err.message,
      });
    }

    if (err.code === 'NOT_FOUND') return res.status(404).json({ success: false, message: err.message });

    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
    });
  }
});

module.exports = router;
