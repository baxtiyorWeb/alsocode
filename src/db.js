/**
 * =======================================================================
 *  NEON SERVERLESS POSTGRESQL INTEGRATION (Clean Database Service)
 * =======================================================================
 *  Enterprise darajadagi ma'lumotlar bazasi xizmati:
 *  - Connection Pool boshqaruvi (Neon connection pooler bilan optimallashtirilgan);
 *  - Avtomatik schema yaratish (Auto-migration: knowledge, memory, models, history);
 *  - Graceful Fallback (baza vaqtincha javob bermasa lokal keshga o'tish);
 *  - Asinxron, xavfsiz va xotiradan yengil foydalanuvchi arxitektura.
 * =======================================================================
 */

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

class DatabaseService {
  constructor() {
    this.connectionString = process.env.DATABASE_URL;
    this.pool = null;
    this.isReady = false;

    if (this.connectionString) {
      let connStr = this.connectionString;
      if (connStr.includes("sslmode=require")) {
        connStr = connStr.replace("sslmode=require", "sslmode=verify-full");
      }
      this.pool = new Pool({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        max: 5,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 20000,
        allowExitOnIdle: false,
      });

      this.pool.on("error", (err) => {
        console.warn("⚠️ Neon PostgreSQL Pool xatosi (lokal rejim davom etadi):", err.message);
      });
    } else {
      console.warn("⚠️ DATABASE_URL topilmadi. Tizim lokal rejimda ishlaydi.");
    }
  }

  /**
   * Bazani initsializatsiya qilish va kerakli jadvallarni yaratish
   */
  async init() {
    if (!this.pool) return false;

    const createTablesQuery = `
      -- 1. O'qitish bilimlari bazasi
      CREATE TABLE IF NOT EXISTS ai_knowledge (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL UNIQUE,
        category VARCHAR(64) NOT NULL,
        tags TEXT[] DEFAULT ARRAY[]::TEXT[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- 2. Hebbian Assotsiativ Xotira (Fast-weights graph)
      CREATE TABLE IF NOT EXISTS ai_memory (
        id SERIAL PRIMARY KEY,
        subject VARCHAR(128) NOT NULL,
        relation VARCHAR(64) DEFAULT 'bu',
        object TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        recalled_count INT DEFAULT 0,
        last_recalled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT unique_fact UNIQUE(subject, relation, object)
      );

      -- 3. Muloqot tarixi va Anti-Repetition logi
      CREATE TABLE IF NOT EXISTS ai_dialogue_history (
        id SERIAL PRIMARY KEY,
        role VARCHAR(16) NOT NULL,
        text TEXT NOT NULL,
        intent VARCHAR(64),
        mood VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- 4. O'qitilgan Model Holatlari (Weights, Vocab, Embeddings)
      CREATE TABLE IF NOT EXISTS ai_model_state (
        model_name VARCHAR(64) PRIMARY KEY,
        weights JSONB NOT NULL,
        vocab JSONB NOT NULL,
        categories JSONB NOT NULL,
        meta JSONB DEFAULT '{}'::JSONB,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ai_knowledge_cat ON ai_knowledge(category);
      CREATE INDEX IF NOT EXISTS idx_ai_memory_subject ON ai_memory(subject);
      CREATE INDEX IF NOT EXISTS idx_dialogue_history_created ON ai_dialogue_history(created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_knowledge_text_lower ON ai_knowledge(LOWER(TRIM(text)));
    `;

    try {
      await this.pool.query(createTablesQuery);
      this.isReady = true;
      console.log("✅ Neon Serverless Postgres jadvallari muvaffaqiyatli tekshirildi/yaratildi!");
      return true;
    } catch (err) {
      console.error("🛑 Neon bazasini initsializatsiya qilishda xatolik:", err.message);
      this.isReady = false;
      return false;
    }
  }

  /**
   * SQL so'rovlarini xavfsiz bajarish (Safe Query Executor)
   */
  async query(text, params = []) {
    if (!this.pool) return null;
    return await this.pool.query(text, params);
  }

  /**
   * Bilimlar bazasini yuklash (Agar Neon bo'sh bo'lsa lokal JSON dan sinxronlashtirish)
   */
  async loadKnowledge() {
    if (this.isReady) {
      try {
        const res = await this.pool.query("SELECT text, category FROM ai_knowledge ORDER BY id ASC");
        if (res.rows.length > 0) {
          const categories = [...new Set(res.rows.map((r) => r.category))];
          return { knowledge: res.rows, categories };
        }
      } catch (err) {
        console.warn("⚠️ Neon'dan bilimlarni o'qishda xatolik, lokal fayldan foydalaniladi:", err.message);
      }
    }

    // Fallback: data/knowledge.json
    const localPath = path.join(__dirname, "..", "data", "knowledge.json");
    if (fs.existsSync(localPath)) {
      return JSON.parse(fs.readFileSync(localPath, "utf-8"));
    }
    return { categories: [], knowledge: [] };
  }

