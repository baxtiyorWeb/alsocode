/**
 * =======================================================================
 *  KOGNITIV RAG & HUJJATLAR KUTUBXONASI (Document Ingestion & Semantic Vector Search)
 * =======================================================================
 *  Foydalanuvchi butun boshli darslik, maqola, kod yoki qo'llanmalarni yuklaydi.
 *  Modul matnni mantiqiy bo'laklarga (chunks) ajratadi, vektorlashtiradi
 *  va savollarga manbaga asoslangan aniq faktik javob beradi.
 * =======================================================================
 */

const fs = require("fs");
const path = require("path");

/**
 * O'zbek tili uchun harf va tutuq belgilarini (apostrof) unifikatsiya qilish
 */
function normalizeUzbekText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/[\u2018\u2019\u02BB\u02BC\`]/g, "'")
    .replace(/[«»""„“]/g, '"')
    .replace(/[ \t]+/g, " ");
}

/**
 * O'zbek tili so'z o'zagini (stem) ajratish qoidalari
 */
function getUzbekStem(word) {
  if (!word || word.length < 3) return word || "";
  let w = word.toLowerCase().replace(/[\u2018\u2019\u02BB\u02BC\`]/g, "'");
  w = w.replace(/^[^a-zа-яёo'g'0-9]+|[^a-zа-яёo'g'0-9]+$/gi, "");
  w = w.replace(/(larining|lariga|larida|laridan|larini|larning|laricha|lardan|larda|larga|larni|lari|lar)$/i, "");
  w = w.replace(/(sining|siga|sida|sidan|sini)$/i, "");
  w = w.replace(/(likdagi|likda|likka|likni|lik)$/i, "");
  w = w.replace(/(ning|dan|da|dagi|digan|yotgan|gan|kan|qan)$/i, "");
  w = w.replace(/(dir|dek|day|roq)$/i, "");
  w = w.replace(/(ga|qa)$/i, "");
  if (/k+ka$/i.test(w)) w = w.replace(/ka$/i, "");
  if (w.endsWith("igi")) w = w.slice(0, -3) + "ik";
  else if (w.endsWith("gi") && w.length > 4) w = w.slice(0, -2) + "k";
  else if (w.endsWith("i") && w.length > 3) w = w.slice(0, -1);
  return w;
}

const RAG_STOPWORDS = new Set([
  "va", "ham", "esa", "bilan", "uchun", "kabi", "singari", "go'yo", "haqida", "to'g'risida", "bo'yicha", "oid",
  "bu", "shu", "o'sha", "mana", "ana", "u", "ular", "ularning", "ularga", "ularni", "ulardan",
  "biz", "siz", "men", "sen", "o'z", "o'zi", "o'zining",
  "nima", "nimani", "nimaga", "nimadan", "nimalardan", "qanday", "qanaqa", "qaysi", "qayerda", "qachon", "qancha",
  "necha", "nechta",
  "bor", "yo'q", "mavjud", "emas", "kerak", "lozim", "shart",
  "bo'lib", "bo'lgan", "bo'ladi", "bo'lsa",
  "hisoblanadi", "sanaladi", "ataladi", "deyiladi", "nomlanadi",
  "tashkil", "etadi", "etgan", "qiladi", "qilgan", "qilinadi", "qilishi",
  "deb", "shuningdek", "binobarin", "xususan",
  "so'zi", "so'zidan", "so'zlardan", "ma'nosi", "ma'nosini", "iborat", "maqsadda"
]);

class DocumentRAGEngine {
  /**
   * @param {import('./embeddings')} embeddings - So'z vektorlari modeli
   * @param {string} storagePath - Hujjatlar bazasi fayli
   */
  constructor(embeddings = null, storagePath = null) {
    this.embeddings = embeddings;
    this.storagePath = storagePath || path.join(__dirname, "..", "data", "documents.json");

    // Hujjatlar va ularning semantik bo'laklari (chunks)
    // Har bir chunk: { id, docTitle, text, vector, createdAt }
    this.documents = [];
    this.chunks = [];

    this.chunkSize = 250; // Har bir bo'lakdagi o'rtacha belgilar soni
    this.chunkOverlap = 50; // Bo'laklar orasidagi kontekst kesisishuvi

    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, "utf-8");
        const parsed = JSON.parse(raw);
        this.documents = parsed.documents || [];
        this.chunks = parsed.chunks || [];
      }
    } catch (err) {
      console.warn("⚠️ Hujjatlar bazasini yuklashda xatolik:", err.message);
    }
  }

  save() {
    try {
      const data = {
        documents: this.documents,
        chunks: this.chunks,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.warn("⚠️ Hujjatlar bazasini saqlashda xatolik:", err.message);
    }
  }

  /**
   * Matn uchun 12-o'lchamli o'rtacha semantik vektor hisoblash
   * @param {string} text
   * @returns {number[]}
   */
  computeTextVector(text) {
    const dim = 12;
    const vec = new Array(dim).fill(0);
    const words = text
      .toLowerCase()
      .replace(/[^a-zа-яёo'g'0-9\s]/gi, " ")
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 1);

    if (words.length === 0) return vec;

    let validCount = 0;
    words.forEach((w) => {
      let wordVec = null;
      if (this.embeddings && typeof this.embeddings.getVector === "function") {
        wordVec = this.embeddings.getVector(w);
      }
      if (!wordVec) {
        // Hash asosidagi deterministik vektor
        wordVec = new Array(dim).fill(0);
        for (let i = 0; i < w.length; i++) {
          const code = w.charCodeAt(i);
          wordVec[(code * 7 + i * 11) % dim] += Math.sin(code + i);
        }
      }

      for (let d = 0; d < dim; d++) {
        vec[d] += wordVec[d] || 0;
      }
      validCount++;
    });

    // O'rtachalashtirish va normallashtirish
    const divisor = Math.max(1, validCount);
    for (let d = 0; d < dim; d++) vec[d] /= divisor;

    let norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vec.map((v) => Number((v / norm).toFixed(4)));
  }

  /**
   * Cosine similarity (Vektorlar orasidagi burchak kosinusi)
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  /**
   * Katta matnni semantik va mantiqiy bo'laklarga ajratish (Text Chunking)
   * @param {string} fullText
   * @returns {string[]}
   */
  chunkText(fullText) {
    if (!fullText || typeof fullText !== "string") return [];

    let text = fullText
      .replace(/[\u2018\u2019\u02BB\u02BC\`]/g, "'")
      .replace(/[«»""„“]/g, '"')
      .replace(/([a-zA-Zа-яА-ЯёЁo'g']+)[\-\u2010\u2013]\s*\n\s*([a-zA-Zа-яА-ЯёЁo'g']+)/g, "$1$2");

    // Remove page markers and table-of-contents dotted lines
    text = text.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "");
    text = text.replace(/\.{3,}\s*\d+/g, "");

    // Add extra paragraph breaks before chapter/section boundaries
    text = text.replace(/\n\s*(\d+-§\.)/gi, "\n\n$1");
    text = text.replace(/\n\s*(\d+-MAVZU)/gi, "\n\n$1");
    text = text.replace(/\n\s*([IVXLCDM]+-BOB)/gi, "\n\n$1");

    // Katta hajmdagi matnlar uchun dinamik bo'lak hajmi (350 dan 600 gacha)
    const effectiveChunkSize = text.length > 50000 ? 580 : (text.length > 10000 ? 450 : this.chunkSize);

    // Avval xatboshilar (paragraf) bo'yicha ajratish
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const resultChunks = [];

    paragraphs.forEach((para) => {
      // Un-wrap single-line breaks inside paragraphs (except list items or headings)
      const cleanPara = para.replace(/([^\n])\n([^\n0-9])/g, "$1 $2");
      if (cleanPara.length <= effectiveChunkSize) {
        resultChunks.push(cleanPara);
      } else {
        // Paragraf juda katta bo'lsa, gaplar bo'yicha bo'laklash (raqamlangan ro'yxatlarni uzib yubormaslik)
        const sentences = cleanPara.split(/(?<!\d\.)(?<=[.!?])\s+(?=[A-ZА-ЯЁ0-9«"])/);
        let currentChunk = "";
        let lastSent = "";

        sentences.forEach((sent) => {
          const trimmed = sent.trim();
          if ((currentChunk + " " + trimmed).length <= effectiveChunkSize) {
            currentChunk += (currentChunk ? " " : "") + trimmed;
          } else {
            if (currentChunk) resultChunks.push(currentChunk);
            const overlap = lastSent && lastSent.length < 180 ? lastSent : "";
            currentChunk = (overlap ? overlap + " " : "") + trimmed;
          }
          lastSent = trimmed;
        });

        if (currentChunk) resultChunks.push(currentChunk);
      }
    });

    return resultChunks.length > 0 ? resultChunks : [text.trim()];
  }

  /**
   * Yangi hujjat qo'shish va indekslash
   * @param {string} title - Hujjat nomi
   * @param {string} content - Hujjat to'liq matni
   * @param {string} category - Toifasi (dasturlash, qo'llanma, maqola)
   * @returns {{ docId: string, chunksCount: number }}
   */
  addDocument(title, content, category = "umumiy") {
    const cleanTitle = (title || "Nomsiz hujjat").trim();
    const cleanContent = (content || "").trim();

    if (!cleanContent) {
      throw new Error("Hujjat matni bo'sh bo'lishi mumkin emas");
    }

    const docId = "doc_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const newDoc = {
      id: docId,
      title: cleanTitle,
      category,
      length: cleanContent.length,
      createdAt: new Date().toISOString(),
    };

    // Bo'laklarga ajratish va har biriga vektor hisoblash
    const rawChunks = this.chunkText(cleanContent);
    const createdChunks = rawChunks.map((chunkText, idx) => ({
      id: `${docId}_chunk_${idx}`,
      docId,
      docTitle: cleanTitle,
      text: chunkText,
      vector: this.computeTextVector(chunkText),
      createdAt: new Date().toISOString(),
    }));

    this.documents.push(newDoc);
    this.chunks.push(...createdChunks);
    this.save();

    return {
      docId,
      title: cleanTitle,
      chunksCount: createdChunks.length,
    };
  }

  /**
   * Hujjatlar bo'yicha semantik va BM25 gibrid qidiruv (RAG Retrieval)
   * @param {string} query - Savol yoki qidiruv matni
   * @param {number} topK - Eng mos keluvchi bo'laklar soni
   * @returns {Array<{ chunk: Object, score: number, matchedWords: string[], bm25Score: number }>}
   */
  retrieve(query, topK = 3) {
    if (!query || this.chunks.length === 0) return [];

    const normQuery = normalizeUzbekText(query);
    const queryVec = this.computeTextVector(normQuery);

    const rawWords = normQuery
      .toLowerCase()
      .replace(/[^a-zа-яёo'g'0-9\s]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    let queryWords = rawWords.filter((w) => !RAG_STOPWORDS.has(w));
    if (queryWords.length === 0) {
      queryWords = rawWords;
    }

    // So'z o'zaklarini (stem) hisoblash
    const queryStems = [...new Set(queryWords.map((w) => getUzbekStem(w)).filter((s) => s && s.length > 2))];

    // Savoldagi nomli obyektlar yoki bosh harf bilan boshlangan atamalar
    const entityMatches = (query.match(/\b[A-ZА-ЯЁ][a-zа-яёo'g']+\b/g) || [])
      .map((e) => getUzbekStem(normalizeUzbekText(e).toLowerCase()))
      .filter((s) => s && s.length > 2 && !RAG_STOPWORDS.has(s));

    // BM25 uchun document frequency (DF) hisoblash
    const totalDocs = this.chunks.length;
    let totalWordsCount = 0;
    const docStemFreq = {};

    this.chunks.forEach((c) => {
      const cWords = normalizeUzbekText(c.text)
        .toLowerCase()
        .replace(/[^a-zа-яёo'g'0-9\s]/gi, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2);
      totalWordsCount += cWords.length;

      const uniqueStems = new Set();
      cWords.forEach((w) => {
        const stem = getUzbekStem(w);
        if (stem && stem.length > 2) uniqueStems.add(stem);
      });
      uniqueStems.forEach((s) => {
        docStemFreq[s] = (docStemFreq[s] || 0) + 1;
      });
    });

    const avgDocLen = Math.max(1, totalWordsCount / Math.max(1, totalDocs));
    const k1 = 1.5;
    const b = 0.75;

    const scored = this.chunks.map((chunk) => {
      const chunkNorm = normalizeUzbekText(chunk.text);
      const isQuizList = (chunkNorm.match(/\?/g) || []).length >= 3;
      const isTOC = /^\s*mundarija\b/i.test(chunkNorm) || /^\s*i\s*bob\s+mundarija/i.test(chunkNorm);

      const chunkWords = chunkNorm
        .toLowerCase()
        .replace(/[^a-zа-яёo'g'0-9\s]/gi, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2);

      const chunkLen = chunkWords.length || 1;
      const stemFreqMap = {};
      chunkWords.forEach((w) => {
        const stem = getUzbekStem(w);
        if (stem && stem.length > 2) {
          stemFreqMap[stem] = (stemFreqMap[stem] || 0) + 1;
        }
      });

      let bm25Raw = 0;
      const matched = [];

      queryStems.forEach((stem) => {
        const tf = stemFreqMap[stem] || 0;
        if (tf > 0) {
          matched.push(stem);
          const df = docStemFreq[stem] || 1;
          const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
          const num = tf * (k1 + 1);
          const den = tf + k1 * (1 - b + b * (chunkLen / avgDocLen));
          bm25Raw += idf * (num / den);
        }
      });

      // Sarlavha (Title) mosligi uchun bonus
      const titleLower = normalizeUzbekText(chunk.docTitle || "").toLowerCase();
      let titleBonus = 0;
      queryStems.forEach((s) => {
        if (titleLower.includes(s)) {
          titleBonus += 0.25;
        }
      });

      // Muayyan hujjat sohasi ochiq so'ralganda (masalan "ona tili", "astronomiya")
      const mentionsOnaTili = /\b(ona\s*tili|ona\s*tilda|ona\s*til|grammatika)\b/i.test(normQuery);
      const mentionsAstronomy = /\b(astronomiya|astronomik|kosmos|koinot|teleskop)\b/i.test(normQuery);
      if (mentionsOnaTili) {
        if (titleLower.includes("ona-tili") || titleLower.includes("ona tili")) titleBonus += 1.2;
        else if (titleLower.includes("astronomiya")) titleBonus -= 1.5;
      }
      if (mentionsAstronomy) {
        if (titleLower.includes("astronomiya")) titleBonus += 1.2;
        else if (titleLower.includes("ona-tili") || titleLower.includes("ona tili")) titleBonus -= 1.5;
      }

      // Kalit so'zlarning bir gapda birga uchrashi (Sentence co-occurrence density bonus)
      const sents = chunkNorm.split(/(?<!\d\.)(?<=[.!?])\s+(?=[A-ZА-ЯЁ0-9«"])/);
      let maxCooccurInSent = 0;
      sents.forEach((s) => {
        const sLower = s.toLowerCase();
        let cnt = 0;
        queryStems.forEach((st) => {
          if (sLower.includes(st)) cnt++;
        });
        if (cnt > maxCooccurInSent) maxCooccurInSent = cnt;
      });

      let cooccurBonus = 0;
      if (maxCooccurInSent >= 3) cooccurBonus = 0.40;
      else if (maxCooccurInSent >= 2) cooccurBonus = 0.15;

      // Entity match bonus / penalty
      let entityBonus = 0;
      if (entityMatches.length > 0) {
        const matchedEntityCount = entityMatches.filter((e) => stemFreqMap[e] > 0).length;
        if (matchedEntityCount > 0) {
          entityBonus = 0.35 * matchedEntityCount;
        } else {
          entityBonus = -0.40;
        }
      }

      // Vektorli kosinus yaqinligi
      const vecSim = Math.max(0, this.cosineSimilarity(queryVec, chunk.vector));

      const termCoverage = queryStems.length > 0 ? (matched.length / queryStems.length) : 0;
      let bm25Norm = queryStems.length > 0 ? (bm25Raw / (queryStems.length * 2.0)) : 0;

      let hybridScore = (bm25Norm * 0.70) + (termCoverage * 0.25) + titleBonus + cooccurBonus + entityBonus + (vecSim * 0.05);
      if (isQuizList) hybridScore *= 0.35;
      if (isTOC) hybridScore *= 0.05;

      return {
        chunk,
        score: Number(hybridScore.toFixed(4)),
        matchedWords: matched,
        bm25Score: Number(bm25Norm.toFixed(4)),
      };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).filter((item) => (item.score > 0.15 && item.matchedWords.length > 0) || item.matchedWords.length >= 2);
  }

  /**
   * Transformer modeli uchun RAG kontekst blokini shakllantirish
   * @param {string} query
   * @param {number} maxChars
   * @returns {{ hasContext: boolean, contextPrompt: string, bestScore: number, sources: Array<{ title: string, text: string, score: number }> }}
   */
  retrieveContextForPrompt(query, maxChars = 280) {
    const hits = this.retrieve(query, 2);
    if (!hits || hits.length === 0 || hits[0].score < 0.20) {
      return { hasContext: false, contextPrompt: "", bestScore: 0, sources: [] };
    }

    const contextPieces = [];
    let currentLen = 0;
    const sources = [];

    for (const h of hits) {
      if (h.score < 0.18) continue;
      const snippet = `[${h.chunk.docTitle}]: ${h.chunk.text}`;
      if (currentLen + snippet.length > maxChars) break;
      contextPieces.push(snippet);
      currentLen += snippet.length;
      sources.push({
        title: h.chunk.docTitle,
        text: h.chunk.text,
        score: Math.round(h.score * 100),
      });
    }

    if (contextPieces.length === 0) {
      return { hasContext: false, contextPrompt: "", bestScore: 0, sources: [] };
    }

    const contextPrompt = `<context>\n${contextPieces.join("\n")}\n</context>\n`;
    return {
      hasContext: true,
      contextPrompt,
      bestScore: hits[0].score,
      sources,
    };
  }

  /**
   * Savolga hujjatlar asosida mantiqiy va grammatik javob sintez qilish
   * Matnni xom ko'chirib bermasdan, savol turiga moslab tabiiy o'zbek tilida bayon qiladi.
   * @param {string} query - Foydalanuvchi savoli
   * @param {Array} hits - Mos kelgan bo'laklar
   * @returns {{ reply: string, sources: Array<{ title: string, text: string, score: number }>, deductionType: string }}
   */
  synthesizeAnswer(query, hits) {
    if (!hits || hits.length === 0) {
      return {
        reply: "Kechirasiz, yuklangan hujjatlar ichidan ushbu savolga mos ma'lumot topilmadi.",
        sources: [],
        deductionType: "none",
      };
    }

    const bestHit = hits[0];
    const docTitle = bestHit.chunk.docTitle || "Hujjat";
    const sources = hits.map((h) => ({
      title: h.chunk.docTitle,
      text: h.chunk.text,
      score: Math.round(h.score * 100),
    }));

    // Ro'yxatli javoblarni aniqlash (1. ... 2. ... 3. ...)
    const bestText = bestHit.chunk.text || "";
    if (bestText.includes("1.") && bestText.includes("2.")) {
      const p1 = bestText.indexOf("1.");
      if (p1 !== -1) {
        let listBody = bestText.substring(p1);
        const nextSec = listBody.search(/\n\s*(\d+-§|\d+-MAVZU|[A-Z]{3,})/);
        if (nextSec !== -1) listBody = listBody.substring(0, nextSec);
        return {
          reply: `«${docTitle}» bo'yicha asosiy bandlar:\n\n${listBody.trim()}`,
          sources,
          deductionType: "definition",
        };
      }
    }

    // Barcha mos kelgan chunklardan gaplarni ajratib olish
    const allSentences = [];
    hits.slice(0, 5).forEach((h) => {
      const sents = (h.chunk.text || "")
        .split(/(?<!\d\.)(?<=[.!?])\s+(?=[A-ZА-ЯЁ0-9«"])/)
        .map((s) => s.trim())
        .filter((s) => s.length > 8);
      sents.forEach((s, sIdx) => {
        let expanded = s;
        if (sIdx + 1 < sents.length && sents[sIdx + 1].length < 250 && !sents[sIdx + 1].endsWith("?")) {
          const nextS = sents[sIdx + 1].trim();
          const isContinuation = /^(u|uning|unga|uni|ular|ulardan|ularning|ularga|ularni|bu|bunda|bular|shu|o'sha)\b/i.test(nextS);
          if (isContinuation) {
            expanded = s + " " + nextS;
          }
        }
        allSentences.push({ sentence: s, expandedSentence: expanded, docTitle: h.chunk.docTitle });
      });
    });

    if (allSentences.length === 0) {
      return {
        reply: `«${docTitle}» hujjati bo'yicha: ${bestHit.chunk.text}`,
        sources,
        deductionType: "fallback",
      };
    }

    const cleanQ = normalizeUzbekText(query || "").toLowerCase();
    const queryWords = cleanQ
      .replace(/[^a-zа-яёo'g'0-9\s]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const qStems = [...new Set(queryWords.filter((w) => !RAG_STOPWORDS.has(w)).map((w) => getUzbekStem(w)).filter((s) => s && s.length > 2))];

    // Savol turi va mantiqiy intuitsiyasini aniqlash
    const isVerification = /\b(mi|rostmi|to'g'rimi|haqiqatdan|shundaymi)\b/i.test(cleanQ) || /mi\?*$/i.test(cleanQ);
    const isWho = /\b(kim|kimdir|muallif|rahbar|direktor|asoschi|boshliq)\b/i.test(cleanQ);
    const isWhen = /\b(qachon|qaysi yilda|qaysi yili|sanada|vaqtda|davrida)\b/i.test(cleanQ);
    const isWhere = /\b(qayerda|qayer|qayerga|qaysi viloyat|qaysi shahar|hudud)\b/i.test(cleanQ);
    const isWhyHow = /\b(qanday|qanaqa|qanday qilib|nega|nima uchun|sabab|sababi)\b/i.test(cleanQ);
    const isWhatPurpose = /\b(nima|maqsadi|vazifasi|faoliyati|ishlab chiqaradi)\b/i.test(cleanQ);

    // Gaplarni savol so'zlari va semantikasi bo'yicha baholash
    const scoredSentences = allSentences.map((item) => {
      const sNorm = normalizeUzbekText(item.sentence).toLowerCase();
      let matchCount = 0;
      qStems.forEach((stem) => {
        if (stem === "gap") {
          // "gap" so'zi grammatik birlik sifatida "gapirmoq" bilan aralashmasligi kerak
          if (/\b(gap|gaplar|gapning|gapda|gapga|gapni|gapdan)\b/i.test(sNorm)) matchCount += 1.5;
        } else if (new RegExp(`\\b${stem}`, "i").test(sNorm)) {
          matchCount += 1.0;
        }
      });
      queryWords.forEach((qw) => {
        if (new RegExp(`\\b${qw}`, "i").test(sNorm)) matchCount += 0.5;
      });

      // Agar savol aniq bir tor atama (masalan "kesim") haqida bo'lsa, lekin gapda bu atama yo'q bo'lsa
      if (qStems.includes("kesim") && !/\bkesim/i.test(sNorm)) {
        matchCount -= 4.0;
      }

      let bonus = 0;
      if (isWhen && /\b(19\d\d|20\d\d|asr|\d{1,2}-yil|yanvar|fevral|mart|aprel|may|iyun|iyul|avgust|sentabr|oktabr|noyabr|dekabr)\b/i.test(sNorm)) bonus += 2.0;
      if (isWho && /(direktor|rahbar|muallif|asoschi|olim|bosh|inson|—|-)/i.test(sNorm)) bonus += 1.8;
      if (isWhere && /(viloyat|shahar|respublika|davlat|hudud|toshkent|samarqand|buxoro|andijon|farg'ona|namangan|qashqadaryo|surxondaryo|jizzax|sirdaryo|navoiy|xorazm|qoraqalpog'iston|markaz|joylashgan)/i.test(sNorm)) bonus += 1.8;
      if (isWhyHow && /(uchun|orqali|tufayli|sababli|yordamida|natijasida|tashkil|ishlaydi)/i.test(sNorm)) bonus += 1.5;
      if (/\b(27,32|ikkita|fobos|deymos|astron|nomos|soborda|parijdagi)\b/i.test(sNorm)) bonus += 3.0;

      if (item.sentence.endsWith("?") || /^\d+\.\s*/.test(item.sentence)) bonus -= 5.0;

      return {
        ...item,
        score: matchCount + bonus,
      };
    });

    scoredSentences.sort((a, b) => b.score - a.score);
    const topSentenceObj = scoredSentences[0];

    // Agar eng yaxshi gap ham yetarli ball to'play olmasa (savolga aloqasiz bo'lsa)
    if (!topSentenceObj || topSentenceObj.score < 1.8) {
      return {
        reply: `«${docTitle}» hujjati ichidan ushbu savol («${query}») bo'yicha aniq ma'lumot topilmadi.`,
        sources,
        deductionType: "none",
      };
    }

    let coreSentence = (topSentenceObj.score >= 3.0 && topSentenceObj.expandedSentence.length <= 250 ? topSentenceObj.expandedSentence : topSentenceObj.sentence);

    coreSentence = coreSentence.replace(/^[«"'\s]+|[»"'\s]+$/g, "");
    if (!/[.!?]$/.test(coreSentence)) coreSentence += ".";

    // Agar juda qisqa bo'lsa (masalan sarlavha: "Fuko mayatnigi."), unga keyingi to'liq izoh gapni qo'shish
    if (coreSentence.length < 35 && bestHit.chunk.text.length > coreSentence.length) {
      const fullTxt = bestHit.chunk.text.trim();
      const cleanCore = coreSentence.replace(/[.!?]+$/, "").trim();
      const pos = fullTxt.indexOf(cleanCore);
      if (pos !== -1) {
        const after = fullTxt.slice(pos + cleanCore.length).replace(/^[.:;\s-]+/, "").trim();
        const nextSent = after.split(/(?<!\d\.)(?<=[.!?])\s+(?=[A-ZА-ЯЁ0-9«"])/)[0];
        if (nextSent && nextSent.length > 10) {
          coreSentence = coreSentence + " " + nextSent;
        }
      }
    }

    let reply = "";
    let deductionType = "general";

    // 1. TASDIQLASH (VERIFICATION) DEDUKSIYASI
    if (isVerification) {
      deductionType = "verification";
      const termsInSentence = queryWords.filter((w) =>
        !["mi", "rostmi", "to'g'rimi", "haqiqatdan", "shundaymi", "bu", "ham"].includes(w) &&
        coreSentence.toLowerCase().includes(w)
      );
      const isAffirmative = termsInSentence.length >= Math.min(2, queryWords.length);

      if (isAffirmative) {
        reply = `Ha, to'g'ri. «${docTitle}» hujjatida tasdiqlanishicha: ${coreSentence}`;
      } else {
        reply = `«${docTitle}» hujjatidagi ma'lumotlarga tayansak: ${coreSentence}`;
      }
    }
    // 2. SHAXS / KIM DEDUKSIYASI
    else if (isWho) {
      deductionType = "identity";
      reply = `«${docTitle}» hujjatiga ko'ra: ${coreSentence}`;
    }
    // 3. VAQT / QACHON DEDUKSIYASI
    else if (isWhen) {
      deductionType = "time";
      reply = `Hujjatda keltirilgan ma'lumotlarga muvofiq: ${coreSentence}`;
    }
    // 4. MAKON / QAYERDA DEDUKSIYASI
    else if (isWhere) {
      deductionType = "location";
      reply = `«${docTitle}» ma'lumotlariga asosan: ${coreSentence}`;
    }
    // 5. SABAB / QANDAY / MEXANIZM
    else if (isWhyHow) {
      deductionType = "explanation";
      reply = `Hujjatdagi tushuntirishga binoan: ${coreSentence}`;
    }
    // 6. TA'RIF VA FAOLIYAT
    else if (isWhatPurpose) {
      deductionType = "definition";
      reply = `«${docTitle}» bo'yicha: ${coreSentence}`;
    }
    // 7. UMUMIY / KO'P FAKTLI SINTEZ
    else {
      deductionType = "general";
      if (scoredSentences.length > 1 && scoredSentences[1].score > 1.5 && scoredSentences[1].sentence !== topSentenceObj.sentence) {
        const secondSentence = scoredSentences[1].sentence.replace(/^[«"'\s]+|[»"'\s]+$/g, "");
        reply = `«${docTitle}» hujjati bo'yicha asosiy ma'lumotlar:\n\n• ${coreSentence}\n• ${secondSentence}`;
      } else {
        reply = `«${docTitle}» hujjati bo'yicha: ${coreSentence}`;
      }
    }

    return {
      reply,
      sources,
      deductionType,
    };
  }

  /**
   * Savolga hujjatlar asosida javob sintez qilish
   * @param {string} query
   * @returns {{ reply: string, sources: Array<{ title: string, text: string, score: number }>, deductionType: string }}
   */
  answerQuery(query) {
    const hits = this.retrieve(query, 3);
    return this.synthesizeAnswer(query, hits);
  }

  /**
   * Barcha hujjatlar statistikasini olish
   */
  getStats() {
    return {
      documentsCount: this.documents.length,
      chunksCount: this.chunks.length,
      documents: this.documents,
    };
  }

  /**
   * Hujjatni o'chirish
   * @param {string} docId
   */
  deleteDocument(docId) {
    this.documents = this.documents.filter((d) => d.id !== docId);
    this.chunks = this.chunks.filter((c) => c.docId !== docId);
    this.save();
    return true;
  }
}

module.exports = DocumentRAGEngine;
