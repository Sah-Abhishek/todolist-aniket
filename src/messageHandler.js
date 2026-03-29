import config from './config.js';
import sessionStore from './sessionStore.js';
import { chat } from './ollamaClient.js';

const COMMANDS = {
  '!ping': handlePing,
  '!reset': handleReset,
  '!help': handleHelp,
};

async function handlePing(sock, jid) {
  await sock.sendMessage(jid, { text: 'pong' });
}

async function handleReset(sock, jid) {
  sessionStore.clearHistory(jid);
  await sock.sendMessage(jid, { text: 'Conversation reset!' });
}

async function handleHelp(sock, jid) {
  const helpText = [
    '*Available Commands:*',
    '',
    '!ping — Health check (replies "pong")',
    '!reset — Clear your conversation history',
    '!help — Show this help message',
    '',
    'Send any other message to chat with the AI assistant.',
  ].join('\n');
  await sock.sendMessage(jid, { text: helpText });
}

function extractTextContent(message) {
  return (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    null
  );
}

export async function handleMessage(sock, message) {
  try {
    // Ignore own messages
    if (message.key.fromMe) return;

    const jid = message.key.remoteJid;
    if (!jid) return;

    // Skip status broadcasts
    if (jid === 'status@broadcast') return;

    // Skip group messages unless allowed
    if (jid.endsWith('@g.us') && !config.allowGroups) return;

    // Only process text messages
    const text = extractTextContent(message);
    if (!text) return;

    const preview = text.length > 50 ? text.slice(0, 50) + '...' : text;
    console.log(`[msg] From ${jid}: ${preview}`);

    // Check for special commands
    const trimmed = text.trim().toLowerCase();
    const commandHandler = COMMANDS[trimmed];
    if (commandHandler) {
      await commandHandler(sock, jid);
      return;
    }

    // Show typing indicator
    await sock.presenceSubscribe(jid);
    await sock.sendPresenceUpdate('composing', jid);

    // Build messages for LLM
    sessionStore.addMessage(jid, 'user', text);
    const history = sessionStore.getHistory(jid);

    const messages = [
      { role: 'system', content: config.systemPrompt },
      ...history,
    ];

    // Call LLM
    const reply = await chat(messages);

    // Store assistant response
    sessionStore.addMessage(jid, 'assistant', reply);

    // Clear typing indicator
    await sock.sendPresenceUpdate('paused', jid);

    // Send reply
    await sock.sendMessage(jid, { text: reply });
    console.log(`[msg] Replied to ${jid} (${reply.length} chars)`);
  } catch (err) {
    console.error(`[msg] Error handling message:`, err.message);

    try {
      const jid = message.key?.remoteJid;
      if (jid) {
        await sock.sendPresenceUpdate('paused', jid);
        await sock.sendMessage(jid, {
          text: "Sorry, I'm having trouble thinking right now. Try again in a moment.",
        });
      }
    } catch (sendErr) {
      console.error(`[msg] Failed to send error message:`, sendErr.message);
    }
  }
}
