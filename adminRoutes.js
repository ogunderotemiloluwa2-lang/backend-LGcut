const express = require('express');
const { requireAdmin } = require('./adminAuth');
const { readDatabase, updateDatabase } = require('./dataStore');
const {
  SLOT_STATUSES,
  BOOKING_STATUSES,
  createSlot,
  updateSlot,
  updateBooking,
  archiveBooking,
  deleteBooking,
  deleteArchivedBooking,
  cleanupBookings,
  bulkArchiveBookings,
  bulkDeleteBookings,
} = require('./jsonBookingService');

const router = express.Router();
router.use(requireAdmin);

function handleError(res, error) {
  const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'CONFLICT' ? 409 : error.code === 'VALIDATION_ERROR' ? 400 : 500;
  res.status(status).json({ success: false, message: status === 500 ? 'Admin operation failed' : error.message, errors: error.details || undefined });
}

router.get('/availability', async (req, res) => {
  try {
    const database = await readDatabase();
    let slots = database.availability;
    if (req.query.date) slots = slots.filter((slot) => slot.date === req.query.date);
    if (req.query.status) {
      if (!SLOT_STATUSES.has(req.query.status)) return res.status(400).json({ success: false, message: 'Invalid availability status' });
      slots = slots.filter((slot) => slot.status === req.query.status);
    }
    res.json({ success: true, data: slots });
  } catch (error) { handleError(res, error); }
});

router.post('/availability', async (req, res) => {
  try { res.status(201).json({ success: true, data: await createSlot(req.body) }); }
  catch (error) { handleError(res, error); }
});

router.patch('/availability/:slotId', async (req, res) => {
  try { res.json({ success: true, data: await updateSlot(req.params.slotId, req.body) }); }
  catch (error) { handleError(res, error); }
});

router.delete('/availability/:slotId', async (req, res) => {
  try {
    await updateDatabase((database) => {
      const slot = database.availability.find((item) => item.id === req.params.slotId);
      if (!slot) throw Object.assign(new Error('Availability slot not found'), { code: 'NOT_FOUND' });
      if (slot.status === 'booked') throw Object.assign(new Error('Booked slots cannot be deleted'), { code: 'CONFLICT' });
      database.availability = database.availability.filter((item) => item.id !== req.params.slotId);
    });
    res.json({ success: true, message: 'Availability slot deleted' });
  } catch (error) { handleError(res, error); }
});

router.get('/bookings', async (req, res) => {
  try {
    const database = await readDatabase();
    let bookings = database.bookings;
    if (req.query.status) {
      if (!BOOKING_STATUSES.has(req.query.status)) return res.status(400).json({ success: false, message: 'Invalid booking status' });
      bookings = bookings.filter((booking) => booking.status === req.query.status);
    }
    res.json({ success: true, data: bookings, archivedBookings: database.archivedBookings });
  } catch (error) { handleError(res, error); }
});

router.post('/bookings/cleanup', async (req, res) => {
  try { res.json({ success: true, data: await cleanupBookings(req.body.beforeDate, req.body.archive !== false) }); }
  catch (error) { handleError(res, error); }
});

router.post('/bookings/bulk-archive', async (req, res) => {
  try { res.json({ success: true, data: await bulkArchiveBookings(req.body.ids) }); }
  catch (error) { handleError(res, error); }
});

router.post('/bookings/bulk-delete', async (req, res) => {
  try { res.json({ success: true, data: await bulkDeleteBookings(req.body.ids) }); }
  catch (error) { handleError(res, error); }
});

router.patch('/bookings/:bookingId', async (req, res) => {
  try { res.json({ success: true, data: await updateBooking(req.params.bookingId, req.body) }); }
  catch (error) { handleError(res, error); }
});

router.post('/bookings/:bookingId/archive', async (req, res) => {
  try { res.json({ success: true, data: await archiveBooking(req.params.bookingId) }); }
  catch (error) { handleError(res, error); }
});

router.delete('/bookings/:bookingId', async (req, res) => {
  try { res.json({ success: true, data: await deleteBooking(req.params.bookingId) }); }
  catch (error) { handleError(res, error); }
});

router.post('/archived-bookings/:bookingId/delete', async (req, res) => {
  try { res.json({ success: true, data: await deleteArchivedBooking(req.params.bookingId) }); }
  catch (error) { handleError(res, error); }
});

module.exports = router;
