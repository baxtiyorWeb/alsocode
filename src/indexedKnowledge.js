"use strict";

const fs = require("fs");
const path = require("path");

/**
 * =======================================================================
 *  FAST INVERTED INDEX & KNOWLEDGE FILTER ENGINE
 * =======================================================================
 *  10,000 ta yozuvni har safar 2200 ms chiziqli qidirish o'rniga:
 *  - Xotiradagi Inverted Index (Map<Word, Set<Index>>) orqali 1-5 ms da qidiradi;
 *  - O'zbekcha apostroflarni (', ʻ, ’, `) standartlashtiradi;
 *  - Dialog/Chitchat replikalarini ilmiy ta'rif deb soxta chiqarishni bloklaydi.
 * =======================================================================
 */

class FastIndexedKnowledge {
  constructor(knowledgeBase = [], embeddings = null) {
    this.knowledgeBase = knowledgeBase;
    this.embeddings = embeddings;
    this.invertedIndex = new Map();
    this.isIndexed = false;

    if (knowledgeBase && knowledgeBase.length > 0) {
      this.buildIndex();
    }
  }

  /**
   * Barcha bilimlar bo'yicha tezkor teskari indeks (Inverted Index) qurish
   */
  buildIndex() {
    this.invertedIndex.clear();
    this.prefixIndex = new Map();

    for (let i = 0; i < this.knowledgeBase.length; i++) {
      const item = this.knowledgeBase[i];
      const text = (item.text || "").toLowerCase().replace(/[`ʼʻ']/g, "'");
      const words = text.split(/[^a-zа-яёo'g'0-9]+/i).filter(w => w.length > 2);

      const seenInDoc = new Set();
      for (const word of words) {
        if (!seenInDoc.has(word)) {
          seenInDoc.add(word);
          if (!this.invertedIndex.has(word)) {
            this.invertedIndex.set(word, []);
          }
          this.invertedIndex.get(word).push(i);

          if (word.length >= 4) {
            const stem = word.slice(0, 4);
            if (!this.prefixIndex.has(stem)) {
              this.prefixIndex.set(stem, []);
            }
            this.prefixIndex.get(stem).push(i);
          }
        }
      }
    }

    this.isIndexed = true;
  }

  /**
   * So'rov bo'yicha tezkor qidiruv (1-5 ms)
   * @param {string} query
   * @param {number} topK
   * @param {string} targetTask - "definition" | "general"
   * @returns {Array<{ text: string, category: string, score: number, index: number }>}
   */
  search(query, topK = 3, targetTask = "general") {
    if (!this.isIndexed || this.knowledgeBase.length === 0) {
      return [];
    }

    const clean = (query || "").toLowerCase().replace(/[`ʼʻ']/g, "'");
    const queryWords = clean.split(/[^a-zа-яёo'g'0-9]+/i).filter(w => w.length > 2);

    if (queryWords.length === 0) return [];

    // Nomzod indekslarni to'plash
    const candidateScores = new Map();

    for (const qWord of queryWords) {
      // Aniq so'z mosligi (O(1) Map lookup)
      const hits = this.invertedIndex.get(qWord) || [];
      for (const idx of hits) {
        candidateScores.set(idx, (candidateScores.get(idx) || 0) + 2.5);
      }

      // Prefiks / o'zak mosligi (O(1) Prefix Map lookup)
      if (qWord.length >= 4) {
        const stem = qWord.slice(0, 4);
        const prefixHits = this.prefixIndex ? (this.prefixIndex.get(stem) || []) : [];
        for (const idx of prefixHits) {
          candidateScores.set(idx, (candidateScores.get(idx) || 0) + 0.8);
        }
      }
    }

    const results = [];
    for (const [idx, score] of candidateScores.entries()) {
      const item = this.knowledgeBase[idx];
      const text = item.text || "";
      const lowerText = text.toLowerCase();

      // Ta'rif vazifasida oddiy dialog replikalarini (choy, yotoq, hazil) bloklash
      if (targetTask === "definition") {
        const isCasualChat = (
          /\b(?:choy|yotoq|damlab|uhlash|uxlash|hazil|bozor|savdo|rahmat|salom)\b/i.test(lowerText) &&
          !/\b(?:bu|hisoblanadi|tashkil\s+topgan|jarayon|vazifasi|asosi)\b/i.test(lowerText)
        );
        if (isCasualChat) {
          continue; // Soxta ta'rif deb tashlamaslik
        }
      }

      results.push({
        text,
        category: item.category || "umumiy",
        score,
        index: idx
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
}

module.exports = FastIndexedKnowledge;
