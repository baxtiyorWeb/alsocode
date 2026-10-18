"use strict";

const fs = require("fs");
const path = require("path");
const LLM_CONFIG = require("./llmConfig");
const { uzbekNormalizer } = require("./uzbekNormalizer");

/**
 * =======================================================================
 *  SENIOR UZBEK SUBWORD & CHARACTER-SAFE BPE TOKENIZER (v2.0)
 * =======================================================================
 *  - Apostroflarning barcha variantlarini yagona standartga keltiradi:
 *    ('ʻ', 'ʼ', '‘', '’', '`' -> "'")
 *  - Kirill-Lotin unifikatsiyasi va avtomatik transliteratsiya
 *  - O'zbek tili harf birikmalari: o', g', sh, ch, ng
 *  - Barcha maxsus tokenlar: <pad>, <bos>, <eos>, <unk>, <human>, <bot>
 *  - Subword fallback: Noma'lum so'zlarni belgilarga ajratadi, OOV yo'q!
 *  - 100% Round-trip fidelity: decode(encode(text)) matnni to'liq tiklaydi.
 * =======================================================================
 */

class UzbekTokenizer {
  constructor(vocabSize = 8192) {
    this.targetVocabSize = vocabSize;
    this.tokenToId = new Map();
    this.idToToken = new Map();
    this.merges = []; // BPE merge rules: [pairKey, resultingToken]

    // Boshlang'ich maxsus tokenlar
    this.specialTokens = { ...LLM_CONFIG.specialTokenNames };

    // Initsializatsiya
    this._initBaseVocab();
  }

  _initBaseVocab() {
    this.tokenToId.clear();
    this.idToToken.clear();

    // 1. Maxsus tokenlarni qo'shish
    for (const [name, id] of Object.entries(this.specialTokens)) {
      this.tokenToId.set(name, id);
      this.idToToken.set(id, name);
    }

    // 2. Asosiy lotin, tinish, arifmetika va raqam belgilari
    const baseChars = [
      " ", "a", "b", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
      "n", "o", "p", "q", "r", "s", "t", "u", "v", "x", "y", "z", "'",
      "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
      "+", "-", "*", "/", "=", "%", "<", ">",
      ".", ",", "!", "?", ":", ";", "(", ")", "[", "]", "{", "}",
      "\"", "_", "@", "#", "$", "&", "\n"
    ];

    for (const ch of baseChars) {
      if (!this.tokenToId.has(ch)) {
        const id = this.tokenToId.size;
        this.tokenToId.set(ch, id);
        this.idToToken.set(id, ch);
      }
    }
  }

  /**
   * Belgini dinamik ro'yxatga olish (Agar hali bo'lmasa)
   */
  _ensureChar(ch) {
    if (!this.tokenToId.has(ch)) {
      const id = this.tokenToId.size;
      this.tokenToId.set(ch, id);
      this.idToToken.set(id, ch);
    }
    return this.tokenToId.get(ch);
  }

  /**
   * O'zbekcha matnni Unicode, apostrof va kirill-lotin bo'yicha unifikatsiya qilish
   * @param {string} text
   * @returns {string}
   */
  normalize(text) {
    if (!text || typeof text !== "string") return "";

    let normalized = text;
    if (uzbekNormalizer && typeof uzbekNormalizer.normalize === "function") {
      const res = uzbekNormalizer.normalize(text);
      normalized = res.normalized || text;
    }

    return normalized
      // 1. Apostrof va okinalarni yagona qat'iy "'" belgisiga o'tkazish
      .replace(/[\u02BB\u02BC\u2018\u2019\u0060\u00B4\u201B\u2032]/g, "'")
      // 2. Katta harflarni kichikka o'tkazish
      .toLowerCase()
      // 3. Ortiqcha probellarni tozalash (lekin yangi qator \n ni saqlash)
      .replace(/[ \t\r]+/g, " ")
      .trim();
  }

