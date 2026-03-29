# WhatsApp Automation Bot

A WhatsApp bot that uses Ollama LLM for AI-powered conversations via the Baileys library.

## Prerequisites

- **Node.js** 18+ (for native fetch support)
- **Ollama** installed and running ([ollama.com](https://ollama.com))
- A WhatsApp account to link

## Setup

### 1. Install Ollama and pull a model

```bash
# Install Ollama (Linux)
curl -fsSL https://ollama.com/install.sh | sh

# Pull the default model
ollama pull deepseek-r1:7b

# Make sure Ollama is running
ollama serve
```

### 2. Install dependencies

```bash
cd backend
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env if you want to change defaults
```

### 4. Start the bot

```bash
npm start
```

### 5. Link WhatsApp

On first run, a QR code will appear in the terminal. Scan it with WhatsApp:

1. Open WhatsApp on your phone
2. Go to **Settings > Linked Devices > Link a Device**
3. Scan the QR code displayed in your terminal

The bot will save auth credentials in `auth_info/` so you won't need to scan again unless you log out.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `deepseek-r1:7b` | Model to use for chat |
| `SYSTEM_PROMPT` | *(see .env.example)* | System prompt for the LLM |
| `MAX_HISTORY` | `20` | Max messages to keep per conversation |
| `SESSION_TTL_MS` | `3600000` | Session timeout in ms (1 hour) |
| `ALLOW_GROUPS` | `false` | Whether to respond in group chats |
| `LOG_LEVEL` | `info` | Pino log level |

## Bot Commands

| Command | Description |
|---|---|
| `!ping` | Health check — replies "pong" |
| `!reset` | Clear your conversation history |
| `!help` | Show available commands |

Any other text message will be forwarded to the AI assistant.

## Project Structure

```
backend/
  src/
    index.js          — Baileys socket setup and connection handling
    messageHandler.js  — Message routing, commands, and LLM integration
    ollamaClient.js    — HTTP client for Ollama API
    sessionStore.js    — In-memory conversation history per user
    config.js          — Environment config with defaults
  auth_info/           — WhatsApp auth credentials (auto-generated, gitignored)
  .env                 — Environment overrides (gitignored)
```
