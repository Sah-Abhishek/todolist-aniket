import config from './config.js';

class SessionStore {
  constructor() {
    this.sessions = new Map();
  }

  _getOrCreate(jid) {
    if (!this.sessions.has(jid)) {
      this.sessions.set(jid, {
        history: [],
        lastAccess: Date.now(),
      });
    }
    const session = this.sessions.get(jid);
    session.lastAccess = Date.now();
    return session;
  }

  getHistory(jid) {
    this._evictIfStale(jid);
    const session = this._getOrCreate(jid);
    return session.history;
  }

  addMessage(jid, role, content) {
    this._evictIfStale(jid);
    const session = this._getOrCreate(jid);
    session.history.push({ role, content });

    // Trim oldest messages when exceeding max, keeping recent ones
    while (session.history.length > config.maxHistory) {
      session.history.shift();
    }
  }

  clearHistory(jid) {
    this.sessions.delete(jid);
    console.log(`[session] Cleared history for ${jid}`);
  }

  _evictIfStale(jid) {
    const session = this.sessions.get(jid);
    if (session && Date.now() - session.lastAccess > config.sessionTtlMs) {
      this.sessions.delete(jid);
      console.log(`[session] Evicted stale session for ${jid}`);
    }
  }
}

const sessionStore = new SessionStore();
export default sessionStore;