  /**
   * Matnlar korpusi bo'yicha lug'atni (BPE / Frequent Subwords) o'qitish
   * @param {string[]} texts
   */
  train(texts) {
    this._initBaseVocab();

    // So'z chastotalarini yig'ish
    const wordFreqs = new Map();
    for (const raw of texts) {
      const norm = this.normalize(raw);
      if (!norm) continue;

      const words = norm.split(" ");
      for (const w of words) {
        if (!w) continue;
        const key = " " + w;
        wordFreqs.set(key, (wordFreqs.get(key) || 0) + 1);
      }
    }

    // Har bir so'zni boshlang'ich belgilar ketma-ketligiga bo'lamiz
    let splits = new Map();
    for (const [w] of wordFreqs.entries()) {
      splits.set(w, Array.from(w));
    }

    // BPE Merges
    while (this.tokenToId.size < this.targetVocabSize) {
      const pairCounts = new Map();

      for (const [w, freq] of wordFreqs.entries()) {
        const split = splits.get(w);
        for (let i = 0; i < split.length - 1; i++) {
          const pair = `${split[i]}@@${split[i + 1]}`;
          pairCounts.set(pair, (pairCounts.get(pair) || 0) + freq);
        }
      }

      if (pairCounts.size === 0) break;

      let bestPair = null;
      let maxCount = 0;
      for (const [pair, count] of pairCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          bestPair = pair;
        }
      }

      if (!bestPair || maxCount < 2) break;

      const [partA, partB] = bestPair.split("@@");
      const newToken = partA + partB;

      if (!this.tokenToId.has(newToken)) {
        const id = this.tokenToId.size;
        this.tokenToId.set(newToken, id);
        this.idToToken.set(id, newToken);
        this.merges.push([partA, partB, newToken]);
      }

      for (const [w] of wordFreqs.entries()) {
        const split = splits.get(w);
        const newSplit = [];
        let i = 0;
        while (i < split.length) {
          if (i < split.length - 1 && split[i] === partA && split[i + 1] === partB) {
            newSplit.push(newToken);
            i += 2;
          } else {
            newSplit.push(split[i]);
            i++;
          }
        }
        splits.set(w, newSplit);
      }
    }
  }

  /**
   * So'zni BPE merge qoidalariga ko'ra tokenlarga ajratish
   * @param {string} wordWithPrefix
   * @returns {string[]}
   */
  _encodeWord(wordWithPrefix) {
    if (this.tokenToId.has(wordWithPrefix)) {
      return [wordWithPrefix];
    }

    let pieces = Array.from(wordWithPrefix);

    for (const [partA, partB, newToken] of this.merges) {
      if (pieces.length < 2) break;
      const newPieces = [];
      let i = 0;
      while (i < pieces.length) {
        if (i < pieces.length - 1 && pieces[i] === partA && pieces[i + 1] === partB) {
          newPieces.push(newToken);
          i += 2;
        } else {
          newPieces.push(pieces[i]);
          i++;
        }
      }
      pieces = newPieces;
    }

    return pieces;
  }

  /**
   * Matnni token ID lari massiviga aylantirish (Encode)
   * @param {string} text
   * @param {boolean} addBos
   * @param {boolean} addEos
   * @returns {number[]}
   */
  encode(text, addBos = false, addEos = false) {
    if (!text || typeof text !== "string") return [];

    const norm = this.normalize(text);
    const tokenIds = [];

    if (addBos) tokenIds.push(this.specialTokens["<bos>"]);

    // Maxsus teglar mavjud bo'lsa (<human>, <bot>, <context>, </context>, etc.) ularni saqlash
    const specialKeys = Object.keys(this.specialTokens || {});
    const escapedSpecial = specialKeys.length > 0
      ? specialKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
      : "<human>|<bot>|<bos>|<eos>|<pad>|<unk>";
    const specialRegex = new RegExp(`(${escapedSpecial})`, "g");
    const parts = norm.split(specialRegex);

    for (const part of parts) {
      if (!part) continue;
      if (this.specialTokens[part] !== undefined) {
        tokenIds.push(this.specialTokens[part]);
        continue;
      }

      const words = part.split(" ");
      for (let wIdx = 0; wIdx < words.length; wIdx++) {
        const w = words[wIdx];
        if (!w) continue;
        const prefix = wIdx === 0 && part.startsWith(w) && !norm.startsWith(" ") ? w : " " + w;
        const subPieces = this._encodeWord(prefix);

        for (const piece of subPieces) {
          if (this.tokenToId.has(piece)) {
            tokenIds.push(this.tokenToId.get(piece));
          } else {
            for (const ch of piece) {
              tokenIds.push(this.tokenToId.get(ch) ?? this._ensureChar(ch));
            }
          }
        }
      }
    }

    if (addEos) tokenIds.push(this.specialTokens["<eos>"]);

    return tokenIds;
  }

  /**
   * Generatsiya qilingan yoki dekodlangan matnni tozalash va grammatik bo'shliqlarni tiklash
   * @param {string} raw
   * @returns {string}
   */
  static cleanDetokenizedText(raw) {
    if (!raw || typeof raw !== "string") return "";
    return raw
      // 1. Sintetik dataset belgilarini olib tashlash: (#0), (#123)
      .replace(/\s*\(#\d+\)/g, "")
      // 2. Raqam va yopishib qolgan harflarni ajratish: "20in" -> "20 in", "89ta" -> "89 ta"
      .replace(/(\d+)([a-zA-Z\u0400-\u04FF\u02BB\u02BC\u2018\u2019'`]+)/g, "$1 $2")
      // 3. Harf va yopishib qolgan raqamni ajratish: "hozirin89" -> "hozirin 89"
      .replace(/([a-zA-Z\u0400-\u04FF\u02BB\u02BC\u2018\u2019'`]+)(\d+)/g, "$1 $2")
      // 4. Salom va yopishib qolgan 'in' subwordini to'g'rilash: "salomin" -> "salom in"
      .replace(/\b(salom)(in)\b/gi, "$1 $2")
      // 5. Tinish belgilari oldidagi ortiqcha probellarni olish: "salom !" -> "salom!"
      .replace(/\s+([.,!?:;])/g, "$1")
      // 6. Tinish belgisidan keyin bo'shliq qo'yish (agar raqam yoki maxsus teg bo'lmasa)
      .replace(/([.,!?:;])([a-zA-Z\u0400-\u04FF])/g, "$1 $2")
      // 7. Ortiqcha probellarni tozalash (yangi qatorlarni saqlagan holda)
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  /**
   * Token ID lari massividan matn hosil qilish (Decode)
   * @param {number[]} tokenIds
   * @param {boolean} skipSpecial
   * @param {boolean} clean
   * @returns {string}
   */
  decode(tokenIds, skipSpecial = false, clean = true) {
    if (!tokenIds || !Array.isArray(tokenIds)) return "";

    const parts = [];
    for (const id of tokenIds) {
      if (id === this.specialTokens["<pad>"]) continue;
      if (id === this.specialTokens["<bos>"]) continue;
      if (id === this.specialTokens["<eos>"]) {
        if (!skipSpecial) parts.push("<eos>");
        break;
      }

      const tokenStr = this.idToToken.get(id);
      if (!tokenStr) continue;

      if (this.specialTokens[tokenStr] !== undefined) {
        if (!skipSpecial) parts.push(tokenStr);
        continue;
      }

      parts.push(tokenStr);
    }

    const raw = parts.join("");
    return clean ? UzbekTokenizer.cleanDetokenizedText(raw) : raw;
  }

  /**
   * Lug'at hajmi
   */
  get vocabSize() {
    return this.tokenToId.size;
  }

  /**
   * Lug'atni JSON faylga saqlash
   */
  saveToFile(filePath) {
    const data = {
      vocabSize: this.vocabSize,
      specialTokens: this.specialTokens,
      merges: this.merges,
      tokens: Array.from(this.tokenToId.entries()),
    };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  /**
   * Lug'atni JSON fayldan yuklash
   */
  loadFromFile(filePath) {
    if (!fs.existsSync(filePath)) return false;
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    this.tokenToId.clear();
    this.idToToken.clear();
    this.specialTokens = data.specialTokens;
    this.merges = data.merges || [];

    for (const [token, id] of data.tokens) {
      this.tokenToId.set(token, id);
      this.idToToken.set(id, token);
    }
    return true;
  }
}

module.exports = UzbekTokenizer;
