// LG CUT Backend - In-Memory Data Store
// Replaces Mongoose schemas with plain JavaScript data structures

// ===== SERVICES =====
const services = [
  {
    id: 'fade',
    name: 'Fade',
    description: 'A clean, blended fade — skin-close at the sides and back, tapering neatly into the top. Any height (low, mid, high, drop, bald) is the same price.',
    duration: 45,
    basePrice: 4000,
    visitPrice: 4000,
    homePrice: 4000,
    category: 'Hair',
    active: true,
  },
  {
    id: 'afro',
    name: 'Afro',
    description: 'Precision shaping and detailing for natural afro texture, keeping it defined, rounded and tidy.',
    duration: 35,
    basePrice: 4000,
    visitPrice: 4000,
    homePrice: 4000,
    category: 'Hair',
    active: true,
  },
  {
    id: 'low-cut',
    name: 'Low Cut',
    description: 'A neat, uniform low cut clipped close all over — clean, sharp and low-maintenance.',
    duration: 30,
    basePrice: 4000,
    visitPrice: 4000,
    homePrice: 4000,
    category: 'Hair',
    active: true,
  },
  {
    id: 'waves',
    name: 'Waves',
    description: 'Specialized cutting and brushing technique to enhance and maintain your 360 wave pattern.',
    duration: 50,
    basePrice: 4000,
    visitPrice: 4000,
    homePrice: 4000,
    category: 'Hair',
    active: true,
  },
  {
    id: 'cornrows',
    name: 'Cornrows',
    description: 'Neat rows braided close to the scalp in your chosen pattern. Price is the same however full the style.',
    duration: 60,
    basePrice: 4000,
    visitPrice: 4000,
    homePrice: 4000,
    category: 'Hair',
    active: true,
  },
  {
    id: 'sponge-twists',
    name: 'Sponge Twists',
    description: 'Defined coils created with a sponge for natural textured hair — soft, springy and full.',
    duration: 45,
    basePrice: 4000,
    visitPrice: 4000,
    homePrice: 4000,
    category: 'Hair',
    active: true,
  },
  {
    id: 'line-up',
    name: 'Line Up',
    description: 'Crisp edge-up along the hairline and temples to sharpen your look.',
    duration: 20,
    basePrice: 4000,
    visitPrice: 4000,
    homePrice: 4000,
    category: 'Hair',
    active: true,
  },
  {
    id: 'textured-crop',
    name: 'Textured Crop',
    description: 'A short, choppy top with a soft fade for a relaxed, modern finish.',
    duration: 40,
    basePrice: 4000,
    visitPrice: 4000,
    homePrice: 4000,
    category: 'Hair',
    active: true,
  },
  {
    id: 'natural-afro',
    name: 'Natural Afro Reference',
    description: 'A natural afro with dense, rounded curls and a clean shape.',
    duration: 35,
    basePrice: 4000,
    visitPrice: 4000,
    homePrice: 4000,
    category: 'Hair',
    active: true,
  },
  {
    id: '360-waves',
    name: '360 Waves Reference',
    description: 'Defined wave pattern brushed around the head with a clean finish.',
    duration: 50,
    basePrice: 4000,
    visitPrice: 4000,
    homePrice: 4000,
    category: 'Hair',
    active: true,
  },
  {
    id: 'low-cut-fade',
    name: 'Low Cut Fade',
    description: 'A clean low cut with a sharp fade and crisp line-up — neat, low-maintenance and always fresh.',
    duration: 35,
    basePrice: 4000,
    visitPrice: 4000,
    homePrice: 4000,
    category: 'Hair',
    active: true,
  },
  {
    id: 'leopard-dye',
    name: 'Leopard Print Dye',
    description: 'Bold leopard-spot pattern dyed into the hair — a statement colour job with pink and black detailing.',
    duration: 90,
    basePrice: 15000,
    visitPrice: 15000,
    homePrice: 15000,
    category: 'Hair',
    active: true,
  },
  {
    id: 'tinted-afro',
    name: 'Tinted Afro',
    description: 'A full afro coloured with a vibrant tint — rounded, defined and finished with a bold colour.',
    duration: 90,
    basePrice: 15000,
    visitPrice: 15000,
    homePrice: 15000,
    category: 'Hair',
    active: true,
  },
  {
    // Fallback for unique style names not in the gallery. The client types the
    // name and we book it at a standard cut price.
    id: 'custom',
    name: 'Custom Style',
    description: "A style you name yourself — tell us the look and we'll cut it. Priced as a standard cut.",
    duration: 45,
    basePrice: 4000,
    visitPrice: 4000,
    homePrice: 4000,
    category: 'Hair',
    active: true,
  },
];

