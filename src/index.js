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

      // 405 = WhatsApp rejected registration (rate-limited or temp block)
      if (statusCode === 405) {
        retryCount++;
        if (retryCount > MAX_RETRIES) {
          console.log(`[bot] WhatsApp keeps rejecting the connection (405). Gave up after ${MAX_RETRIES} retries.`);
          console.log('[bot] Wait 5-10 minutes, then: rm -rf auth_info/ && npm start');
          return;
        }
        const delay = getRetryDelay();
        console.log(`[bot] WhatsApp rejected connection (405) — rate-limited. Retry ${retryCount}/${MAX_RETRIES} in ${delay / 1000}s...`);
        setTimeout(startBot, delay);
        return;
      }

      // Other recoverable errors
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

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
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
