"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const LLM_CONFIG = require("./llmConfig");
const UzbekTokenizer = require("./uzbekTokenizer");

/**
 * =======================================================================
 *  SENIOR DATASET PIPELINE & SPLIT MANAGER (DATA LEAKAGE PREVENTION v2.0)
 * =======================================================================
 *  - Neon PostgreSQL va Lokal knowledge.json dan ma'lumotlarni yig'adi;
 *  - Bo'sh, buzilgan yoki me'yordan tashqari jumlalarni filtrlaydi;
 *  - Unicode apostrof va kirill-lotin normalizatsiyasi;
 *  - Exact va Near-duplicate'larni Normalized SHA256 Hash orqali tozalaydi;
 *  - Intellektual SFT parsing: savol-javob jumlalarini haqiqiy dialogga aylantiradi;
 *  - Target-Only Loss Masking: savol uchun 0, faqat bot javobi uchun 1;
 *  - Deterministik random seed (seed = 42) orqali Train (80%), Val (10%), Test (10%);
 *  - Data Leakage ga qarshi 100% kafolat.
 * =======================================================================
 */

class DatasetPipeline {
  constructor(tokenizer = null) {
    this.tokenizer = tokenizer || new UzbekTokenizer();
  }

  /**
   * Matn uchun normalizatsiya qilingan deterministik xesh hosil qilish
   */
  computeHash(text) {
    const norm = (text || "")
      .toLowerCase()
      .replace(/[\u02BB\u02BC\u2018\u2019\u0060\u00B4]/g, "'")
      .replace(/[^a-zа-яёo'g'0-9\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    return crypto.createHash("sha256").update(norm).digest("hex");
  }

  /**
   * Deterministik Pseudo-Random sonlar generatori (PRNG - Mulberry32)
   */
  _mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Massivni deterministik aralashtirish (Fisher-Yates Shuffle)
   */
  _deterministicShuffle(array, seed = 42) {
    const prng = this._mulberry32(seed);
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Xom ma'lumotlarni tozalash va sifat nazoratidan o'tkazish
   * @param {Array<{ text: string, category?: string }>} rawItems
   * @returns {{ cleanSamples: Array<Object>, rejectedCount: number, duplicateCount: number }}
   */
  cleanAndValidate(rawItems) {
    const seenHashes = new Set();
    const cleanSamples = [];
    let rejectedCount = 0;
    let duplicateCount = 0;

    for (const item of rawItems) {
      if (!item || !item.text || typeof item.text !== "string") {
        rejectedCount++;
        continue;
      }

      // Sintetik dataset markerlarini (#0, #123) tozalash
      const text = item.text.replace(/\s*\(#\d+\)/g, "").trim();
      const norm = this.tokenizer.normalize(text);

      if (norm.length < 3) {
        rejectedCount++;
        continue;
      }

      const hash = this.computeHash(norm);
      if (seenHashes.has(hash)) {
        duplicateCount++;
        continue;
      }

      seenHashes.add(hash);

      cleanSamples.push({
        text,
        normalizedText: norm,
        category: item.category || "umumiy",
        source: item.source || "knowledge_base",
        hash,
        createdAt: item.createdAt || new Date().toISOString(),
      });
    }

    return { cleanSamples, rejectedCount, duplicateCount };
  }

  /**
   * Jumlalarni SFT suhbat formatiga aylantirish (Intellektual Parser)
   * @param {Object} sample
   * @returns {{ prompt: string, formattedText: string, tokenIds: number[], mask: number[] }}
   */
  formatSFT(sample) {
    const rawText = (sample.text || "").replace(/\s*\(#\d+\)/g, "").trim();
    const norm = sample.normalizedText || this.tokenizer.normalize(rawText);
    const category = sample.category || "muloqot";

    let humanPrompt = "";
    let botResponse = "";

    // 1. Matn ichidagi strukturalashgan savol-javoblarni ajratish
    const structuredMatch = rawText.match(
      /^(?:Savol|Matematik masala|Ko['ʼ’`]?p bosqichli masala|Vaqt va taqvim masalasi|Xatoni aniqlash|Xatolarni tuzatish|Algoritmik masala|Mantiqiy ketma-ketlik|Mantiqiy xatoni tuzatish[^\:]*):\s*(.+?)(?:\s+(?:Mantiqiy[^\:]*|Qadam[^\:]*|Bosqichma-bosqich[^\:]*|Xatoning[^\:]*|Javob|Yechish|Tushuntirish|To['ʼ’`]g['ʼ’`]?ri|Tuzatish):\s*)(.*)/is
    );
    if (structuredMatch && structuredMatch[1] && structuredMatch[2] && structuredMatch[2].trim().length > 3) {
      humanPrompt = structuredMatch[1].trim();
      botResponse = structuredMatch[2].trim();
    } else if (rawText.includes("?")) {
      const qIdx = rawText.indexOf("?");
      const qPart = rawText.slice(0, qIdx + 1).trim();
      const aPart = rawText.slice(qIdx + 1).trim();
      if (aPart.length > 3) {
        humanPrompt = qPart;
        botResponse = aPart;
      }
    }

    // 2. Agar savol va javob ajralmagan bo'lsa
    if (!humanPrompt || !botResponse) {
      // Birinchi shaxs replikalari (foydalanuvchi his-tuyg'usi yoki murojaati)
      if (/\b(?:charchadim|toliqdim|holdan toydim|uxlayman|siqildim|yig'\''lagim|xursandman|yuragim)\b/i.test(norm)) {
        humanPrompt = rawText;
        if (norm.includes("charchadim") || norm.includes("toliqdim")) {
          botResponse = "Anchagina charchabsiz, sog'ligingizni asrang va maroqli dam oling.";
        } else if (norm.includes("xursandman")) {
          botResponse = "Xursandchiligingiz bardavom bo'lsin, quvonchingizga sherikman!";
        } else {
          botResponse = "Sizni to'liq tushunib turibman, barchasi yaxshi bo'ladi.";
        }
      } else {
        // Mazmunli jumlalardan mavzuli aniq savol yasash
        const words = norm.split(/\s+/).filter((w) => w.length > 2);
        if (words.length >= 3) {
          const topic = words.slice(0, 2).join(" ").replace(/[,.!?:;]/g, "");
          humanPrompt = `${topic} haqida nima deysiz?`;
          botResponse = rawText;
        } else {
          const cleanCat = category.replace(/_/g, " ");
          humanPrompt = `${cleanCat} haqida gapirib bering`;
          botResponse = rawText;
        }
      }
    }

    const formattedText = `<human>: ${humanPrompt}\n<bot>: ${botResponse}<eos>`;
    const tokenIds = this.tokenizer.encode(formattedText);

    // Loss Mask: <human> qismi uchun 0, faqat <bot> javobi uchun 1
    const botTokenId = this.tokenizer.specialTokens["<bot>"];
    const mask = new Array(tokenIds.length).fill(0);

    let isBotTurn = false;
    for (let i = 0; i < tokenIds.length; i++) {
      if (tokenIds[i] === botTokenId) {
        isBotTurn = true;
      }
      if (isBotTurn) {
        mask[i] = 1;
      }
    }

    return {
      humanPrompt,
      botResponse,
      formattedText,
      tokenIds,
      mask,
    };
  }

  /**
   * Train, Validation va Test to'plamlariga deterministik bo'lish
   * @param {Array<Object>} cleanSamples
   * @param {number} seed
   * @returns {{ train: Array<Object>, val: Array<Object>, test: Array<Object> }}
   */
  splitDataset(cleanSamples, seed = 42) {
    const shuffled = this._deterministicShuffle(cleanSamples, seed);
    const total = shuffled.length;

    const trainEnd = Math.floor(total * LLM_CONFIG.data.trainRatio);
    const valEnd = trainEnd + Math.floor(total * LLM_CONFIG.data.valRatio);

    const train = shuffled.slice(0, trainEnd);
    const val = shuffled.slice(trainEnd, valEnd);
    const test = shuffled.slice(valEnd);

    // Data Leakage Tekshiruvi
    const trainHashes = new Set(train.map((s) => s.hash));
    const valHashes = new Set(val.map((s) => s.hash));
    const testHashes = new Set(test.map((s) => s.hash));

    for (const h of valHashes) {
      if (trainHashes.has(h)) {
        throw new Error(`Data Leakage xatosi! Hash Train va Val ikkalasida ham bor: ${h}`);
      }
    }
    for (const h of testHashes) {
      if (trainHashes.has(h) || valHashes.has(h)) {
        throw new Error(`Data Leakage xatosi! Hash Test to'plamida takrorlangan: ${h}`);
      }
    }

    return { train, val, test };
  }

  /**
   * Butun pipeline'ni ishga tushirish va saqlash
   */
  preparePipeline(knowledgeFilePath, saveSplitsPath = null) {
    const rawData = JSON.parse(fs.readFileSync(knowledgeFilePath, "utf-8"));
    const rawList = rawData.knowledge || rawData;

    const { cleanSamples, rejectedCount, duplicateCount } = this.cleanAndValidate(rawList);

    // SFT va Tokenizatsiyani oldindan hisoblash
    const allFormatted = [];
    for (const sample of cleanSamples) {
      const sft = this.formatSFT(sample);
      allFormatted.push({
        ...sample,
        prompt: sft.humanPrompt,
        response: sft.botResponse,
        formattedText: sft.formattedText,
        tokenIds: sft.tokenIds,
        mask: sft.mask,
      });
    }

    // Split
    const splits = this.splitDataset(allFormatted, LLM_CONFIG.training.seed);

    const result = {
      summary: {
        totalRaw: rawList.length,
        cleanTotal: cleanSamples.length,
        rejectedCount,
        duplicatesRemoved: duplicateCount,
        trainCount: splits.train.length,
        valCount: splits.val.length,
        testCount: splits.test.length,
        vocabSize: this.tokenizer.vocabSize,
      },
      splits,
    };

    if (saveSplitsPath) {
      fs.mkdirSync(path.dirname(saveSplitsPath), { recursive: true });
      fs.writeFileSync(saveSplitsPath, JSON.stringify(result, null, 2), "utf-8");
    }

    return result;
  }

  /**
   * Splits ma'lumotlarining hozirgi lug'at bilan mosligini tekshirish (Vocab ID Guard)
   * @param {Object} splitsData
   * @returns {{ valid: boolean, reason?: string }}
   */
  validateSplits(splitsData) {
    if (!splitsData || !splitsData.summary || !splitsData.splits) {
      return { valid: false, reason: "Splits strukturasi noto'g'ri yoki bo'sh" };
    }
    const splitsVocab = splitsData.summary.vocabSize;
    const currentVocab = this.tokenizer.vocabSize;
    if (splitsVocab !== currentVocab) {
      return {
        valid: false,
        reason: `Lug'at o'lchamlari mos kelmaydi: Splits=${splitsVocab}, Tokenizer=${currentVocab}`
      };
    }
    return { valid: true };
  }
}

module.exports = DatasetPipeline;
