import 'dotenv/config';

const config = {
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'deepseek-r1:7b',
    timeoutMs: 120_000,
  },
  systemPrompt:
    process.env.SYSTEM_PROMPT ||
    'You are a helpful WhatsApp assistant. Keep responses concise and conversational. Use short paragraphs. Avoid markdown formatting since WhatsApp has limited formatting support. Use WhatsApp formatting: *bold*, _italic_, ~strikethrough~, ```monospace``` when appropriate.',
  maxHistory: parseInt(process.env.MAX_HISTORY, 10) || 20,
  sessionTtlMs: parseInt(process.env.SESSION_TTL_MS, 10) || 3_600_000,
  allowGroups: process.env.ALLOW_GROUPS === 'true',
  logLevel: process.env.LOG_LEVEL || 'info',
};

export default config;
