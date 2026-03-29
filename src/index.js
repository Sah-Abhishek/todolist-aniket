import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import config from './config.js';
import { handleMessage } from './messageHandler.js';

const logger = pino({ level: config.logLevel });

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: false, // We handle QR display ourselves
  });

  // Handle connection updates
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n[bot] Scan this QR code with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(
        `[bot] Connection closed (status: ${statusCode}). ${shouldReconnect ? 'Reconnecting...' : 'Logged out — delete auth_info/ and restart to re-link.'}`
      );

      if (shouldReconnect) {
        startBot();
      }
    }

    if (connection === 'open') {
      console.log('[bot] Connected to WhatsApp!');
    }
  });

  // Save auth credentials on update
  sock.ev.on('creds.update', saveCreds);

  // Handle incoming messages
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      await handleMessage(sock, msg);
    }
  });

  // Graceful shutdown
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
