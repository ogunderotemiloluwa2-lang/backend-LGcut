// One-off helper: seed clean daily availability slots (10:00–18:00) and clear
// any test bookings. Safe to run repeatedly.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'data', 'database.json');
const dates = ['2026-09-18', '2026-09-19', '2026-09-20'];
const slots = [];
for (const date of dates) {
  for (let hour = 10; hour < 18; hour += 1) {
    const start = `${String(hour).padStart(2, '0')}:00`;
    const end = `${String(hour + 1).padStart(2, '0')}:00`;
    slots.push({
      id: `slot-${date}-${start.replace(':', '-')}`,
      date,
      startTime: start,
      endTime: end,
      status: 'available',
    });
  }
}

fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(
  file,
  JSON.stringify({ availability: slots, bookings: [], archivedBookings: [], settings: { slotDurationMinutes: 60 } }, null, 2)
);
console.log(`Seeded ${slots.length} availability slots across ${dates.length} days.`);
