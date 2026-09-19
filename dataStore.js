const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATABASE_PATH = path.join(DATA_DIR, 'database.json');
const TEMP_PREFIX = path.join(DATA_DIR, 'database.json.tmp');

// Build clean hourly availability slots (10:00–18:00) for the next `days` days,
// starting today. Used to seed a fresh database so a new deployment is usable
// immediately without manual setup.
function buildDefaultAvailability(days = 3) {
  const slots = [];
  const today = new Date();
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(today);
    day.setDate(today.getDate() + offset);
    const date = day.toISOString().slice(0, 10);
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
  return slots;
}

const defaultDatabase = () => ({
  availability: buildDefaultAvailability(),
  bookings: [],
  archivedBookings: [],
  settings: { slotDurationMinutes: 60 },
});

function validateDatabase(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid database structure');
  }
  for (const key of ['availability', 'bookings', 'archivedBookings']) {
    if (!Array.isArray(value[key])) throw new Error(`Invalid database field: ${key}`);
  }
  if (!value.settings || typeof value.settings !== 'object') {
    throw new Error('Invalid database field: settings');
  }
  const duration = Number(value.settings.slotDurationMinutes);
  if (!Number.isInteger(duration) || duration <= 0 || duration > 240) {
    throw new Error('Invalid slot duration setting');
  }
  return value;
}

async function ensureDatabase() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATABASE_PATH);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeDatabase(defaultDatabase());
  }
}

async function readDatabase() {
  await ensureDatabase();
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(DATABASE_PATH, 'utf8'));
  } catch (error) {
    const wrapped = new Error(error.code === 'ENOENT' ? 'Database file is missing' : 'Database file is invalid');
    wrapped.code = 'DATABASE_INVALID';
    throw wrapped;
  }
  try {
    return validateDatabase(parsed);
  } catch (error) {
    error.code = 'DATABASE_INVALID';
    throw error;
  }
}

async function writeDatabase(database) {
  validateDatabase(database);
  await fs.mkdir(DATA_DIR, { recursive: true });
  const temporaryPath = `${TEMP_PREFIX}-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, DATABASE_PATH);
}

let writeQueue = Promise.resolve();

function updateDatabase(mutator) {
  const operation = writeQueue.then(async () => {
    const database = await readDatabase();
    const result = await mutator(database);
    await writeDatabase(database);
    return result;
  });
  writeQueue = operation.catch(() => undefined);
  return operation;
}

module.exports = {
  DATABASE_PATH,
  defaultDatabase,
  validateDatabase,
  ensureDatabase,
  readDatabase,
  writeDatabase,
  updateDatabase,
};