  /**
   * Neon bazasiga yangi bilimlarni kiritish (High-Performance Batch Insert)
   * Bittalab 1200 marta so'rov yuborish o'rniga 100 tadan paketlab 2 soniyada yuklaydi!
   */
  async seedKnowledge(knowledgeList) {
    if (!this.isReady || !knowledgeList || knowledgeList.length === 0) return 0;

    const validItems = [];
    const seenTexts = new Set();
    for (const item of knowledgeList) {
      if (!item || !item.text) continue;
      const cleanText = item.text.trim().replace(/\s+/g, " ");
      const lower = cleanText.toLowerCase();
      if (cleanText.length >= 2 && !seenTexts.has(lower)) {
        seenTexts.add(lower);
        validItems.push({ text: cleanText, category: item.category || "noma'lum" });
      }
    }

    if (validItems.length === 0) return 0;

    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < validItems.length; i += batchSize) {
      const chunk = validItems.slice(i, i + batchSize);
      const valuePlaceholders = [];
      const values = [];

      chunk.forEach((item, idx) => {
        const offset = idx * 2;
        valuePlaceholders.push(`($${offset + 1}, $${offset + 2})`);
        values.push(item.text, item.category);
      });

      const sql = `
        INSERT INTO ai_knowledge (text, category)
        VALUES ${valuePlaceholders.join(", ")}
        ON CONFLICT DO NOTHING
        RETURNING id;
      `;

      try {
        const res = await this.pool.query(sql, values);
        if (res && res.rowCount) {
          inserted += res.rowCount;
        }
      } catch (err) {
        // Fallback xatolik bo'lsa davom etadi
      }

      const percent = Math.min(100, Math.round(((i + chunk.length) / validItems.length) * 100));
      const current = Math.min(i + chunk.length, validItems.length);
      process.stdout.write(`\r   ☁️  Neon DB ga yuklanmoqda: ${percent}% (${current}/${validItems.length})`);
    }

    process.stdout.write("\n");
    return inserted;
  }

  /**
   * O'qitilgan model og'irliklarini Neon ga saqlash
   */
  async saveModelState(modelName, weights, vocab, categories, meta = {}) {
    if (!this.isReady) return false;

    try {
      const query = `
        INSERT INTO ai_model_state (model_name, weights, vocab, categories, meta, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (model_name) DO UPDATE SET
          weights = EXCLUDED.weights,
          vocab = EXCLUDED.vocab,
          categories = EXCLUDED.categories,
          meta = EXCLUDED.meta,
          updated_at = NOW();
      `;
      await this.pool.query(query, [
        modelName,
        JSON.stringify(weights),
        JSON.stringify(vocab),
        JSON.stringify(categories),
        JSON.stringify(meta),
      ]);
      console.log(`✅ [${modelName}] modeli og'irliklari Neon Postgres'ga saqlandi!`);
      return true;
    } catch (err) {
      console.error("🛑 Modelni Neon'ga saqlashda xatolik:", err.message);
      return false;
    }
  }

  /**
   * Model og'irliklarini Neon'dan yuklash
   */
  async loadModelState(modelName) {
    if (!this.isReady) return null;

    try {
      const res = await this.pool.query(
        "SELECT weights, vocab, categories, meta FROM ai_model_state WHERE model_name = $1",
        [modelName]
      );
      if (res.rows.length > 0) {
        return res.rows[0];
      }
    } catch (err) {
      console.warn(`⚠️ [${modelName}] modelini Neon'dan yuklashda xatolik:`, err.message);
    }
    return null;
  }

  /**
   * Hebbian faktini qo'shish yoki kuchaytirish
   */
  async recordHebbianFact(subject, relation, object) {
    if (!this.isReady) return null;

    try {
      const query = `
        INSERT INTO ai_memory (subject, relation, object, weight, recalled_count, last_recalled_at)
        VALUES ($1, $2, $3, 1.0, 1, NOW())
        ON CONFLICT (subject, relation, object) DO UPDATE SET
          weight = LEAST(ai_memory.weight + 0.35, 5.0),
          recalled_count = ai_memory.recalled_count + 1,
          last_recalled_at = NOW()
        RETURNING *;
      `;
      const res = await this.pool.query(query, [
        subject.toLowerCase().trim(),
        relation.toLowerCase().trim(),
        object.trim(),
      ]);
      return res.rows[0];
    } catch (err) {
      console.warn("⚠️ Hebbian faktini saqlashda xatolik:", err.message);
      return null;
    }
  }

  /**
   * Mavzuga oid Hebbian assotsiativ faktlarni chaqirib olish
   */
  async recallFacts(keyword) {
    if (!this.isReady || !keyword) return [];

    try {
      const query = `
        SELECT subject, relation, object, weight, recalled_count
        FROM ai_memory
        WHERE subject ILIKE $1 OR object ILIKE $1
        ORDER BY weight DESC, last_recalled_at DESC
        LIMIT 5;
      `;
      const res = await this.pool.query(query, [`%${keyword}%`]);
      return res.rows;
    } catch (err) {
      return [];
    }
  }

  /**
   * Muloqot replikasini yozish (Anti-Repetition va tarix uchun)
   */
  async logTurn(role, text, intent = null, mood = null) {
    if (!this.isReady) return;

    try {
      await this.pool.query(
        "INSERT INTO ai_dialogue_history (role, text, intent, mood) VALUES ($1, $2, $3, $4)",
        [role, text, intent, mood]
      );
    } catch (err) {
      // Jim davom etish
    }
  }

  /**
   * Oxirgi aytilgan replikalarni olish (Takrorlanishning oldini olish uchun)
   */
  async getRecentBotReplies(limit = 15) {
    if (!this.isReady) return [];

    try {
      const res = await this.pool.query(
        "SELECT text, intent, mood FROM ai_dialogue_history WHERE role = 'bot' ORDER BY id DESC LIMIT $1",
        [limit]
      );
      return res.rows.map((r) => r.text);
    } catch (err) {
      return [];
    }
  }

  /**
   * Resurslarni yopish
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isReady = false;
    }
  }
}

// Singleton instancia
const dbService = new DatabaseService();

module.exports = dbService;