// ===== LOCATIONS =====
const locations = [
  {
    id: 'funaab',
    name: 'LG CUT — FUNAAB',
    address: 'Shop 12, Alabata Commercial Complex, along Olabisi Onabanjo Way',
    area: 'Alabata',
    city: 'FUNAAB',
    state: 'Ogun State',
    phone: '+234 800 000 0000',
    email: 'funaab@lgcut.com',
    priceAdjustment: 0,
    active: true,
  },
  {
    id: 'abeokuta',
    name: 'LG CUT — Central Abeokuta',
    address: 'Suite B, Grandview Plaza, opposite GLO Office, Wetherell-David Road',
    area: 'Ibara',
    city: 'Abeokuta',
    state: 'Ogun State',
    phone: '+234 800 000 0001',
    email: 'abeokuta@lgcut.com',
    priceAdjustment: 0,
    active: true,
  },
];

// ===== SERVICE ZONES =====
const serviceZones = [
  {
    id: 'funaab-alabata',
    name: 'FUNAAB / Alabata',
    city: 'FUNAAB',
    state: 'Ogun State',
    aliases: ['funaab', 'alabata', 'federal university of agriculture', 'osiele'],
    maxDistance: 15,
    travelFee: 2000,
    travelTimeMinutes: 20,
    active: true,
  },
  {
    id: 'central-abeokuta',
    name: 'Central Abeokuta',
    city: 'Abeokuta',
    state: 'Ogun State',
    aliases: ['abeokuta', 'kuto', 'ibara', 'oke-ilewo', 'panseke', 'sapon'],
    maxDistance: 20,
    travelFee: 3000,
    travelTimeMinutes: 30,
    active: true,
  },
  {
    id: 'sagamu',
    name: 'Sagamu',
    city: 'Sagamu',
    state: 'Ogun State',
    aliases: ['sagamu', 'shagamu', 'ogijo'],
    maxDistance: 25,
    travelFee: 4000,
    travelTimeMinutes: 50,
    active: true,
  },
];

// ===== ADD-ONS =====
// Optional extras the customer can add to any service.
const addOns = [
  {
    id: 'dye-tint',
    name: 'Dye / Tint',
    description: 'Add colour or tint to your style.',
    price: 15000,
    active: true,
  },
];

// ===== BOOKING STATUSES =====
const bookingStatusEnum = ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'];

// ===== BOOKINGS (in-memory store) =====
const bookings = [];

