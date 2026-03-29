import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import config from './config.js';
import { handleMessage } from './messageHandler.js';

const logger = pino({ level: config.logLevel });

const MAX_RETRIES = 5;
let retryCount = 0;

function getRetryDelay() {
  // Exponential backoff: 3s, 6s, 12s, 24s, 48s
  return Math.min(3000 * Math.pow(2, retryCount), 60000);
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    auth: state,
    logger,
    version: [2, 3000, 1034074495], // Override stale version — fixes 405 (see Baileys#2376)
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n[bot] Scan this QR code with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      // These codes mean "start fresh" — no point retrying
      const noRetryCodes = [
        DisconnectReason.loggedOut,            // 401
        DisconnectReason.multideviceMismatch,  // 411
      ];

      if (noRetryCodes.includes(statusCode)) {
        console.log(`[bot] Connection closed (status: ${statusCode}). Delete auth_info/ and restart to re-link.`);
        return;
      }

      // Recoverable errors
      retryCount++;
      if (retryCount > MAX_RETRIES) {
        console.log(`[bot] Connection failed (status: ${statusCode}). Gave up after ${MAX_RETRIES} retries.`);
        return;
      }

      const delay = getRetryDelay();
      console.log(`[bot] Connection closed (status: ${statusCode}). Retry ${retryCount}/${MAX_RETRIES} in ${delay / 1000}s...`);
      setTimeout(startBot, delay);
    }

    if (connection === 'open') {
      retryCount = 0; // Reset on successful connection
      console.log('[bot] Connected to WhatsApp!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Debug: log ALL message events
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    console.log(`[debug] messages.upsert — type: ${type}, count: ${messages.length}`);
    for (const msg of messages) {
      console.log(`[debug] msg from: ${msg.key.remoteJid}, fromMe: ${msg.key.fromMe}, type: ${Object.keys(msg.message || {}).join(',') || 'empty'}`);
      if (type !== 'notify') continue;
      await handleMessage(sock, msg);
    }
  });

  process.on('SIGINT', () => {
    console.log('\n[bot] Shutting down...');
    sock.end(undefined);
    process.exit(0);
  });
}

console.log('[bot] Starting WhatsApp bot...');
startBot().catch((err) => {
  console.error('[bot] Fatal error:', err);
  process.exit(1);
});
