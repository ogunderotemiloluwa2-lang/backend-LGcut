// LG CUT — Telegram setup helper
//
// Telegram needs two values: a BOT TOKEN and a CHAT ID.
// This script finds the CHAT ID for you automatically.
//
// HOW TO USE
//   1. In Telegram, open a chat with @BotFather and send:  /newbot
//      Follow the prompts. BotFather gives you a token like:
//        123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
//   2. Put that token in backend/.env as TELEGRAM_BOT_TOKEN=...
//   3. Open a chat with YOUR new bot and send it any message (e.g. "hi").
//      (If you want alerts in a group, add the bot to the group and send a message there.)
//   4. Run:  node telegram-setup.js
//      It prints the CHAT ID. Copy it into backend/.env as TELEGRAM_CHAT_ID=...
//   5. Restart the backend. Done — bookings will now alert Telegram too.

const dotenv = require('dotenv');
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('\n✗ TELEGRAM_BOT_TOKEN is not set in backend/.env');
  console.error('  Create a bot with @BotFather, then add the token and run this again.\n');
  process.exit(1);
}

async function main() {
  const url = `https://api.telegram.org/bot${token}/getUpdates`;
  const response = await fetch(url);
  const body = await response.json().catch(() => null);

  if (!body?.ok) {
    console.error(`\n✗ Telegram rejected the token: ${body?.description || response.status}\n`);
    process.exit(1);
  }

  const updates = body.result || [];
  if (updates.length === 0) {
    console.error('\n✗ No messages found yet.');
    console.error('  Open a chat with your bot (or the group it is in) and send it a message,');
    console.error('  then run this script again.\n');
    process.exit(1);
  }

  // Collect every unique chat we can see.
  const chats = new Map();
  for (const update of updates) {
    const chat =
      update.message?.chat ||
      update.channel_post?.chat ||
      update.edited_message?.chat ||
      update.my_chat_member?.chat;
    if (chat) chats.set(chat.id, chat);
  }

  if (chats.size === 0) {
    console.error('\n✗ Could not find a chat in the recent updates. Send the bot a message and retry.\n');
    process.exit(1);
  }

  console.log('\n✓ Found chat(s):\n');
  for (const chat of chats.values()) {
    const name = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || 'Unknown';
    console.log(`   CHAT ID: ${chat.id}   (${chat.type}: ${name})`);
  }
  console.log('\nCopy the CHAT ID above into backend/.env as:');
  console.log('   TELEGRAM_CHAT_ID=<the number>\n');
  console.log('Then restart the backend.\n');
}

main().catch((error) => {
  console.error(`\n✗ Setup failed: ${error.message}\n`);
  process.exit(1);
});