// ===== MOCK EXISTING BOOKINGS =====
// These represent pre-existing appointments used for availability calculations.
// In production, these would come from an external calendar/scheduling system.
const mockExistingBookings = [
  // 2026-09-20 — busy afternoon at FUNAAB (visit)
  { date: '2026-09-20', startTime: '14:00', endTime: '14:45', locationId: 'funaab', appointmentType: 'visit', serviceId: 'fade', status: 'confirmed' },
  { date: '2026-09-20', startTime: '15:00', endTime: '15:45', locationId: 'funaab', appointmentType: 'visit', serviceId: 'low-cut', status: 'confirmed' },
  { date: '2026-09-20', startTime: '16:00', endTime: '16:45', locationId: 'funaab', appointmentType: 'visit', serviceId: 'fade', status: 'confirmed' },
  // 2026-09-21 — morning + home service
  { date: '2026-09-21', startTime: '10:00', endTime: '10:45', locationId: 'funaab', appointmentType: 'visit', serviceId: 'fade', status: 'confirmed' },
  { date: '2026-09-21', startTime: '11:00', endTime: '11:45', locationId: 'funaab', appointmentType: 'visit', serviceId: 'afro', status: 'confirmed' },
  { date: '2026-09-21', startTime: '14:00', endTime: '15:00', locationId: 'funaab', appointmentType: 'home', serviceId: 'cornrows', serviceZoneId: 'funaab-alabata', status: 'confirmed' },
  // 2026-09-22 — scattered
  { date: '2026-09-22', startTime: '10:00', endTime: '10:45', locationId: 'funaab', appointmentType: 'visit', serviceId: 'fade', status: 'confirmed' },
  { date: '2026-09-22', startTime: '13:00', endTime: '13:45', locationId: 'funaab', appointmentType: 'visit', serviceId: 'textured-crop', status: 'confirmed' },
  { date: '2026-09-22', startTime: '15:00', endTime: '15:45', locationId: 'funaab', appointmentType: 'visit', serviceId: 'sponge-twists', status: 'confirmed' },
  // 2026-09-27 — a couple of slots
  { date: '2026-09-27', startTime: '11:00', endTime: '11:45', locationId: 'funaab', appointmentType: 'visit', serviceId: 'waves', status: 'confirmed' },
  { date: '2026-09-27', startTime: '17:00', endTime: '17:45', locationId: 'funaab', appointmentType: 'visit', serviceId: 'line-up', status: 'confirmed' },
  // 2026-09-30 — home service with long duration
  { date: '2026-09-30', startTime: '10:00', endTime: '11:30', locationId: 'funaab', appointmentType: 'home', serviceId: 'cornrows', serviceZoneId: 'funaab-alabata', status: 'confirmed' },
];

// ===== BLOCKED DATES =====
// The barber works every day. A date is only unavailable if every slot on it
// is already booked — there are no closed days or holidays.
const blockedDates = [];

// ===== BLOCKED TIMES =====
// No fixed blocked times. A time is only unavailable when another customer has
// already booked that exact slot.
const blockedTimes = [];

// ===== BUSINESS CONFIG =====
const businessConfig = {
  name: 'LG CUT',
  tagline: 'Your cut. Your time.',
  phone: '+234 800 000 0000',
  email: 'hello@lgcut.com',
  timezone: 'Africa/Lagos',
  minNotice: {
    visit: 0,
    home: 0,
  },
  maxBookingWindow: 30,
  bufferTime: 15,
  travelBuffer: 30,
  // The barber works every day, 10:00 – 18:00. No closed days.
  workingHours: {
    monday: { open: '10:00', close: '18:00', closed: false },
    tuesday: { open: '10:00', close: '18:00', closed: false },
    wednesday: { open: '10:00', close: '18:00', closed: false },
    thursday: { open: '10:00', close: '18:00', closed: false },
    friday: { open: '10:00', close: '18:00', closed: false },
    saturday: { open: '10:00', close: '18:00', closed: false },
    sunday: { open: '10:00', close: '18:00', closed: false },
  },
};

// ===== DATA ACCESS HELPERS =====
// These mimic Mongoose model methods so services.js and routes.js
// can use a consistent interface

const findById = (collection, id) => collection.find((item) => item.id === id);

const findOne = (collection, predicate) => collection.find(predicate);

const find = (collection, predicate) => collection.filter(predicate);

module.exports = {
  services,
  locations,
  serviceZones,
  addOns,
  bookings,
  mockExistingBookings,
  blockedDates,
  blockedTimes,
  businessConfig,
  bookingStatusEnum,
  // Helper functions for querying in-memory data
  findById,
  findOne,
  find,
};
