/**
 * =======================================================================
 *  SEANSIY SUHBATLAR BOSHQARUVI (Conversation Session Manager & Exporter)
 * =======================================================================
 *  Foydalanuvchi bir nechta alohida suhbat sessiyalarini ochishi,
 *  tarixni saqlashi va Markdown / JSON formatida eksport qilishi mumkin.
 * =======================================================================
 */

const fs = require("fs");
const path = require("path");

class SessionManager {
  constructor(storagePath = null) {
    this.storagePath = storagePath || path.join(__dirname, "..", "data", "sessions.json");
    this.sessions = [];
    this.activeSessionId = null;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, "utf-8");
        const parsed = JSON.parse(raw);
        this.sessions = parsed.sessions || [];
        this.activeSessionId = parsed.activeSessionId || null;
      }
    } catch (e) {
      console.warn("⚠️ Seanslar faylini yuklashda xatolik:", e.message);
    }

    if (this.sessions.length === 0) {
      this.createSession("Asosiy Muloqot");
    }
  }

  save() {
    try {
      const data = {
        activeSessionId: this.activeSessionId,
        sessions: this.sessions,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.warn("⚠️ Seanslarni saqlashda xatolik:", e.message);
    }
  }

  createSession(title = "Yangi Suhbat") {
    const id = "sess_" + Date.now().toString(36);
    const session = {
      id,
      title: title.trim(),
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.sessions.unshift(session);
    this.activeSessionId = id;
    this.save();
    return session;
  }

  getActiveSession() {
    let sess = this.sessions.find((s) => s.id === this.activeSessionId);
    if (!sess && this.sessions.length > 0) {
      sess = this.sessions[0];
      this.activeSessionId = sess.id;
    }
    return sess;
  }

  addMessage(sessionId, message) {
    let session = sessionId ? this.sessions.find((s) => s.id === sessionId) : null;
    if (!session && sessionId) {
      session = {
        id: sessionId,
        title: "Yangi Suhbat",
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.sessions.push(session);
    } else if (!session) {
      session = this.getActiveSession();
    }
    if (session) {
      session.messages.push({
        id: "msg_" + Date.now().toString(36),
        ...message,
        timestamp: new Date().toISOString(),
      });
      session.updatedAt = new Date().toISOString();

      // Agar birinchi xabar bo'lsa, mavzu nomini yangilash
      if (session.messages.length === 2 && session.title === "Yangi Suhbat" && message.sender === "user") {
        session.title = message.text.slice(0, 32) + (message.text.length > 32 ? "..." : "");
      }
      this.save();
    }
  }

  exportMarkdown(sessionId) {
    const session = this.sessions.find((s) => s.id === sessionId) || this.getActiveSession();
    if (!session) return "# Suhbat topilmadi\n";

    let md = `# ${session.title}\n*Sana: ${new Date(session.createdAt).toLocaleString("uz-UZ")}*\n\n---\n\n`;
    session.messages.forEach((msg) => {
      const role = msg.sender === "user" ? "👤 **Foydalanuvchi**" : "🤖 **Neural AI Agent**";
      md += `${role} (${new Date(msg.timestamp).toLocaleTimeString()}):\n${msg.text}\n\n`;
    });
    return md;
  }

  deleteSession(sessionId) {
    this.sessions = this.sessions.filter((s) => s.id !== sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = this.sessions.length > 0 ? this.sessions[0].id : null;
    }
    this.save();
  }
}

module.exports = SessionManager;
