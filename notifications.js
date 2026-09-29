// LG CUT — Booking notifications
// When a customer books, we notify the company on BOTH channels at once:
//   1. Email  -> Formspree (forwards to the company inbox)
//   2. Telegram -> Telegram Bot API (instant phone alert)
//
// Notifications are best-effort: if one channel fails, the booking still
// succeeds and the other channel is still attempted.

const FORMSPREE_ENDPOINT =
  process.env.FORMSPREE_ENDPOINT || 'https://formspree.io/f/xkjgyqnb';

// Read Telegram config lazily (at call time) so it always reflects the latest
// environment — this avoids the module-load-order trap where dotenv has not
// run yet when this file is first required.
function telegramConfig() {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  };
}

const REQUEST_TIMEOUT_MS = 10000;

function formatNaira(amount) {
  return `₦${Number(amount || 0).toLocaleString('en-NG')}`;
}

function appointmentTypeLabel(type) {
  return type === 'home' ? 'Home Service' : 'Visit LG CUT';
}

// Human-readable location line for the notification.
function locationLine(booking, locationName) {
  if (booking.appointmentType === 'home') {
    const a = booking.address || {};
    const parts = [a.street, a.area, a.city, a.state].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Home address on file';
  }
  return locationName || 'LG CUT barbershop';
}

// Build the plain-text summary used by both channels.
function buildSummary(booking, priceInfo, locationName) {
  const addOns = (booking.addOns || priceInfo?.addOns || [])
    .map((a) => a.name)
    .filter(Boolean)
    .join(', ');

  return {
    bookingId: booking.bookingId,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    customerEmail: booking.customerEmail,
    service: booking.customStyleName || booking.service,
    appointmentType: appointmentTypeLabel(booking.appointmentType),
    date: booking.date,
    time: `${booking.startTime} – ${booking.endTime}`,
    duration: `${booking.duration} min`,
    location: locationLine(booking, locationName),
    addOns: addOns || '—',
    price: formatNaira(booking.price ?? priceInfo?.totalPrice),
    notes: booking.notes || '—',
  };
}

// --- Email via Formspree ---
async function sendEmailNotification(summary) {
  const payload = {
    _subject: `New LG CUT Booking — ${summary.bookingId}`,
    'Booking Reference': summary.bookingId,
    'Customer Name': summary.customerName,
    'Customer Phone': summary.customerPhone,
    'Customer Email': summary.customerEmail,
    Service: summary.service,
    'Appointment Type': summary.appointmentType,
    Date: summary.date,
    Time: summary.time,
    Duration: summary.duration,
    Location: summary.location,
    'Add-ons': summary.addOns,
    'Final Price': summary.price,
    Notes: summary.notes,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      return { channel: 'email', success: false, message: `Formspree responded ${response.status}` };
    }
    return { channel: 'email', success: true };
  } catch (error) {
    return { channel: 'email', success: false, message: error.message };
  } finally {
    clearTimeout(timer);
  }
}

// --- Telegram via Bot API ---
async function sendTelegramNotification(summary) {
  const { token, chatId } = telegramConfig();
  if (!token || !chatId) {
    return { channel: 'telegram', success: false, skipped: true, message: 'Telegram is not configured' };
  }

  const text = [
    '🔔 <b>New Booking — LG CUT</b>',
    '',
    `👤 <b>${summary.customerName}</b>`,
    `📞 ${summary.customerPhone}`,
    `📧 ${summary.customerEmail}`,
    '',
    `✂️ ${summary.service}`,
    `📅 ${summary.date}`,
    `🕐 ${summary.time} (${summary.duration})`,
    `📍 ${summary.appointmentType} — ${summary.location}`,
    `➕ Add-ons: ${summary.addOns}`,
    `💰 ${summary.price}`,
    '',
    `🧾 Ref: <code>${summary.bookingId}</code>`,
  ].join('\n');

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) {
      return { channel: 'telegram', success: false, message: body?.description || `Telegram responded ${response.status}` };
    }
    return { channel: 'telegram', success: true };
  } catch (error) {
    return { channel: 'telegram', success: false, message: error.message };
  } finally {
    clearTimeout(timer);
  }
}

// Fire both channels at once. Never throws — always resolves with a report.
async function sendBookingNotifications(booking, priceInfo, locationName) {
  const summary = buildSummary(booking, priceInfo, locationName);
  const results = await Promise.allSettled([
    sendEmailNotification(summary),
    sendTelegramNotification(summary),
  ]);

  const report = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { channel: 'unknown', success: false, message: String(r.reason) }
  );

  report.forEach((r) => {
    if (r.success) {
      console.log(`   ✓ ${r.channel} notification sent for ${summary.bookingId}`);
    } else if (r.skipped) {
      console.log(`   • ${r.channel} notification skipped (${r.message})`);
    } else {
      console.warn(`   ✗ ${r.channel} notification failed: ${r.message}`);
    }
  });

  return report;
}

module.exports = { sendBookingNotifications, buildSummary };
